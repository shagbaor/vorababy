import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { isPin, pinStatus, removePin, setPin } from '@/lib/server/withdrawal-pin'

export const dynamic = 'force-dynamic'

const pin = z.string().refine(isPin, 'Use 6 digits')

// Security & PIN: whether a withdrawal PIN is set (never the PIN itself).
export const GET = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller', 'rider'] })
  return ok(pinStatus(caller), 'PIN status loaded')
})

// Create or change the PIN. Changing needs the current PIN, or a sign-in in
// the last 5 minutes ("Forgot PIN?": sign in again, then set a new one).
export const PUT = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller', 'rider'] })
  const body = await parseBody(request, z.object({ pin, currentPin: pin.optional() }))
  const recentSignIn = Date.now() / 1000 - (caller.user.authTime ?? 0) < 5 * 60
  await setPin(caller, body.pin, body.currentPin, recentSignIn)
  return ok({ hasPin: true, setAt: new Date().toISOString(), lockedUntil: null }, 'Withdrawal PIN saved')
})

// "Delete PIN": needs the current PIN.
export const DELETE = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller', 'rider'] })
  const body = await parseBody(request, z.object({ currentPin: pin }))
  await removePin(caller, body.currentPin)
  return ok({ hasPin: false, setAt: null, lockedUntil: null }, 'Withdrawal PIN removed')
})

export { methodNotAllowed as POST, methodNotAllowed as PATCH }
