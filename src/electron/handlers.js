/**
 * handlers.js — Electron IPC 路由处理器
 */
import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'accounting-app-secret-key-2026'
const JWT_TTL = '7d'

function hashPwd(pwd) {
  const salt = 'acc_salt_v1'
  let h = 0
  const s = pwd + salt
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return 'sha1$' + Math.abs(h).toString(16).padStart(8, '0') + '$' + Buffer.from(pwd).toString('base64')
}

function verifyPwd(pwd, hash) {
  return hashPwd(pwd) === hash
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_TTL })
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch (_) { return null }
}

function getUserFromHeader(headers) {
  const raw = headers?.Authorization || headers?.authorization || ''
  if (!raw.startsWith('Bearer ')) return null
  return verifyToken(raw.slice(7))
}

async function getDb() {
  const db = await import('./db.js')
  return db
}

function buildRecordsCSV(rows) {
  const header = ['日期', '类型', '项目', '类别', '支出人', '金额', '说明']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const lines = [header.map(esc).join(',')]
  for (const r of rows) {
    lines.push([
      r.date,
      r.type === 'income' ? '收入' : '支出',
      r.project_name || '',
      r.category,
      r.paid_by || '',
      r.amount,
      r.note || '',
    ].map(esc).join(','))
  }
  return '﻿' + lines.join('\r\n')
}

// ─── Auth ─────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_, { username, password }) => {
  if (!username || !password) return { ok: false, error: '请输入用户名和密码' }
  const db = await getDb()
  const user = db.findUserByUsername(username)
  if (!user || !verifyPwd(password, user.password)) {
    return { ok: false, error: '用户名或密码错误' }
  }
  const token = signToken(user)
  console.log('[auth:login] success:', username)
  return { ok: true, user: { id: user.id, username: user.username }, token }
})

ipcMain.handle('auth:change-password', async (_, args) => {
  const user = getUserFromHeader(args?.headers || {})
  if (!user) return { ok: false, error: '未授权' }
  const { oldPassword, newPassword } = args
  if (!oldPassword || !newPassword) return { ok: false, error: '请填写完整' }
  if (newPassword.length < 6) return { ok: false, error: '新密码至少 6 位' }
  const db = await getDb()
  const existing = db.findUserByUsername(user.username)
  if (!existing || !verifyPwd(oldPassword, existing.password)) {
    return { ok: false, error: '原密码错误' }
  }
  db.updatePassword(user.id, hashPwd(newPassword))
  console.log('[auth:change-password] success:', user.username)
  return { ok: true }
})

// ─── 项目管理 ─────────────────────────────────────────────────────────
ipcMain.handle('projects:list', async (_, args) => {
  console.log('[projects:list] args:', JSON.stringify(args))
  const user = getUserFromHeader(args?.headers || {})
  console.log('[projects:list] user:', user)
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    const projects = db.queryProjects(user.id)
    console.log('[projects:list] projects count:', projects.length)
    const stats = db.queryProjectStats(user.id)
    const statsMap = {}
    for (const s of stats) { statsMap[s.id] = s }
    const enriched = projects.map(p => ({
      ...p,
      total_income: statsMap[p.id]?.total_income || 0,
      total_expense: statsMap[p.id]?.total_expense || 0,
    }))
    return { ok: true, projects: enriched }
  } catch (e) {
    console.error('[projects:list] error:', e)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('projects:create', async (_, args) => {
  console.log('[projects:create] args:', JSON.stringify(args))
  const user = getUserFromHeader(args?.headers || {})
  console.log('[projects:create] user:', user)
  if (!user) return { ok: false, error: '未授权' }
  const body = args?.body || {}
  if (!body.name?.trim()) return { ok: false, error: '项目名称不能为空' }
  if (!body.type?.trim()) return { ok: false, error: '项目类型不能为空' }
  const db = await getDb()
  try {
    const result = db.createProject({ userId: user.id, name: body.name.trim(), type: body.type, note: body.note || '', manager: body.manager || '' })
    console.log('[projects:create] ok, lastInsertRowid:', result?.lastInsertRowid)
    return { ok: true }
  } catch (e) {
    console.error('[projects:create] error:', e)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('projects:update', async (_, { projectId, body, headers }) => {
  const user = getUserFromHeader(headers)
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    db.updateProject({ projectId, name: body.name, type: body.type, note: body.note || '', manager: body.manager || '' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('projects:delete', async (_, { projectId, headers }) => {
  const user = getUserFromHeader(headers)
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    const cnt = db.countRecordsByProject(projectId)
    if (cnt > 0) return { ok: false, error: '该项目下已有收支记录，无法删除' }
    db.deleteProject(projectId, user.id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── 收支记录 ─────────────────────────────────────────────────────────
ipcMain.handle('records:list', async (event, args) => {
  const user = getUserFromHeader(args.headers || {})
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    const result = db.queryRecords({ userId: user.id, ...args })
    return { ok: true, ...result }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('records:create', async (_, { body, headers }) => {
  const user = getUserFromHeader(headers)
  if (!user) return { ok: false, error: '未授权' }
  if (!body.projectId) return { ok: false, error: '请先选择项目' }
  if (!body.category) return { ok: false, error: '请选择类别' }
  const db = await getDb()
  try {
    db.insertRecord({ userId: user.id, projectId: body.projectId, type: body.type, category: body.category, amount: body.amount, date: body.date, note: body.note || '', paidBy: body.paidBy || '' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('records:delete', async (_, { id, headers }) => {
  const user = getUserFromHeader(headers)
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    db.deleteRecord(+id, user.id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('records:stats', async (event, args) => {
  const user = getUserFromHeader(args.headers || {})
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    const year = args.year ? +args.year : new Date().getFullYear()
    const month = args.month ? +args.month : new Date().getMonth() + 1
    const projectId = args.projectId ? +args.projectId : undefined
    const stats = db.queryStats({ userId: user.id, year, month, projectId })
    const recent = db.queryRecent(user.id, 5, projectId)
    const sixMonths = db.querySixMonths(user.id, projectId)
    return { ok: true, stats, recent, sixMonths }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('records:all-stats', async (event, args) => {
  const user = getUserFromHeader(args.headers || {})
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    const projectId = args.projectId ? +args.projectId : undefined
    const stats = db.queryAllStats(user.id, projectId)
    return { ok: true, stats }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('records:export', async (_, args) => {
  const user = getUserFromHeader(args.headers || {})
  if (!user) return { ok: false, error: '未授权' }
  const db = await getDb()
  try {
    const rows = db.exportRecords({ userId: user.id, ...args })
    if (!rows.length) return { ok: true, count: 0 }
    const csv = buildRecordsCSV(rows)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出收支记录',
      defaultPath: `收支记录_${args.start || ''}_${args.end || ''}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return { ok: true, cancelled: true }
    fs.writeFileSync(filePath, csv, 'utf-8')
    return { ok: true, path: filePath, count: rows.length }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

console.log('[Handlers] All IPC handlers registered')
