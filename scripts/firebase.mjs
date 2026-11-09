// Firebase Admin setup shared by the scripts in this folder. Reads the same
// FIREBASE_* variables as the app (see README); run scripts through the pnpm
// commands so .env.local is loaded.
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getSecurityRules } from 'firebase-admin/security-rules'

for (const name of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY']) {
  if (!process.env[name]) {
    console.error(`${name} is not set.`)
    process.exit(1)
  }
}

export const projectId = process.env.FIREBASE_PROJECT_ID

const app = initializeApp({
  credential: cert({
    projectId,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const securityRules = getSecurityRules(app)
