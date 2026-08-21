/**
 * src/api/index.js
 * 渲染进程通过 window.electronAPI.invoke 与 Electron 主进程通信
 *
 * 调用约定：
 *   invoke('auth:login', { username, password })
 *   invoke('records:list', { headers, type, start, end, keyword, page, pageSize })
 *   invoke('records:stats', { headers, year, month })
 *   invoke('records:create', { body, headers })
 *   invoke('records:delete', { id, headers })
 */

const isElectron = !!window.electronAPI

function pack(headers, extra = {}) {
  return { headers: { ...headers }, ...extra }
}

export async function api(path, options = {}) {
  if (!isElectron) {
    // 开发模式下降级：走 HTTP（配合 vite --proxy 或 electron 指向 localhost:9988）
    const token = localStorage.getItem('token') || ''
    const BASE = window.__API_BASE__ || 'http://localhost:9988'
    const res = await fetch(BASE + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers },
    })
    return res
  }

  // Electron IPC 模式
  const token = localStorage.getItem('token') || ''
  const opts = { headers: { 'Authorization': `Bearer ${token}` } }

  if (path.startsWith('/auth/')) {
    const body = options.body ? JSON.parse(options.body) : {}
    const result = await window.electronAPI.invoke(`auth:${path.replace('/auth/', '')}`, { ...body, headers: opts.headers })
    // 构造一个 Response 对象供上层统一处理
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/records/stats')) {
    const params = new URLSearchParams(path.split('?')[1] || '')
    const result = await window.electronAPI.invoke('records:stats', pack(
      opts.headers, {
        year: params.get('year'),
        month: params.get('month'),
        projectId: params.get('projectId') || undefined,
      }
    ))
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ─── 项目管理 ────────────────────────────────────────────────────────
  if (path.startsWith('/projects') && options.method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {}
    const result = await window.electronAPI.invoke('projects:create', { body, headers: opts.headers })
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/projects') && options.method === 'PUT') {
    const parts = path.split('/')
    const projectId = parts[2]
    const body = options.body ? JSON.parse(options.body) : {}
    const result = await window.electronAPI.invoke('projects:update', { projectId: +projectId, body, headers: opts.headers })
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/projects') && options.method === 'DELETE') {
    const parts = path.split('/')
    const projectId = parts[2]
    const result = await window.electronAPI.invoke('projects:delete', { projectId: +projectId, headers: opts.headers })
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path === '/projects') {
    const result = await window.electronAPI.invoke('projects:list', pack(opts.headers, {}))
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/records/all-stats')) {
    const params = new URLSearchParams(path.split('?')[1] || '')
    const result = await window.electronAPI.invoke('records:all-stats', pack(
      opts.headers, { projectId: params.get('projectId') || undefined }
    ))
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/records') && options.method === 'DELETE') {
    const id = path.split('/').pop()
    const result = await window.electronAPI.invoke('records:delete', { id, headers: opts.headers })
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/records') && options.method === 'POST') {
    const body = options.body ? JSON.parse(options.body) : {}
    const result = await window.electronAPI.invoke('records:create', { body, headers: opts.headers })
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (path.startsWith('/records/export')) {
    const params = new URLSearchParams(path.split('?')[1] || '')
    const result = await window.electronAPI.invoke('records:export', pack(opts.headers, {
      type: params.get('type') || undefined,
      projectId: params.get('projectId') ? +params.get('projectId') : undefined,
      start: params.get('start') || undefined,
      end: params.get('end') || undefined,
      keyword: params.get('keyword') || undefined,
      category: params.get('category') || undefined,
    }))
    return new Response(JSON.stringify(result), {
      status: result.ok === false ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // GET /records
  const params = new URLSearchParams(path.split('?')[1] || '')
  const result = await window.electronAPI.invoke('records:list', pack(opts.headers, {
    type: params.get('type') || undefined,
    projectId: params.get('projectId') ? +params.get('projectId') : undefined,
    start: params.get('start') || undefined,
    end: params.get('end') || undefined,
    keyword: params.get('keyword') || undefined,
    category: params.get('category') || undefined,
    page: +(params.get('page') || 1),
    pageSize: +(params.get('pageSize') || 20),
  }))
  return new Response(JSON.stringify(result), {
    status: result.ok === false ? 400 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
