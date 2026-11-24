import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createOpenEduServer, applicationPath, normalizeBasePath } from '../../server.mjs'

const servers: import('node:http').Server[] = []
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))) })

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
})
