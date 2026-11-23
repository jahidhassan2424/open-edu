import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Vercel MongoDB boundary', () => {
  const adapter = readFileSync('api/mongo.mjs', 'utf8')
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const provider = readFileSync('src/lib/services/mongo-provider.ts', 'utf8')
  const handler = readFileSync('netlify/functions/mongo-api.mjs', 'utf8')
  const admin = readFileSync('netlify/functions/_lib/firebase-admin.mjs', 'utf8')

  it('adapts the existing authenticated handler without duplicating business logic', () => {
    expect(adapter).toContain("../netlify/functions/mongo-api.mjs")
    expect(adapter).toContain("request.method !== 'POST'")
    expect(adapter).toContain('ALLOWED_ORIGINS')
  })

  it('packages the shared handler and compiled grading logic', () => {
    expect(config.installCommand).toBe('npm ci && npm --prefix functions ci')
    expect(config.buildCommand).toContain('npm --prefix functions run build')
    expect(config.functions['api/mongo.mjs'].includeFiles).toContain('netlify/functions/**')
    expect(config.functions['api/mongo.mjs'].includeFiles).toContain('functions/lib/**')
  })

  it('uses an environment-selected API origin and managed Firebase Admin credentials', () => {
    expect(provider).toContain('PUBLIC_API_BASE_URL')
    expect(provider).toContain('PUBLIC_API_BASE_URL is required')
    expect(admin).toContain('FIREBASE_SERVICE_ACCOUNT_JSON')
    expect(admin).not.toContain('PUBLIC_')
  })

  it('keeps academic-term writes on the authenticated MongoDB boundary', () => {
    expect(provider).toContain("saveTerm: (term: AcademicTerm) => call<string>('saveTerm', term)")
    expect(provider).toContain("deleteTerm: (id: string) => call<void>('deleteTerm', { id })")
    expect(handler).toContain("operation === 'deleteTerm'")
  })
})
