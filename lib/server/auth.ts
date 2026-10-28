import { cookies } from 'next/headers'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { adminAuth } from '@/lib/server/firebase-admin'
import { errors } from '@/lib/server/http'
import { SESSION_COOKIE } from '@/lib/admin/session'
import type { Role } from '@/lib/server/model'

export type Caller = DecodedIdToken & { role?: Role }

// App requests send the Firebase ID token: `Authorization: Bearer <idToken>`.
// checkRevoked makes suspensions and bans take effect immediately.
export async function requireCaller(request: Request, ...roles: Role[]): Promise<Caller> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw errors.unauthenticated()

  let caller: Caller
  try {
    caller = (await adminAuth().verifyIdToken(token, true)) as Caller
  } catch {
    throw errors.unauthenticated()
  }

  if (roles.length > 0 && (!caller.role || !roles.includes(caller.role))) {
    throw errors.forbidden()
  }
  return caller
}

// Admin website: a session cookie created at sign-in by /api/admin/session.
export async function currentAdmin(): Promise<Caller | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value
  if (!cookie) return null
  try {
    const caller = (await adminAuth().verifySessionCookie(cookie, true)) as Caller
    return caller.role === 'admin' ? caller : null
  } catch {
    return null
  }
}

// For admin API routes. Also rejects cross-site form posts, since the
// session travels in a cookie.
export async function requireAdmin(request: Request): Promise<Caller> {
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) throw errors.forbidden()

  const admin = await currentAdmin()
  if (!admin) throw errors.unauthenticated()
  return admin
}
