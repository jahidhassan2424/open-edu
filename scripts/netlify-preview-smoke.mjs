import fs from 'node:fs'
import crypto from 'node:crypto'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(x => x && !x.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const base = process.env.PREVIEW_BASE_URL
const db = env.MONGODB_DATABASE ?? process.env.MONGODB_DATABASE ?? ''
if (process.env.SMOKE_TEST_MODE !== 'true') throw new Error('Set SMOKE_TEST_MODE=true to run preview smoke tests.')
if (!base || !/^https:\/\//i.test(base) || /localhost|127\.0\.0\.1|firebaseapp\.com/i.test(base)) throw new Error('PREVIEW_BASE_URL must be an explicit HTTPS Netlify preview URL.')
if (!/(test|dev|staging|verify|verification|sandbox)/i.test(db)) throw new Error('Refusing smoke test: configured database is not explicitly isolated.')
const learnerToken = process.env.SMOKE_LEARNER_TOKEN; const instructorToken = process.env.SMOKE_INSTRUCTOR_TOKEN
if (!learnerToken || !instructorToken) throw new Error('SMOKE_LEARNER_TOKEN and SMOKE_INSTRUCTOR_TOKEN are required; tokens are never logged.')
const tag = `smoke-${crypto.randomUUID()}`
async function request(path, token, body) { const response = await fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); let data = null; try { data = await response.json() } catch {} if (response.status >= 500) throw new Error(`server-error:${response.status}`); if (response.status === 401 || response.status === 403) return { response, data, category: 'authorization' }; if (response.status === 404) return { response, data, category: 'routing' }; return { response, data, category: response.ok ? 'ok' : 'configuration' } }
const unauth = await fetch(`${base}/api/mongo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'listCourses', data: {} }) }); if (unauth.status !== 401) throw new Error(`unauthenticated-boundary-failed:${unauth.status}`)
const learner = await request('/api/mongo', learnerToken, { operation: 'listCourses', data: { filter: { isPublished: true } } }); if (!learner.response.ok) throw new Error(`learner-course-list-failed:${learner.category}`)
console.log(JSON.stringify({ status: 'PASS', tag, checks: ['routing', 'unauthenticated-rejection', 'learner-course-list'], databaseIsolation: true }))
