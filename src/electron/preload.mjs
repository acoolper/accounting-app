// preload.mjs — 安全的 IPC 桥接（contextBridge）
import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API（通过 window.api 调用）
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    console.log('[preload] invoke:', channel, JSON.stringify(args).slice(0, 200))
    return ipcRenderer.invoke(channel, ...args).then(result => {
      console.log('[preload] invoke result:', channel, JSON.stringify(result).slice(0, 300))
      return result
    }).catch(err => {
      console.error('[preload] invoke error:', channel, err)
      throw err
    })
  },
  on: (channel, fn) => ipcRenderer.on(channel, (e, ...a) => fn(...a)),
  removeListener: (channel, fn) => ipcRenderer.removeListener(channel, fn),
})
