#!/usr/bin/env node
// scripts/build-vue.mjs  —  构建 Vue 前端并复制到 electron 构建目录
import { execSync } from 'child_process'
import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

console.log('[build-vue] Building Vue app...')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

console.log('[build-vue] Copying to dist-electron...')
const src = join(root, 'dist-vue')
const dst = join(root, 'dist-electron')
mkdirSync(dst, { recursive: true })
cpSync(src, dst, { recursive: true })
console.log('[build-vue] Done')
