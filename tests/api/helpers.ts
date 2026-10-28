import { adminAuth, adminDb } from '@/lib/server/firebase-admin'

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-vorapicks'
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST!
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST!

export async function resetEmulators() {
  await fetch(`http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' })
}

// Creates a phone-number user in the Auth emulator and returns an ID token for it,
// the same kind of token the Flutter app sends.
export async function phoneUser(phoneNumber: string) {
  const user = await adminAuth().createUser({ phoneNumber })
  return { uid: user.uid, token: await idTokenFor(user.uid) }
}

export async function idTokenFor(uid: string) {
  const customToken = await adminAuth().createCustomToken(uid)
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
  )
  const body = (await response.json()) as { idToken: string }
  return body.idToken
}

export function call(handler: (req: Request, ctx: unknown) => Promise<Response>, init: { method?: string; token?: string; body?: unknown } = {}) {
  const request = new Request('http://localhost:3000/api/test', {
    method: init.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init.token && { authorization: `Bearer ${init.token}` }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return handler(request, {}).then(async (res) => ({ status: res.status, body: (await res.json()) as any }))
}

export { adminAuth, adminDb }
