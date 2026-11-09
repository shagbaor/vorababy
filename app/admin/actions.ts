'use server'

import { cookies } from 'next/headers'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, db, webApiKey } from '@/lib/firebase/admin'
import { getAdminSession } from '@/lib/admin/session'
import { COLLECTIONS } from '@/lib/admin/data'
import { EMAIL_PATTERN, passwordValid, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/admin/auth'
import { applyAction, collectionFor, MAX_MESSAGE_LENGTH, type AdminAction } from '@/lib/admin/admin-actions'
import type { AdminAccount, AdminUser } from '@/lib/admin/mock-data'
import { validateProfile } from '@/lib/users'

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
    const status = (await db().collection(COLLECTIONS.admins).doc(token.uid).get()).get('status')
    const message =
      status === 'pending'
        ? 'Your account is waiting for approval by a Vorapicks admin.'
        : status === 'rejected'
          ? 'Your request for admin access was not approved.'
          : status === 'revoked'
            ? 'Your admin access has been removed. Contact a Vorapicks admin.'
            : 'This account does not have admin access.'
    return { ok: false, field: 'email', message }
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
  'order/setFlagged',
  'dispute/review',
  'dispute/resolve',
  'user/setVerified',
  'user/setSuspended',
  'user/setBanned',
  'conversation/read',
  'conversation/send',
  'conversation/close',
  'user/update',
  'admin/approve',
  'admin/reject',
  'admin/revoke',
])

function validAction(action: AdminAction): string | null {
  if (!action || !ACTION_TYPES.has(action.type)) return 'Unknown action'
  if (typeof action.id !== 'string' || !/^[\w-]{1,100}$/.test(action.id)) return 'Invalid id'
  if (action.type === 'dispute/resolve' && action.resolution !== 'refunded' && action.resolution !== 'released') {
    return 'Invalid resolution'
  }
  const flag = { 'order/setFlagged': 'flagged', 'user/setVerified': 'verified', 'user/setSuspended': 'suspended', 'user/setBanned': 'banned' }[
    action.type as string
  ]
  if (flag && typeof (action as Record<string, unknown>)[flag] !== 'boolean') return 'Invalid value'
  if (action.type === 'user/update' && !validateProfile(action).ok) return 'Invalid profile details'
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
  if (action.type.startsWith('admin/') && action.type !== 'admin/approve' && action.id === session.uid) {
    return { ok: false, error: 'You cannot remove your own access.' }
  }
  if (action.type === 'user/update') {
    const profile = validateProfile(action)
    if (profile.ok) action = { ...action, ...profile.value }
  }

  const ref = db().collection(COLLECTIONS[collectionFor(action)]).doc(action.id)
  const result = await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) return null
    const { id, ...next } = applyAction({ ...snapshot.data(), id: snapshot.id }, action)
    transaction.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedBy: session.uid })
    return { ...next, id }
  })
  if (!result) return { ok: false, error: 'Not found' }

  await syncAuth(action, result)
  return { ok: true }
}

// Mirrors a saved change onto the Firebase Auth account so it takes effect
// everywhere, including the mobile apps: suspended or banned users cannot sign
// in and lose their current sessions; admin decisions set the admin claim.
async function syncAuth(action: AdminAction, item: Record<string, unknown>) {
  const auth = adminAuth()
  try {
    if (action.type === 'user/setSuspended' || action.type === 'user/setBanned') {
      const user = item as unknown as AdminUser
      const disabled = user.suspended || user.banned
      await auth.updateUser(action.id, { disabled })
      if (disabled) await auth.revokeRefreshTokens(action.id)
    } else if (action.type === 'user/update') {
      await auth.updateUser(action.id, { displayName: action.name })
    } else if (action.type.startsWith('admin/')) {
      const admin = (item as unknown as AdminAccount).status === 'active'
      const { customClaims } = await auth.getUser(action.id)
      await auth.setCustomUserClaims(action.id, { ...customClaims, admin })
      if (!admin) await auth.revokeRefreshTokens(action.id)
    }
  } catch (error) {
    // Profiles without a Firebase account (none in normal use) have nothing to sync.
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
  }
}
