import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
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

/** @param {{ root?: string, basePath?: string, mongoHandler?: (request: any, response: any) => unknown, reminderHandler?: (request: any, response: any) => unknown }} options */
export function createOpenEduServer({ root = resolve('build'), basePath = process.env.PUBLIC_BASE_PATH ?? '', mongoHandler, reminderHandler } = {}) {
  if (!mongoHandler) throw new Error('mongoHandler is required')
  return createHttpServer(async (request, response) => {
    const forwardedPrefix = request.headers['x-forwarded-prefix']
    const path = applicationPath(request.url ?? '/', { basePath, forwardedPrefix: typeof forwardedPrefix === 'string' ? forwardedPrefix : '' })
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
      response.setHeader('content-type', mimeTypes[extname(asset)] ?? 'application/octet-stream')
      response.statusCode = 200
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch {
      try {
        const index = await readFile(join(root, 'index.html'))
        response.setHeader('content-type', mimeTypes['.html'])
        response.statusCode = 200
        response.end(request.method === 'HEAD' ? undefined : index)
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
