'use server'

import { cookies, headers } from 'next/headers'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, db, webApiKey } from '@/lib/firebase/admin'
import { getAdminSession } from '@/lib/admin/session'
import { allowAttempt } from '@/lib/admin/rate-limit'
import { COLLECTIONS, DEFAULT_COMMISSION_RATE, isAppOrder } from '@/lib/admin/data'
import { refundOrder, releaseOrder } from '@/lib/server/orders'
import { ApiError } from '@/lib/api/response'
import { EMAIL_PATTERN, passwordValid, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/admin/auth'
import { applyAction, collectionFor, MAX_MESSAGE_LENGTH, type AdminAction } from '@/lib/admin/admin-actions'
import type { AdminAccount, AdminUser } from '@/lib/admin/mock-data'
import { validateProfile } from '@/lib/users'
import { notify } from '@/lib/server/notify'

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

  return startSession(body.idToken)
}

// Shared by password and Google sign-in: only approved admins get a session;
// everyone else learns where their account stands.
async function startSession(idToken: string): Promise<SignInResult> {
  const token = await adminAuth().verifyIdToken(idToken)
  const status = (await db().collection(COLLECTIONS.admins).doc(token.uid).get()).get('status')
  if (status !== 'active') {
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

  const session = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE * 1000 })
  ;(await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return { ok: true }
}

// Google sign-in (login and sign-up pages). A Google account seen for the first
// time becomes a pending admin request, like the sign-up form; approved admins
// are signed straight in.
export type GoogleSignInResult = { ok: true } | { ok: false; message: string; requested?: boolean }

export async function signInWithGoogle(idToken: string): Promise<GoogleSignInResult> {
  if (typeof idToken !== 'string' || !idToken) return { ok: false, message: 'Google sign-in failed. Try again.' }

  let token
  try {
    token = await adminAuth().verifyIdToken(idToken)
  } catch {
    return { ok: false, message: 'Google sign-in failed. Try again.' }
  }
  if (token.firebase.sign_in_provider !== 'google.com') return { ok: false, message: 'Google sign-in failed. Try again.' }

  const ref = db().collection(COLLECTIONS.admins).doc(token.uid)
  if (!(await ref.get()).exists) {
    const refused = await requestQuota()
    if (refused) return { ok: false, message: refused }
    const fullName = (token.name as string | undefined)?.trim() || token.email?.split('@')[0] || 'New admin'
    await ref.create({
      fullName,
      email: token.email ?? '',
      phone: '',
      provider: 'google',
      status: 'pending',
      role: 'admin',
      createdAt: FieldValue.serverTimestamp(),
    })
    return {
      ok: false,
      requested: true,
      message: 'Request sent. You can sign in with Google once a Vorapicks admin approves your account.',
    }
  }

  const result = await startSession(idToken)
  return result.ok ? result : { ok: false, message: result.message }
}

export async function signOut() {
  const session = await getAdminSession()
  if (session) await adminAuth().revokeRefreshTokens(session.uid)
  ;(await cookies()).delete(SESSION_COOKIE)
}

// ---------------------------------------------------------------------------
// Sign up: creates the Firebase user and a pending admins/{uid} record. The
// account cannot sign in until a super admin approves it.
// ---------------------------------------------------------------------------

const MAX_PENDING_REQUESTS = 25

// Limits new admin requests (sign-up form and first-time Google sign-in) to a
// few per network per hour, and the queue to MAX_PENDING_REQUESTS.
async function requestQuota(): Promise<string | null> {
  if (!(await allowAttempt('admin-request', 5, 60))) return 'Too many sign-up attempts from this network. Try again in an hour.'
  const pending = (await db().collection(COLLECTIONS.admins).where('status', '==', 'pending').count().get()).data().count
  if (pending >= MAX_PENDING_REQUESTS) {
    return 'Too many sign-up requests are waiting right now. Try again later or contact a Vorapicks admin.'
  }
  return null
}

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

  const refused = await requestQuota()
  if (refused) return { ok: false, field: 'email', message: refused }

  const phoneNumber = `+234${phoneDigits}`
  try {
    const user = await adminAuth().createUser({ email, password, displayName: fullName, phoneNumber })
    await db().collection(COLLECTIONS.admins).doc(user.uid).set({
      fullName,
      email,
      phone: phoneNumber,
      status: 'pending',
      role: 'admin',
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
// Password reset: Firebase emails a reset link. The reply is the same whether
// or not the email has an account, so the form cannot be used to find accounts.
// ---------------------------------------------------------------------------

const RESET_RETURN_HOSTS = ['vorapicks.com', 'www.vorapicks.com', 'vorababy.vercel.app', 'localhost']

export type ResetResult = { ok: true } | { ok: false; message: string }

export async function requestPasswordReset(email: string): Promise<ResetResult> {
  const address = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_PATTERN.test(address) || address.length > 254) return { ok: false, message: 'Enter a valid email address' }
  if (!(await allowAttempt('password-reset', 5, 60))) {
    return { ok: false, message: 'Too many reset requests from this network. Try again in an hour.' }
  }

  // After resetting, Firebase's page links back to our login when the host is
  // one Firebase allows.
  const host = (await headers()).get('host')?.split(':')[0] ?? ''
  const continueUrl = RESET_RETURN_HOSTS.includes(host)
    ? `${host === 'localhost' ? 'http' : 'https'}://${(await headers()).get('host')}/admin/login`
    : undefined

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${webApiKey()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: address, ...(continueUrl && { continueUrl }) }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const code = ((await response.json()) as { error?: { message?: string } }).error?.message ?? ''
    // Unknown emails are reported as sent; anything else is a real failure.
    if (!code.startsWith('EMAIL_NOT_FOUND')) {
      console.error(`Password reset failed: ${code}`)
      return { ok: false, message: 'Could not send the reset email. Try again later.' }
    }
  }
  return { ok: true }
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
  'admin/setSuper',
])

function validAction(action: AdminAction): string | null {
  if (!action || !ACTION_TYPES.has(action.type)) return 'Unknown action'
  if (typeof action.id !== 'string' || !/^[\w-]{1,100}$/.test(action.id)) return 'Invalid id'
  if (action.type === 'dispute/resolve' && action.resolution !== 'refunded' && action.resolution !== 'released') {
    return 'Invalid resolution'
  }
  const flag = {
    'order/setFlagged': 'flagged',
    'user/setVerified': 'verified',
    'user/setSuspended': 'suspended',
    'user/setBanned': 'banned',
    'admin/setSuper': 'superAdmin',
  }[
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
  if (action.type.startsWith('admin/')) {
    if (!session.superAdmin) return { ok: false, error: 'Only super admins can manage the admin team.' }
    if (action.type !== 'admin/approve' && action.id === session.uid) return { ok: false, error: 'You cannot change your own access.' }
  }
  if (action.type === 'user/update') {
    const profile = validateProfile(action)
    if (profile.ok) action = { ...action, ...profile.value }
  }

  // Real orders from the apps move real money: settle them through escrow.
  const settled = await settleAppOrder(action, session.uid)
  if (settled) return settled

  const ref = db().collection(COLLECTIONS[collectionFor(action)]).doc(action.id)
  const commissionRate =
    action.type === 'order/release'
      ? (((await db().collection(COLLECTIONS.meta).doc('settings').get()).get('commissionRate') as number | undefined) ?? DEFAULT_COMMISSION_RATE)
      : 0
  const result = await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) return null
    const { id, ...next } = applyAction({ ...snapshot.data(), id: snapshot.id }, action)
    // Never leave the team without an active super admin.
    if (snapshot.get('role') === 'super' && snapshot.get('status') === 'active' && ((next as Record<string, unknown>).role !== 'super' || (next as Record<string, unknown>).status !== 'active')) {
      const supers = await transaction.get(
        db().collection(COLLECTIONS.admins).where('status', '==', 'active').where('role', '==', 'super').count(),
      )
      if (supers.data().count <= 1) return 'last-super' as const
    }
    // Releasing an order is when Vorapicks earns its commission; record when,
    // and how much, for the earnings figures.
    const money =
      action.type === 'order/release' && snapshot.get('status') !== 'released'
        ? { releasedAt: FieldValue.serverTimestamp(), platformFee: Math.round((snapshot.get('amount') as number) * commissionRate) }
        : action.type === 'order/refund' && snapshot.get('status') !== 'refunded'
          ? { refundedAt: FieldValue.serverTimestamp(), platformFee: 0 }
          : {}
    transaction.set(ref, { ...next, ...money, updatedAt: FieldValue.serverTimestamp(), updatedBy: session.uid })
    return { ...next, id }
  })
  if (!result) return { ok: false, error: 'Not found' }
  if (result === 'last-super') return { ok: false, error: 'At least one super admin must remain.' }

  await syncAuth(action, result)
  return { ok: true }
}

async function settleAppOrder(action: AdminAction, adminUid: string): Promise<ActionResult | null> {
  let orderId: string | null = null
  let outcome: 'release' | 'refund' | null = null
  if (action.type === 'order/release' || action.type === 'order/refund') {
    orderId = action.id
    outcome = action.type === 'order/release' ? 'release' : 'refund'
  } else if (action.type === 'dispute/resolve') {
    const dispute = await db().collection(COLLECTIONS.disputes).doc(action.id).get()
    orderId = (dispute.get('orderId') as string | undefined) ?? null
    outcome = action.resolution === 'released' ? 'release' : 'refund'
  }
  if (!orderId || !outcome) return null
  const order = await db().collection(COLLECTIONS.orders).doc(orderId).get()
  if (!order.exists || !isAppOrder(order)) return null

  try {
    if (order.get('escrowStatus') === 'held') {
      if (outcome === 'release') await releaseOrder(orderId, { uid: adminUid, role: 'admin' })
      else await refundOrder(orderId, { uid: adminUid, role: 'admin' }, 'Refunded by Vorapicks support.')
    }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message }
    throw error
  }
  if (action.type === 'dispute/resolve') {
    await db().collection(COLLECTIONS.disputes).doc(action.id).update({ status: 'resolved', resolution: action.resolution, resolvedBy: adminUid, updatedAt: FieldValue.serverTimestamp() })
  }
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
      // A suspended seller's shop disappears from the app; a suspended rider goes offline.
      if (user.role === 'seller') await db().collection('stores').doc(action.id).set({ ownerActive: !disabled }, { merge: true })
      if (user.role === 'rider' && disabled) await db().collection('riders').doc(action.id).set({ isOnline: false }, { merge: true })
    } else if (action.type === 'user/setVerified') {
      // Sellers' stores and riders' records mirror the decision; buyers only get the badge.
      const user = item as unknown as AdminUser
      if (user.role !== 'buyer') {
        const status = user.verificationStatus ?? (user.verified ? 'approved' : 'rejected')
        await db().collection(user.role === 'seller' ? 'stores' : 'riders').doc(action.id).set({ verificationStatus: status }, { merge: true })
        await notify(
          action.id,
          'verification',
          status === 'approved' ? 'You are verified' : 'Verification update',
          status === 'approved'
            ? user.role === 'seller'
              ? 'Your store is approved. You can publish products now.'
              : 'Your rider account is approved. Go online to receive jobs.'
            : 'We could not approve your account yet. Check your details in the app and submit again.',
        )
      }
    } else if (action.type === 'user/update') {
      await auth.updateUser(action.id, { displayName: action.name })
    } else if (action.type.startsWith('admin/')) {
      const account = item as unknown as AdminAccount
      const admin = account.status === 'active'
      const { customClaims } = await auth.getUser(action.id)
      await auth.setCustomUserClaims(action.id, { ...customClaims, admin, superAdmin: admin && account.role === 'super' })
      if (!admin) await auth.revokeRefreshTokens(action.id)
    }
  } catch (error) {
    // Profiles without a Firebase account (none in normal use) have nothing to sync.
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
  }
}
