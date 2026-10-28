import { cookies } from 'next/headers'
import { z } from 'zod'
import { adminAuth } from '@/lib/server/firebase-admin'
import { errors, ok, readJson, route } from '@/lib/server/http'
import { SESSION_COOKIE, SESSION_DAYS } from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

const input = z.object({ idToken: z.string().min(10) })

// Exchanges a fresh Firebase ID token from the sign-in form for an
// httpOnly session cookie. Only accounts with the admin role get one.
export const POST = route(async (request) => {
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) throw errors.forbidden()

  const { idToken } = await readJson(request, input)
  const decoded = await adminAuth()
    .verifyIdToken(idToken, true)
    .catch(() => {
      throw errors.unauthenticated()
    })
  if (decoded.role !== 'admin') throw errors.forbidden("This account doesn't have admin access.")
  // Only accept a token from a sign-in that just happened.
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw errors.unauthenticated()

  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000
  const session = await adminAuth().createSessionCookie(idToken, { expiresIn })
  ;(await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: expiresIn / 1000,
  })
  return ok({ signedIn: true })
})

export const DELETE = route(async () => {
  const jar = await cookies()
  const session = jar.get(SESSION_COOKIE)?.value
  jar.delete(SESSION_COOKIE)
  if (session) {
    // Sign this admin out on every browser, not just this one.
    const decoded = await adminAuth().verifySessionCookie(session).catch(() => null)
    if (decoded) await adminAuth().revokeRefreshTokens(decoded.uid)
  }
  return ok({ signedIn: false })
})
