import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('MongoDB authentication profile boundary', () => {
  const source = readFileSync('src/lib/auth.svelte.ts', 'utf8')

  it('uses Firebase Auth claims without requiring Firestore profiles in MongoDB mode', () => {
    expect(source).toContain('from "$env/static/public"')
    expect(source).toContain("PUBLIC_DATA_PROVIDER === 'mongodb'")
    expect(source).not.toContain('import.meta.env.PUBLIC_DATA_PROVIDER')
    expect(source).toContain('getIdTokenResult()')
    expect(source).toMatch(/usesMongoProvider\(\)\s*\? undefined/)
    expect(source).toContain('updateFirebaseProfile')
  })
})
