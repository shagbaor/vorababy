import { FieldValue, type Timestamp } from 'firebase-admin/firestore'
import { requireUser, type ApiUser } from '@/lib/api/auth'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { adminAuth, db } from '@/lib/firebase/admin'
import { USER_ROLES, validateProfile, type ProfileInput } from '@/lib/users'
import type { UserRole } from '@/lib/admin/mock-data'

export const dynamic = 'force-dynamic'

// The signed-in user's marketplace profile (Firestore users/{uid}). The app
// creates the Firebase account itself, then registers the profile here once.

type ProfileDoc = {
  name: string
  email: string
  phone: string
  role: UserRole
  location: string
  verified: boolean
  suspended: boolean
  banned: boolean
  totalOrders: number
  activeOrders: number
  createdAt?: Timestamp
}

const profileRef = (uid: string) => db().collection('users').doc(uid)

function present(user: ApiUser, doc: ProfileDoc | undefined) {
  if (!doc) return { uid: user.uid, email: user.email, phone: user.phone, profile: null }
  return {
    uid: user.uid,
    email: user.email,
    phone: user.phone,
    profile: {
      name: doc.name,
      role: doc.role,
      phone: doc.phone || null,
      location: doc.location || null,
      verified: doc.verified,
      status: doc.banned ? 'banned' : doc.suspended ? 'suspended' : 'active',
      createdAt: doc.createdAt?.toDate().toISOString() ?? null,
    },
  }
}

function checkActive(doc: ProfileDoc | undefined) {
  if (doc?.banned || doc?.suspended) throw new ApiError('account_disabled', 'This account has been suspended. Contact Vorapicks support.')
}

export const GET = handle(async (request) => {
  const user = await requireUser(request)
  const doc = (await profileRef(user.uid).get()).data() as ProfileDoc | undefined
  checkActive(doc)
  return ok(present(user, doc), doc ? 'Profile loaded' : 'Signed in; no profile registered yet')
})

// Register: { "name": "...", "role": "buyer" | "seller" | "rider", "phone"?: "...", "location"?: "..." }
export const POST = handle(async (request) => {
  const user = await requireUser(request)
  const body = await readJson<ProfileInput & { role?: unknown }>(request)

  const result = validateProfile({ ...body, phone: body.phone ?? user.phone ?? '' })
  const role = USER_ROLES.find((r) => r === body.role)
  if (!result.ok || !role) {
    const details = { ...(result.ok ? {} : result.errors), ...(role ? {} : { role: `Role must be one of: ${USER_ROLES.join(', ')}` }) }
    throw new ApiError('validation_failed', 'Some details need fixing', details)
  }

  const ref = profileRef(user.uid)
  await db().runTransaction(async (transaction) => {
    if ((await transaction.get(ref)).exists) throw new ApiError('conflict', 'A profile is already registered for this account')
    transaction.create(ref, {
      ...result.value,
      email: user.email ?? '',
      role,
      verified: false,
      suspended: false,
      banned: false,
      totalOrders: 0,
      activeOrders: 0,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
  await adminAuth().updateUser(user.uid, { displayName: result.value.name })

  const doc = (await ref.get()).data() as ProfileDoc
  return ok(present(user, doc), 'Profile created', 201)
})

// Update: any of { "name", "phone", "location" }. The role cannot be changed here.
export const PATCH = handle(async (request) => {
  const user = await requireUser(request)
  const body = await readJson<ProfileInput>(request)
  const ref = profileRef(user.uid)
  const current = (await ref.get()).data() as ProfileDoc | undefined
  if (!current) throw new ApiError('not_found', 'Register a profile first (POST /api/v1/me)')
  checkActive(current)

  const result = validateProfile({
    name: body.name ?? current.name,
    phone: body.phone ?? current.phone,
    location: body.location ?? current.location,
  })
  if (!result.ok) throw new ApiError('validation_failed', 'Some details need fixing', result.errors)

  await ref.update({ ...result.value, updatedAt: FieldValue.serverTimestamp(), updatedBy: user.uid })
  if (result.value.name !== current.name) await adminAuth().updateUser(user.uid, { displayName: result.value.name })

  return ok(present(user, { ...current, ...result.value }), 'Profile updated')
})

export { methodNotAllowed as PUT, methodNotAllowed as DELETE }
