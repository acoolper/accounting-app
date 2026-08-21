/**
 * db.js — SQLite 数据库初始化与工具函数
 * ES Module: 使用动态 import() 加载 better-sqlite3 native addon
 */
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const LOG = '/tmp/记账-min.log'
function log(...args) {
  const line = `[${Date.now()}] [db] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
  try { fs.appendFileSync(LOG, line) } catch (_) {}
}

let db = null

async function loadBetterSqlite3() {
  if (app.isPackaged) {
    const unpackedRoot = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'better-sqlite3'
    )
    const platformKey = `${process.platform}-${process.arch}`
    const libPath = path.join(unpackedRoot, 'lib', `${platformKey}.js`)
    log('packaged, platform entry:', libPath, 'exists:', fs.existsSync(libPath))
    const mod = await import(libPath)
    return mod.default || mod
  } else {
    const mod = await import('better-sqlite3')
    return mod.default || mod
  }
}

export async function initDb() {
  const userDataPath = app.getPath('userData')
  fs.mkdirSync(userDataPath, { recursive: true })
  const dbPath = path.join(userDataPath, 'accounting.db')
  log('userDataPath:', userDataPath)
  log('dbPath:', dbPath)

  const Database = await loadBetterSqlite3()
  db = new Database(dbPath)
  log('db created')

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // 创建表（包含项目管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      note       TEXT    DEFAULT '',
      manager    TEXT    DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS records (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      project_id INTEGER,
      type       TEXT    NOT NULL CHECK(type IN ('income','expense')),
      category   TEXT    NOT NULL,
      amount     REAL    NOT NULL CHECK(amount > 0),
      date       TEXT    NOT NULL,
      note       TEXT    DEFAULT '',
      paid_by    TEXT    DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_records_user_type ON records(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_records_project ON records(project_id);
  `)

  function hashPwd(pwd) {
    const salt = 'acc_salt_v1'
    let h = 0
    const s = pwd + salt
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
    }
    return 'sha1$' + Math.abs(h).toString(16).padStart(8, '0') + '$' + Buffer.from(pwd).toString('base64')
  }

  const defaultUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin')
  if (!defaultUser) {
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
    stmt.run('admin', hashPwd('admin123'))
    log('Default admin account created: admin / admin123 (hashed)')
  } else {
    log('Admin user exists, id:', defaultUser.id)
  }

  log('DB Ready at', dbPath)
  return db
}

export function closeDb() {
  if (db) { try { db.close() } catch (_) {}; db = null }
}

function _db() {
  if (!db) throw new Error('Database not initialized')
  return db
}

// ─── 用户操作 ─────────────────────────────────────────────────────────
export function findUserByUsername(username) {
  return _db().prepare('SELECT * FROM users WHERE username = ?').get(username)
}

export function updatePassword(userId, hashedPwd) {
  const stmt = _db().prepare('UPDATE users SET password = ? WHERE id = ?')
  return stmt.run(hashedPwd, userId)
}

// ─── 项目管理 ─────────────────────────────────────────────────────────
export function createProject({ userId, name, type, note = '', manager = '' }) {
  const stmt = _db().prepare(
    'INSERT INTO projects (user_id, name, type, note, manager) VALUES (?,?,?,?,?)'
  )
  return stmt.run(userId, name, type, note, manager)
}

export function queryProjects(userId) {
  return _db().prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId)
}

export function getProject(projectId) {
  return _db().prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
}

export function updateProject({ projectId, name, type, note, manager }) {
  const stmt = _db().prepare(
    'UPDATE projects SET name=?, type=?, note=?, manager=? WHERE id=?'
  )
  return stmt.run(name, type, note, manager, projectId)
}

export function deleteProject(projectId, userId) {
  const stmt = _db().prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
  return stmt.run(projectId, userId)
}

export function countRecordsByProject(projectId) {
  const row = _db().prepare('SELECT COUNT(*) as n FROM records WHERE project_id = ?').get(projectId)
  return row.n
}

// ─── 收支记录 ─────────────────────────────────────────────────────────
export function insertRecord({ userId, projectId, type, category, amount, date, note = '', paidBy = '' }) {
  const stmt = _db().prepare(
    'INSERT INTO records (user_id, project_id, type, category, amount, date, note, paid_by) VALUES (?,?,?,?,?,?,?,?)'
  )
  return stmt.run(userId, projectId || null, type, category, amount, date, note, paidBy)
}

export function deleteRecord(id, userId) {
  const stmt = _db().prepare('DELETE FROM records WHERE id = ? AND user_id = ?')
  return stmt.run(id, userId)
}

export function queryRecords({ userId, projectId, type, category, start, end, keyword, page = 1, pageSize = 20 }) {
  const d = _db()
  const cond = ['r.user_id = ?']
  const params = [userId]
  if (projectId) { cond.push('project_id = ?'); params.push(projectId) }
  if (type) { cond.push('type = ?'); params.push(type) }
  if (start) { cond.push('date >= ?'); params.push(start) }
  if (end) { cond.push('date <= ?'); params.push(end) }
  if (category) { cond.push('r.category = ?'); params.push(category) }
  if (keyword) { cond.push('(r.category LIKE ? OR r.note LIKE ? OR p.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`) }
  const where = cond.join(' AND ')
  const offset = (page - 1) * pageSize

  const countSql = keyword
    ? `SELECT COUNT(*) as n FROM records r LEFT JOIN projects p ON r.project_id=p.id WHERE ${where}`
    : `SELECT COUNT(*) as n FROM records r WHERE ${where}`
  const total = keyword
    ? d.prepare(countSql).get(...params).n
    : d.prepare(countSql).get(...params).n

  const rowsSql = keyword
    ? `SELECT r.id, r.user_id, r.project_id, r.type, r.category, r.amount, r.date, r.note, r.created_at, r.paid_by, p.name as project_name
       FROM records r LEFT JOIN projects p ON r.project_id=p.id
       WHERE ${where} ORDER BY r.date DESC, r.id DESC LIMIT ? OFFSET ?`
    : `SELECT r.id, r.user_id, r.project_id, r.type, r.category, r.amount, r.date, r.note, r.created_at, r.paid_by, p.name as project_name
       FROM records r LEFT JOIN projects p ON r.project_id=p.id
       WHERE ${where} ORDER BY r.date DESC, r.id DESC LIMIT ? OFFSET ?`

  const rows = d.prepare(rowsSql).all(...params, pageSize, offset)
  return { records: rows.map(r => ({ ...r, paid_by: r.paid_by || '' })), total }
}

export function exportRecords({ userId, projectId, type, category, start, end, keyword }) {
  const d = _db()
  const cond = ['r.user_id = ?']
  const params = [userId]
  if (projectId) { cond.push('project_id = ?'); params.push(projectId) }
  if (type) { cond.push('type = ?'); params.push(type) }
  if (category) { cond.push('r.category = ?'); params.push(category) }
  if (start) { cond.push('date >= ?'); params.push(start) }
  if (end) { cond.push('date <= ?'); params.push(end) }
  if (keyword) { cond.push('(r.category LIKE ? OR r.note LIKE ? OR p.name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`) }
  const where = cond.join(' AND ')
  const sql = `SELECT r.id, r.type, r.category, r.amount, r.date, r.note, r.paid_by, p.name as project_name
    FROM records r LEFT JOIN projects p ON r.project_id = p.id
    WHERE ${where} ORDER BY r.date DESC, r.id DESC`
  const rows = d.prepare(sql).all(...params)
  return rows.map(r => ({ ...r, paid_by: r.paid_by || '' }))
}

export function queryStats({ userId, year, month, projectId }) {
  const pad = n => String(n).padStart(2, '0')
  const m0 = `${year}-${pad(month)}-01`
  const y1 = month === 12 ? year + 1 : year
  const m1 = month === 12 ? `${y1}-01-01` : `${y1}-${pad(month + 1)}-01`
  const d = _db()
  const projSql = projectId ? 'AND r.project_id = ?' : ''
  const projParams = projectId ? [projectId] : []
  const byType = d.prepare(
    `SELECT type, SUM(amount) as total FROM records r WHERE r.user_id = ? ${projSql} AND date >= ? AND date < ? GROUP BY type`
  ).all(...[userId, ...projParams, m0, m1])
  let income = 0, expense = 0
  for (const r of byType) {
    if (r.type === 'income') income = r.total || 0
    else expense = r.total || 0
  }
  return { income, expense, balance: income - expense }
}

export function queryAllStats(userId, projectId) {
  const d = _db()
  const projSql = projectId ? 'AND project_id = ?' : ''
  const projParams = projectId ? [projectId] : []
  const rows = d.prepare(
    `SELECT type, SUM(amount) as total FROM records WHERE user_id = ? ${projSql} GROUP BY type`
  ).all(...[userId, ...projParams])
  let income = 0, expense = 0
  for (const r of rows) {
    if (r.type === 'income') income = r.total || 0
    else expense = r.total || 0
  }
  return { income, expense, balance: income - expense }
}

// 按项目统计
export function queryProjectStats(userId) {
  const d = _db()
  const rows = d.prepare(`
    SELECT p.id, p.name, p.type as project_type,
           COALESCE(SUM(CASE WHEN r.type='income' THEN r.amount ELSE 0 END), 0) as total_income,
           COALESCE(SUM(CASE WHEN r.type='expense' THEN r.amount ELSE 0 END), 0) as total_expense
    FROM projects p
    LEFT JOIN records r ON r.project_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY total_income DESC
  `).all(userId)
  return rows
}

export function querySixMonths(userId, projectId) {
  const d = _db()
  const projSql = projectId ? 'AND r.project_id = ?' : ''
  const projParams = projectId ? [projectId] : []
  const rows = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = dt.getFullYear(), m = dt.getMonth() + 1
    const m0 = `${y}-${String(m).padStart(2,'0')}-01`
    const m1 = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`
    const byType = d.prepare(
      `SELECT type, SUM(amount) as total FROM records r WHERE r.user_id = ? ${projSql} AND date >= ? AND date < ? GROUP BY type`
    ).all(...[userId, ...projParams, m0, m1])
    let income = 0, expense = 0
    for (const r of byType) {
      if (r.type === 'income') income = r.total || 0
      else expense = r.total || 0
    }
    rows.push({ key: `${y}-${m}`, label: `${m}月`, income: income || 0, expense: expense || 0, maxH: Math.max(income, expense) })
  }
  return rows
}

export function queryRecent(userId, limit = 5, projectId) {
  const projSql = projectId ? 'AND r.project_id = ?' : ''
  const params = projectId ? [userId, projectId, limit] : [userId, limit]
  return _db().prepare(`
    SELECT r.id, r.type, r.category, r.amount, r.date, r.note, r.paid_by, p.name as project_name
    FROM records r LEFT JOIN projects p ON r.project_id=p.id
    WHERE r.user_id = ? ${projSql} ORDER BY r.date DESC, r.id DESC LIMIT ?
  `).all(...params)
}
