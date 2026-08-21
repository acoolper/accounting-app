#!/usr/bin/env node
// scripts/build-electron.mjs  —  用 electron-builder 打包应用
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

console.log('[build-electron] Packaging...')
try {
  execSync(`npx electron-builder --config electron-builder.json`, {
    cwd: root,
    stdio: 'inherit',
  })
  console.log('[build-electron] Done! Check the release/ folder.')
} catch (e) {
  console.error('[build-electron] Build failed:', e.message)
  process.exit(1)
}
