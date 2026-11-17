import 'server-only'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { toIso, type Caller } from '@/lib/api/guard'

// The 6-digit PIN sellers and riders enter to withdraw. Stored as a salted
// scrypt hash on users/{uid}.withdrawalPin; nobody can read it back. Five
// wrong tries lock withdrawals for 30 minutes.

const scryptAsync = promisify(scrypt) as (pin: string, salt: Buffer, length: number) => Promise<Buffer>
const MAX_FAILURES = 5
const LOCK_MINUTES = 30

type PinDoc = { hash: string; salt: string; setAt: Timestamp; failures?: number; lockedUntil?: Timestamp | null }

export const isPin = (v: string) => /^\d{6}$/.test(v)

async function hashPin(pin: string, salt: Buffer) {
  return (await scryptAsync(pin, salt, 32)).toString('base64')
}

export function pinStatus(caller: Caller) {
  const pin = caller.profile.withdrawalPin as PinDoc | undefined
  const locked = pin?.lockedUntil && pin.lockedUntil.toMillis() > Date.now() ? pin.lockedUntil : null
  return { hasPin: Boolean(pin), setAt: toIso(pin?.setAt), lockedUntil: toIso(locked) }
}

/** Throws unless [pin] matches; counts failures and locks after too many. */
export async function checkPin(caller: Caller, pin: string | undefined) {
  const stored = caller.profile.withdrawalPin as PinDoc | undefined
  if (!stored) throw new ApiError('conflict', 'Create a withdrawal PIN first', { pin: 'Create a withdrawal PIN first' })
  if (stored.lockedUntil && stored.lockedUntil.toMillis() > Date.now()) {
    throw new ApiError('rate_limited', 'Too many wrong PINs. Try again in 30 minutes or reset your PIN.')
  }
  const ok = Boolean(pin) && timingSafeEqual(Buffer.from(await hashPin(pin!, Buffer.from(stored.salt, 'base64'))), Buffer.from(stored.hash))
  if (!ok) {
    const failures = (stored.failures ?? 0) + 1
    const lock = failures >= MAX_FAILURES
    await caller.ref.update({
      'withdrawalPin.failures': lock ? 0 : failures,
      'withdrawalPin.lockedUntil': lock ? Timestamp.fromMillis(Date.now() + LOCK_MINUTES * 60_000) : null,
    })
    throw new ApiError(
      'validation_failed',
      lock ? 'Too many wrong PINs. Withdrawals are locked for 30 minutes.' : `Incorrect PIN. ${MAX_FAILURES - failures} tries left.`,
      { pin: 'Incorrect PIN' },
    )
  }
  if (stored.failures) await caller.ref.update({ 'withdrawalPin.failures': 0 })
}

/** Creates the PIN, or changes it (the current PIN, or a fresh sign-in for "Forgot PIN", is required). */
export async function setPin(caller: Caller, pin: string, currentPin: string | undefined, recentSignIn: boolean) {
  if (caller.profile.withdrawalPin && !recentSignIn) await checkPin(caller, currentPin)
  const salt = randomBytes(16)
  await caller.ref.update({
    withdrawalPin: { hash: await hashPin(pin, salt), salt: salt.toString('base64'), setAt: FieldValue.serverTimestamp(), failures: 0, lockedUntil: null },
  })
}

export async function removePin(caller: Caller, currentPin: string | undefined) {
  await checkPin(caller, currentPin)
  await caller.ref.update({ withdrawalPin: FieldValue.delete() })
}
