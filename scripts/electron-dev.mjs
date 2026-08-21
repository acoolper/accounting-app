#!/usr/bin/env node
// scripts/electron-dev.mjs  —  开发模式：同时启动 Vite Dev Server + Electron
import { spawn, execSync } from 'child_process'
import { createServer } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function main() {
  // 1. 启动 Vite Dev Server
  const server = await createServer({
    configFile: join(root, 'vite.config.mjs'),
    server: { port: 5173, strictPort: true },
  })
  await server.listen()
  server.printUrls()

  // 2. 启动 Electron（注入 DEV_SERVER_URL）
  const electronPath = join(root, 'node_modules/.bin/electron')
  const mainPath = join(root, 'src/electron/main.js')
  const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }

  spawn(electronPath, [mainPath], { cwd: root, env, stdio: 'inherit' })
}

main().catch(console.error)
