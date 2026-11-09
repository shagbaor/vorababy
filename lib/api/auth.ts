import 'server-only'
import { adminAuth } from '@/lib/firebase/admin'
import { ApiError } from '@/lib/api/response'

export type ApiUser = {
  uid: string
  email: string | null
  phone: string | null
  claims: Record<string, unknown>
}

// The Flutter app signs in with firebase_auth and sends the user's ID token as
// "Authorization: Bearer <token>" (FirebaseAuth.instance.currentUser.getIdToken()).
export async function requireUser(request: Request): Promise<ApiUser> {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) throw new ApiError('unauthenticated', 'Sign in required')

  try {
    const token = await adminAuth().verifyIdToken(match[1], true)
    return { uid: token.uid, email: token.email ?? null, phone: token.phone_number ?? null, claims: token }
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'auth/id-token-expired') throw new ApiError('unauthenticated', 'Session expired. Refresh the token and retry.')
    if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') throw new ApiError('unauthenticated', 'Session is no longer valid. Sign in again.')
    throw new ApiError('unauthenticated', 'Invalid token')
  }
}
