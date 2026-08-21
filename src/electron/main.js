/**
 * main.js — Electron 主进程
 * ES Module (type="module")，所有依赖使用动态 import()
 */
import { app, BrowserWindow, Menu, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG = '/tmp/记账-app.log'

function log(...args) {
  const line = `[${Date.now()}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}\n`
  try { fs.appendFileSync(LOG, line) } catch (_) {}
  try { console.log(...args) } catch (_) {}
}

log('=== main.js loaded ===', app.isPackaged)

// 延迟导入 — 确保 app.whenReady() 已经触发后再加载原生模块
let initDb, registerHandlers

app.whenReady().then(async () => {
  log('whenReady fired')

  try {
    const db = await import('./db.js')
    initDb = db.initDb
    log('db.js loaded OK')
  } catch (e) {
    log('db.js LOAD FAIL:', e.message)
  }

  try {
    const handlers = await import('./handlers.js')
    registerHandlers = handlers.registerHandlers
    log('handlers.js loaded OK')
  } catch (e) {
    log('handlers.js LOAD FAIL:', e.message)
  }

  if (initDb) {
    try {
      await initDb()
      log('initDb OK')
    } catch (e) {
      log('initDb FAIL:', e.message, e.stack?.split('\n')[1] || '')
    }
  }

  if (registerHandlers) {
    try {
      registerHandlers()
      log('registerHandlers OK')
    } catch (e) {
      log('registerHandlers FAIL:', e.message)
    }
  }

  createWindow()
})

let mainWindow = null

function createWindow() {
  log('createWindow')
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: '💰 记账本',
    icon: path.join(__dirname, '../../build/icon.icns'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    log('window shown')
  })

  // ── 菜单 ──────────────────────────────────────────────────────────────
  const tmpl = [
    {
      label: '记账本',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于记账本',
              message: '💰 记账本 v1.0.0',
              detail: '基于 Electron + Vue 3 + SQLite 的桌面记账工具\n\n安全存储，本地运行，无网络依赖。',
            })
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(tmpl))

  // ── 加载页面 ───────────────────────────────────────────────────────────
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-vue/index.html'))
  }

  log('loadFile/loadURL called')
}

app.on('window-all-closed', () => {
  log('window-all-closed')
  if (initDb) {
    try {
      const db = { closeDb: null }
      // 动态导入 closeDb — 避免顶层导入
      import('./db.js').then(m => { if (m.closeDb) m.closeDb() })
    } catch (_) {}
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
