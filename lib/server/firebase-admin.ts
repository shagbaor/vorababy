import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Server-side Firebase access with full rights (it ignores security rules).
// Only import this from route handlers, server components and scripts.

function usingEmulators() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
}

// Accepts the three separate variables, or the whole service account JSON
// (raw or base64) in FIREBASE_SERVICE_ACCOUNT_DEV.
function serviceAccount(): ServiceAccount | null {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_SERVICE_ACCOUNT_DEV } = process.env

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Env editors store the key's line breaks as the two characters "\n".
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
  }

  if (FIREBASE_SERVICE_ACCOUNT_DEV) {
    const raw = FIREBASE_SERVICE_ACCOUNT_DEV.trim()
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as { project_id: string; client_email: string; private_key: string }
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key }
  }

  return null
}

export function firebaseConfigured() {
  return usingEmulators() || serviceAccount() !== null
}

function adminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  if (usingEmulators()) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-vorapicks' })
  }

  const account = serviceAccount()
  if (!account) {
    throw new Error(
      'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
    )
  }
  return initializeApp({ credential: cert(account), projectId: account.projectId })
}

export function adminAuth() {
  return getAuth(adminApp())
}

export function adminDb() {
  return getFirestore(adminApp())
}
