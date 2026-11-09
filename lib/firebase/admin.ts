import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Server-side Firebase. The service account comes from FIREBASE_PROJECT_ID,
// FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY; nothing here reaches the browser.

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function app(): App {
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: requireEnv('FIREBASE_PROJECT_ID'),
        clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
        // Hosting dashboards store the key with literal "\n" sequences.
        privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    })
  )
}

export const adminAuth = () => getAuth(app())
export const db = () => getFirestore(app())

// Password sign-in goes through the Identity Toolkit REST API, which needs the
// web API key. It is only used server-side.
export const webApiKey = () => requireEnv('FIREBASE_WEB_API_KEY')
