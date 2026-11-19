import fs from 'node:fs'
import crypto from 'node:crypto'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(x => x && !x.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const database = env.MONGODB_DATABASE ?? ''
if (!/^(.*_)?(test|dev|staging|verify|verification|sandbox)([_-].*)?$/i.test(database)) throw new Error('Refusing integration test: MONGODB_DATABASE is not explicitly isolated.')
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 before running.')
const base = process.env.NETLIFY_TEST_URL ?? 'http://localhost:8888'
const tag = `quiz-verification-${crypto.randomUUID()}`
console.log(JSON.stringify({ database, base, tag, step: 'configuration-pass' }))
const response = await fetch(`${base}/api/mongo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'getQuiz', data: { quizId: tag } }) })
if (response.status !== 401) throw new Error(`Unauthenticated boundary expected 401, received ${response.status}`)
console.log(JSON.stringify({ unauthenticatedBoundary: 'PASS' }))
console.log('Authenticated lifecycle requires an emulator ID token and seeded MongoDB fixtures; use the seed/token harness before extending this script.')
