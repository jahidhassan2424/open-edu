import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/mongo.mjs'

function response() {
  return { statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown, status(code: number) { this.statusCode = code; return this }, setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this }, json(value: unknown) { this.body = value; return this }, end() { return this }, send(value: unknown) { this.body = value; return this } }
}

afterEach(() => vi.unstubAllEnvs())

describe('Mongo API CORS boundary', () => {
  it('answers allowed preflight requests without invoking MongoDB', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://learn.example.test')
    const result = response()
    await handler({ method: 'OPTIONS', headers: { origin: 'https://learn.example.test' } }, result)
    expect(result.statusCode).toBe(204)
    expect(result.headers).toMatchObject({ 'access-control-allow-origin': 'https://learn.example.test', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', vary: 'Origin' })
  })

  it('rejects origins outside ALLOWED_ORIGINS before the Mongo handler', async () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://learn.example.test')
    const result = response()
    await handler({ method: 'OPTIONS', headers: { origin: 'https://other.example.test' } }, result)
    expect(result.statusCode).toBe(403)
    expect(result.body).toEqual({ error: 'Origin is not allowed.' })
  })
})
