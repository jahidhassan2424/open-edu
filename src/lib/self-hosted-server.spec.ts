import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOpenEduServer, applicationPath, normalizeBasePath } from '../../server.mjs'
import mongoHandler from '../../api/mongo.mjs'

const servers: import('node:http').Server[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

describe('self-hosted server routing', () => {
  it('normalizes configured and reverse-proxy path prefixes', () => {
    expect(normalizeBasePath('/deployments/3/')).toBe('/deployments/3')
    expect(applicationPath('/deployments/3/api/mongo', { basePath: '/deployments/3/' })).toBe('/api/mongo')
    expect(applicationPath('/deployments/3/api/mongo', { forwardedPrefix: '/deployments/3' })).toBe('/api/mongo')
  })

  it('serves the SPA and sends prefixed API requests to the existing handler', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-edu-'))
    await writeFile(join(root, 'index.html'), '<main>Open-EDU</main>')
    const handler = async (request: { method?: string; body?: string }, response: { status: (code: number) => { json: (value: unknown) => unknown } }) => response.status(200).json({ method: request.method, body: request.body })
    const reminderHandler = async (_request: unknown, response: { status: (code: number) => { json: (value: unknown) => unknown } }) => response.status(200).json({ scheduled: true })
    const server = createOpenEduServer({ root, basePath: '/deployments/3', mongoHandler: handler, reminderHandler })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    await expect(fetch(`http://127.0.0.1:${port}/deployments/3/courses`)).resolves.toMatchObject({ status: 200 })
    await expect((await fetch(`http://127.0.0.1:${port}/deployments/3/api/mongo`, { method: 'POST', body: '{"ok":true}' })).json()).resolves.toEqual({ method: 'POST', body: '{"ok":true}' })
    await expect((await fetch(`http://127.0.0.1:${port}/deployments/3/api/reminders`, { method: 'POST' })).json()).resolves.toEqual({ scheduled: true })
  })

  it('rewrites the SvelteKit runtime name in prefixed HTML without changing JavaScript assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-edu-runtime-'))
    const chunks = join(root, '_app', 'immutable', 'chunks')
    const html = '<script>__sveltekit_dev = { env: null }</script>'
    const runtime = 'globalThis.__sveltekit_abc123?.env'
    await mkdir(chunks, { recursive: true })
    await writeFile(join(root, 'index.html'), html)
    await writeFile(join(chunks, 'runtime.js'), runtime)

    const server = createOpenEduServer({ root, basePath: '/deployments/3', mongoHandler: async () => undefined })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    for (const path of ['/deployments/3/', '/deployments/3/index.html']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      expect(response.status).toBe(200)
      const body = await response.text()
      expect(body).toContain('__sveltekit_abc123 =')
      expect(body).not.toContain('__sveltekit_dev =')
    }

    await expect((await fetch(`http://127.0.0.1:${port}/deployments/3/_app/immutable/chunks/runtime.js`)).text()).resolves.toBe(runtime)
  })

  it('forwards root and prefixed MongoDB preflight requests to the CORS adapter', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'http://localhost:5173')
    const server = createOpenEduServer({ mongoHandler, basePath: '/deployments/3' })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    const request = (path: string) => fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' }
    })

    for (const path of ['/api/mongo', '/deployments/3/api/mongo']) {
      const response = await request(path)
      expect(response.status).toBe(204)
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
      expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
      expect(response.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type')
      expect(response.headers.get('vary')).toBe('Origin')
    }
  })

  it('returns a public health response through the deployment prefix', async () => {
    const server = createOpenEduServer({ mongoHandler: async () => undefined, basePath: '/deployments/3' })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    const response = await fetch(`http://127.0.0.1:${port}/deployments/3/api/health`)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', service: 'open-edu', timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
    expect(response.status).toBe(200)
  })

  it('reports unavailable when the application readiness check fails', async () => {
    const server = createOpenEduServer({ mongoHandler: async () => undefined, isReady: () => false })
    servers.push(server)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0

    const response = await fetch(`http://127.0.0.1:${port}/api/health`)
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ status: 'unavailable', service: 'open-edu', timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
  })
})
