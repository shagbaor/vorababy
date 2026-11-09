import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { requireUser } from '@/lib/api/auth'
import { optionalText, parseBody, requireProfile, text } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentMe } from '@/lib/server/accounts'
import { useFile } from '@/lib/server/storage'
import { adminAuth, db } from '@/lib/firebase/admin'
import { normalizePhone, USER_ROLES } from '@/lib/users'

export const dynamic = 'force-dynamic'

// The signed-in person's profile (users/{uid}). The app creates the Firebase
// account itself, then registers the profile here once with a role.

const phone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return ''
    const normalized = normalizePhone(value)
    if (!normalized) ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' })
    return normalized ?? ''
  })

export const GET = handle(async (request) => {
  const user = await requireUser(request)
  const me = await presentMe(user)
  if (me.profile && me.profile.status !== 'active') throw new ApiError('account_disabled', 'This account has been suspended. Contact Vorapicks support.')
  return ok(me, me.profile ? 'Profile loaded' : 'Signed in; no profile registered yet')
})

const registerSchema = z.object({
  role: z.enum(USER_ROLES as [string, ...string[]], { errorMap: () => ({ message: 'Choose buyer, seller or rider' }) }),
  name: text(100, 2),
  email: z.string().trim().email('Enter a valid email address').optional(),
  phone: phone.optional(),
  location: optionalText(120),
})

export const POST = handle(async (request) => {
  const user = await requireUser(request)
  const body = await parseBody(request, registerSchema)
  const ref = db().collection('users').doc(user.uid)

  await db().runTransaction(async (transaction) => {
    if ((await transaction.get(ref)).exists) throw new ApiError('conflict', 'A profile is already registered for this account')
    transaction.create(ref, {
      role: body.role,
      name: body.name,
      email: body.email ?? user.email ?? '',
      phone: body.phone || user.phone || '',
      location: body.location ?? '',
      verified: false,
      verificationStatus: body.role === 'buyer' ? 'not_required' : 'incomplete',
      suspended: false,
      banned: false,
      totalOrders: 0,
      activeOrders: 0,
      walletBalanceKobo: 0,
      shoppingMode: 'all',
      createdAt: FieldValue.serverTimestamp(),
    })
  })
  await adminAuth().updateUser(user.uid, { displayName: body.name })
  return ok(await presentMe(user), 'Profile created', 201)
})

const updateSchema = z.object({
  name: text(100, 2).optional(),
  email: z.string().trim().email('Enter a valid email address').optional(),
  phone: phone.optional(),
  location: optionalText(120),
  avatarFileId: z.string().max(100).optional(),
})

export const PATCH = handle(async (request) => {
  const { user, ref } = await requireProfile(request)
  const body = await parseBody(request, updateSchema)
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid }
  for (const key of ['name', 'email', 'phone', 'location'] as const) if (body[key] !== undefined) update[key] = body[key]
  if (body.avatarFileId) update.avatarUrl = (await useFile(user.uid, body.avatarFileId, ['avatar'])).url
  await ref.update(update)
  if (body.name) await adminAuth().updateUser(user.uid, { displayName: body.name })
  return ok(await presentMe(user), 'Profile updated')
})

// Deletes the account and personal data. Orders, payments and reviews are
// kept (anonymised by the missing profile) for the other parties' records.
export const DELETE = handle(async (request) => {
  const { user, ref, profile } = await requireProfile(request)
  if ((profile.walletBalanceKobo ?? 0) > 0) {
    throw new ApiError('conflict', 'Withdraw or spend your wallet balance before deleting your account')
  }
  const active = await db().collection('orders').where('buyerId', '==', user.uid).where('escrowStatus', '==', 'held').limit(1).get()
  if (!active.empty) throw new ApiError('conflict', 'You have orders in progress. Delete your account after they are completed.')

  for (const sub of ['addresses', 'devices', 'cards', 'wishlist', 'notifications']) {
    const docs = await ref.collection(sub).listDocuments()
    await Promise.all(docs.map((d) => d.delete()))
  }
  await Promise.all([
    ref.delete(),
    db().collection('stores').doc(user.uid).update({ verificationStatus: 'deleted', isOpen: false }).catch(() => null),
    db().collection('riders').doc(user.uid).delete().catch(() => null),
    db().collection('carts').doc(user.uid).delete().catch(() => null),
  ])
  await adminAuth().deleteUser(user.uid)
  return ok(null, 'Account deleted')
})

export { methodNotAllowed as PUT }
