import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function serviceAccountFromEnvironment() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON')
  }
}

export function getFirebaseAdminAuth() {
  if (!getApps().length) {
    const serviceAccount = serviceAccountFromEnvironment()
    initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : undefined)
  }

  return getAuth()
}
