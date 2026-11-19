#!/usr/bin/env node
/**
 * One-time/operator-only role bootstrap. Run from a trusted workstation or CI
 * with Application Default Credentials; it is intentionally not exposed in the app.
 */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const args = process.argv.slice(2)
const valueAfter = flag => args[args.indexOf(flag) + 1]
const uid = valueAfter('--uid')
const role = valueAfter('--role')
if (!uid || !['admin', 'instructor', 'student'].includes(role)) {
  console.error('Usage: node scripts/set-custom-claim.mjs --uid FIREBASE_UID --role admin|instructor|student')
  process.exit(1)
}

// GOOGLE_APPLICATION_CREDENTIALS is preferred. FIREBASE_SERVICE_ACCOUNT_JSON is
// supported for CI and must be kept in a secret store, never in .env.local.
const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  : applicationDefault()
if (!getApps().length) initializeApp({ credential })

await getAuth().setCustomUserClaims(uid, { role })
console.log(`Set custom claim role=${role} for ${uid}. The user must sign out/in or force-refresh their ID token.`)
