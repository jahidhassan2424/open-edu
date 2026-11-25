import { createServer as createHttpServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

/** @type {Record<string, string>} */
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' }

/** @param {string} value */
export function normalizeBasePath(value = '') {
  const path = value.trim().replace(/\\/g, '/')
  if (!path || path === '/') return ''
  return `/${path.replace(/^\/+|\/+$/g, '')}`
}

/** @param {string} url @param {{ basePath?: string, forwardedPrefix?: string }} options */
export function applicationPath(url, { basePath = '', forwardedPrefix = '' } = {}) {
  const pathname = new URL(url, 'http://localhost').pathname
  for (const prefix of [normalizeBasePath(basePath), normalizeBasePath(forwardedPrefix)]) {
    if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) return pathname.slice(prefix.length) || '/'
  }
  return pathname
}

/** @param {string} root */
export async function detectSvelteKitRuntimeName(root = resolve('build')) {
  const runtimeDirectories = [
    join(root, '_app', 'immutable', 'entry'),
    join(root, '_app', 'immutable', 'chunks')
  ]

  for (const directory of runtimeDirectories) {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name) !== '.js') continue
      let source
      try { source = await readFile(join(directory, entry.name), 'utf8') } catch { continue }
      for (const match of source.matchAll(/\bglobalThis\.(__sveltekit_[A-Za-z0-9_$]+)/g)) {
        if (match[1] !== '__sveltekit_fetch') return match[1]
      }
    }
  }

  return '__sveltekit_dev'
}

/** @param {string} html @param {string} runtimeName */
export function rewriteSvelteKitRuntimeName(html, runtimeName) {
  if (runtimeName === '__sveltekit_dev') return html
  return html.replace(/__sveltekit_dev/g, runtimeName)
}

/** @param {import('node:http').ServerResponse} response */
function responseAdapter(response) {
  return {
    status(/** @type {number} */ code) { response.statusCode = code; return this },
    setHeader(/** @type {string} */ name, /** @type {string | number | readonly string[]} */ value) { response.setHeader(name, value); return this },
    json(/** @type {unknown} */ value) { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(value)); return this },
    send(/** @type {string | Uint8Array} */ value) { response.end(value); return this },
    end() { response.end(); return this }
  }
}

/** @param {string} root @param {string} pathname */
function safeAsset(root, pathname) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '')
  const file = resolve(root, relative)
  return file === root || file.startsWith(`${root}${sep}`) ? file : null
}

/** @param {{ root?: string, basePath?: string, mongoHandler?: (request: any, response: any) => unknown, reminderHandler?: (request: any, response: any) => unknown, isReady?: () => boolean }} options */
export function createOpenEduServer({ root = resolve('build'), basePath = process.env.PUBLIC_BASE_PATH ?? '', mongoHandler, reminderHandler, isReady = () => true } = {}) {
  if (!mongoHandler) throw new Error('mongoHandler is required')
  // Resolve once per server instance; SH-002 will use this when serving fallback HTML.
  const runtimeName = detectSvelteKitRuntimeName(root)
  return createHttpServer(async (request, response) => {
    void runtimeName
    const forwardedPrefix = request.headers['x-forwarded-prefix']
    const path = applicationPath(request.url ?? '/', { basePath, forwardedPrefix: typeof forwardedPrefix === 'string' ? forwardedPrefix : '' })
    if (path === '/api/health') {
      if (request.method !== 'GET') { response.statusCode = 405; response.end('Method not allowed.'); return }
      const timestamp = new Date().toISOString()
      try {
        if (!isReady()) { response.statusCode = 503; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ status: 'unavailable', service: 'open-edu', timestamp })); return }
      } catch { response.statusCode = 503; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ status: 'unavailable', service: 'open-edu', timestamp })); return }
      response.statusCode = 200
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ status: 'ok', service: 'open-edu', timestamp }))
      return
    }
    if (path === '/api/mongo' || path === '/api/reminders') {
      const handler = path === '/api/mongo' ? mongoHandler : reminderHandler
      if (!handler) { response.statusCode = 404; response.end('API endpoint is not configured.'); return }
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const apiRequest = /** @type {any} */ (request)
      apiRequest.body = Buffer.concat(chunks).toString('utf8')
      return handler(apiRequest, responseAdapter(response))
    }

    if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) { response.statusCode = 405; response.end('Method not allowed.'); return }
    const asset = safeAsset(root, path === '/' ? '/index.html' : path)
    if (!asset) { response.statusCode = 400; response.end('Invalid path.'); return }
    try {
      const body = await readFile(asset)
      const extension = extname(asset)
      response.setHeader('content-type', mimeTypes[extension] ?? 'application/octet-stream')
      response.statusCode = 200
      response.end(request.method === 'HEAD' ? undefined : extension === '.html' ? rewriteSvelteKitRuntimeName(body.toString('utf8'), await runtimeName) : body)
    } catch {
      try {
        const index = await readFile(join(root, 'index.html'))
        response.setHeader('content-type', mimeTypes['.html'])
        response.statusCode = 200
        response.end(request.method === 'HEAD' ? undefined : rewriteSvelteKitRuntimeName(index.toString('utf8'), await runtimeName))
      } catch { response.statusCode = 404; response.end('Open-EDU build output was not found. Run npm run build first.') }
    }
  })
}

export async function startServer() {
  const { default: mongoHandler } = await import('./api/mongo.mjs')
  const { default: reminderHandler } = await import('./api/reminders.mjs')
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.')
  const server = createOpenEduServer({ mongoHandler, reminderHandler })
  server.listen(port, '0.0.0.0', () => console.log(`Open-EDU listening on http://0.0.0.0:${port}`))
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startServer()
