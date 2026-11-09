'use server'

import { cookies } from 'next/headers'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, db, webApiKey } from '@/lib/firebase/admin'
import { getAdminSession } from '@/lib/admin/session'
import { COLLECTIONS } from '@/lib/admin/data'
import { EMAIL_PATTERN, passwordValid, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/admin/auth'
import { applyAction, collectionFor, MAX_MESSAGE_LENGTH, type AdminAction } from '@/lib/admin/admin-actions'

type FieldError<F extends string> = { ok: false; field: F; message: string }

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

export type SignInResult = { ok: true } | FieldError<'email' | 'password'>

const SIGN_IN_ERRORS: Record<string, FieldError<'email' | 'password'>> = {
  INVALID_LOGIN_CREDENTIALS: { ok: false, field: 'password', message: 'Email or password is incorrect' },
  EMAIL_NOT_FOUND: { ok: false, field: 'password', message: 'Email or password is incorrect' },
  INVALID_PASSWORD: { ok: false, field: 'password', message: 'Email or password is incorrect' },
  INVALID_EMAIL: { ok: false, field: 'email', message: 'Enter a valid email address' },
  USER_DISABLED: { ok: false, field: 'email', message: 'This account has been disabled' },
  TOO_MANY_ATTEMPTS_TRY_LATER: { ok: false, field: 'password', message: 'Too many attempts. Try again in a few minutes.' },
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return SIGN_IN_ERRORS.INVALID_LOGIN_CREDENTIALS
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${webApiKey()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
    cache: 'no-store',
  })
  const body = (await response.json()) as { idToken?: string; error?: { message?: string } }
  if (!response.ok || !body.idToken) {
    // Messages look like "TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account…".
    const code = body.error?.message?.split(' ')[0] ?? ''
    return SIGN_IN_ERRORS[code] ?? { ok: false, field: 'password', message: 'Sign-in failed. Try again.' }
  }

  const token = await adminAuth().verifyIdToken(body.idToken)
  if (token.admin !== true) {
    return { ok: false, field: 'email', message: 'Your account is waiting for approval by a Vorapicks admin.' }
  }

  const session = await adminAuth().createSessionCookie(body.idToken, { expiresIn: SESSION_MAX_AGE * 1000 })
  ;(await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return { ok: true }
}

export async function signOut() {
  const session = await getAdminSession()
  if (session) await adminAuth().revokeRefreshTokens(session.uid)
  ;(await cookies()).delete(SESSION_COOKIE)
}

// ---------------------------------------------------------------------------
// Sign up: creates the Firebase user and a pending admins/{uid} record. The
// account cannot sign in until scripts/approve-admin.mjs grants the claim.
// ---------------------------------------------------------------------------

export type SignUpInput = { fullName: string; email: string; phone: string; password: string }
export type SignUpResult = { ok: true } | FieldError<'fullName' | 'email' | 'phone' | 'password'>

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const fullName = String(input?.fullName ?? '').trim()
  const email = String(input?.email ?? '').trim().toLowerCase()
  const phoneDigits = String(input?.phone ?? '').replace(/\D/g, '')
  const password = String(input?.password ?? '')

  if (fullName.length < 2 || fullName.length > 100) return { ok: false, field: 'fullName', message: 'Enter your full name' }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { ok: false, field: 'email', message: 'Enter a valid email address' }
  if (phoneDigits.length !== 10) return { ok: false, field: 'phone', message: 'Enter a valid phone number' }
  if (!passwordValid(password) || password.length > 128) return { ok: false, field: 'password', message: 'Choose a stronger password' }

  const phoneNumber = `+234${phoneDigits}`
  try {
    const user = await adminAuth().createUser({ email, password, displayName: fullName, phoneNumber })
    await db().collection(COLLECTIONS.admins).doc(user.uid).set({
      fullName,
      email,
      phone: phoneNumber,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    })
    return { ok: true }
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'auth/email-already-exists') return { ok: false, field: 'email', message: 'An account with this email already exists' }
    if (code === 'auth/phone-number-already-exists') return { ok: false, field: 'phone', message: 'This phone number is already in use' }
    if (code === 'auth/invalid-phone-number') return { ok: false, field: 'phone', message: 'Enter a valid phone number' }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Admin actions on orders, disputes, users and conversations
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true } | { ok: false; error: string }

const ACTION_TYPES = new Set<AdminAction['type']>([
  'order/release',
  'order/refund',
  'order/toggleFlag',
  'dispute/review',
  'dispute/resolve',
  'user/toggleVerified',
  'user/toggleSuspended',
  'user/toggleBanned',
  'conversation/read',
  'conversation/send',
  'conversation/close',
])

function validAction(action: AdminAction): string | null {
  if (!action || !ACTION_TYPES.has(action.type)) return 'Unknown action'
  if (typeof action.id !== 'string' || !/^[\w-]{1,100}$/.test(action.id)) return 'Invalid id'
  if (action.type === 'dispute/resolve' && action.resolution !== 'refunded' && action.resolution !== 'released') {
    return 'Invalid resolution'
  }
  if (action.type === 'conversation/send') {
    if (typeof action.text !== 'string' || !action.text.trim() || action.text.length > MAX_MESSAGE_LENGTH) return 'Invalid message'
    if (typeof action.messageId !== 'string' || !/^[\w-]{1,64}$/.test(action.messageId)) return 'Invalid message id'
    if (typeof action.time !== 'string' || action.time.length > 32) return 'Invalid time'
  }
  return null
}

export async function applyAdminAction(action: AdminAction): Promise<ActionResult> {
  const session = await getAdminSession()
  if (!session) return { ok: false, error: 'Your session has expired. Sign in again.' }

  const invalid = validAction(action)
  if (invalid) return { ok: false, error: invalid }

  const ref = db().collection(COLLECTIONS[collectionFor(action)]).doc(action.id)
  return db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) return { ok: false, error: 'Not found' }
    const { id: _id, ...next } = applyAction({ ...snapshot.data(), id: snapshot.id }, action)
    transaction.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedBy: session.uid })
    return { ok: true } as const
  })
}
