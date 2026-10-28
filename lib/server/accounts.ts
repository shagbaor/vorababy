import { FieldValue, GeoPoint, type DocumentSnapshot } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminAuth, adminDb } from '@/lib/server/firebase-admin'
import { errors } from '@/lib/server/http'
import { toJson, type Role, type UserDoc } from '@/lib/server/model'

// Account lifecycle: sign-up from the app, store and rider registration, and
// the admin actions (verify, suspend, ban, invite). Route handlers stay thin
// and call these.

const name = z.string().trim().min(2, 'Enter at least 2 characters.').max(80, 'Keep it under 80 characters.')
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null)

// ------------------------------------------------------------------ sign-up

export const signupInput = z.object({
  role: z.enum(['buyer', 'seller', 'rider'], { message: 'Choose buyer, seller or rider.' }),
  fullName: name,
  email: z.email('Enter a valid email address.').trim().toLowerCase().optional().nullable().transform((v) => v || null),
})

export async function completeSignup(uid: string, input: z.infer<typeof signupInput>) {
  const db = adminDb()
  const record = await adminAuth().getUser(uid)
  const userRef = db.doc(`users/${uid}`)

  const doc: Omit<UserDoc, 'createdAt' | 'updatedAt'> & { createdAt: FieldValue; updatedAt: FieldValue } = {
    role: input.role,
    fullName: input.fullName,
    email: input.email ?? record.email ?? null,
    phone: record.phoneNumber ?? null,
    photoUrl: null,
    status: 'active',
    verified: false,
    verificationStatus: input.role === 'buyer' ? 'not_required' : 'incomplete',
    storeId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  try {
    // create() fails if the profile exists, so a role can't be switched by signing up twice.
    await userRef.create(doc)
  } catch (error) {
    if ((error as { code?: number }).code === 6) {
      throw errors.conflict('already_registered', 'This account has already been set up.')
    }
    throw error
  }

  await adminAuth().setCustomUserClaims(uid, { role: input.role })
  return getProfile(uid)
}

// ------------------------------------------------------------------ profile

export async function getProfile(uid: string) {
  const db = adminDb()
  const user = await db.doc(`users/${uid}`).get()
  if (!user.exists) return { user: null, store: null, rider: null }

  const data = user.data() as UserDoc
  const [store, rider] = await Promise.all([
    data.storeId ? db.doc(`stores/${data.storeId}`).get() : null,
    data.role === 'rider' ? db.doc(`riders/${uid}`).get() : null,
  ])

  return {
    user: { id: uid, ...(toJson(data) as object) },
    store: store?.exists ? { id: store.id, ...(toJson(store.data()) as object) } : null,
    rider: rider?.exists ? { id: rider.id, ...(toJson(rider.data()) as object) } : null,
  }
}

async function requireProfile(uid: string, role: Role): Promise<DocumentSnapshot> {
  const snap = await adminDb().doc(`users/${uid}`).get()
  if (!snap.exists) throw errors.conflict('signup_incomplete', 'Finish creating your account first.')
  if ((snap.data() as UserDoc).role !== role) throw errors.forbidden()
  return snap
}

// --------------------------------------------------------------- sellers

export const storeInput = z.object({
  name: name,
  type: z.enum(['farm', 'restaurant', 'vendor'], { message: 'Choose farm, restaurant or vendor.' }),
  description: optionalText(600),
  phone: optionalText(30),
  address: z.object({
    line: z.string().trim().min(3, 'Enter the street address.').max(200),
    area: optionalText(80),
    city: z.string().trim().min(2, 'Enter the city.').max(60),
    state: optionalText(60),
  }),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
})

export async function registerStore(uid: string, input: z.infer<typeof storeInput>) {
  const db = adminDb()
  const userRef = db.doc(`users/${uid}`)
  const storeRef = db.collection('stores').doc()

  await db.runTransaction(async (tx) => {
    const user = await tx.get(userRef)
    if (!user.exists) throw errors.conflict('signup_incomplete', 'Finish creating your account first.')
    const data = user.data() as UserDoc
    if (data.role !== 'seller') throw errors.forbidden('Only seller accounts can register a store.')
    if (data.storeId) throw errors.conflict('store_exists', 'You already have a store.')

    tx.create(storeRef, {
      ownerId: uid,
      name: input.name,
      type: input.type,
      description: input.description,
      phone: input.phone,
      logoUrl: null,
      coverUrl: null,
      address: input.address,
      location: new GeoPoint(input.location.lat, input.location.lng),
      isOpen: false,
      openingHours: null,
      verificationStatus: 'pending',
      rating: null,
      ratingCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(userRef, { storeId: storeRef.id, verificationStatus: 'pending', updatedAt: FieldValue.serverTimestamp() })
  })

  return getProfile(uid)
}

// ---------------------------------------------------------------- riders

export const riderInput = z.object({
  vehicleType: z.enum(['motorbike', 'bicycle', 'car', 'van'], { message: 'Choose motorbike, bicycle, car or van.' }),
  plateNumber: optionalText(20),
})

export async function registerRider(uid: string, input: z.infer<typeof riderInput>) {
  if (input.vehicleType !== 'bicycle' && !input.plateNumber) {
    throw errors.invalid('Some fields are missing or invalid.', { plateNumber: 'Enter the plate number.' })
  }
  await requireProfile(uid, 'rider')

  const db = adminDb()
  try {
    await db.doc(`riders/${uid}`).create({
      userId: uid,
      vehicleType: input.vehicleType,
      plateNumber: input.plateNumber?.toUpperCase() ?? null,
      verificationStatus: 'pending',
      isOnline: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    if ((error as { code?: number }).code === 6) {
      throw errors.conflict('rider_exists', 'You have already registered as a rider.')
    }
    throw error
  }
  await db.doc(`users/${uid}`).update({ verificationStatus: 'pending', updatedAt: FieldValue.serverTimestamp() })

  return getProfile(uid)
}

// ---------------------------------------------------------- admin actions

export type AdminAction = 'verify' | 'unverify' | 'suspend' | 'unsuspend' | 'ban' | 'unban'

type Actor = { uid: string; email?: string | null }

export async function applyAdminAction(actor: Actor, targetId: string, action: AdminAction) {
  if (actor.uid === targetId) throw errors.forbidden("You can't change your own account here.")

  const db = adminDb()
  const userRef = db.doc(`users/${targetId}`)
  const snap = await userRef.get()
  if (!snap.exists) throw errors.notFound('User')
  const user = snap.data() as UserDoc
  if (user.role === 'admin') throw errors.forbidden('Admin accounts are managed separately.')

  const batch = db.batch()
  const now = FieldValue.serverTimestamp()
  let signInBlocked: boolean | null = null

  if (action === 'verify' || action === 'unverify') {
    const verified = action === 'verify'
    const needsApproval = user.role === 'seller' || user.role === 'rider'
    if (verified && needsApproval && user.verificationStatus === 'incomplete') {
      throw errors.conflict(
        'registration_incomplete',
        user.role === 'seller' ? "This seller hasn't registered a store yet." : "This rider hasn't added vehicle details yet.",
      )
    }
    const status = needsApproval ? (verified ? 'approved' : 'pending') : 'not_required'
    batch.update(userRef, { verified, verificationStatus: status, updatedAt: now })
    if (user.role === 'seller' && user.storeId) {
      batch.update(db.doc(`stores/${user.storeId}`), { verificationStatus: status, updatedAt: now })
    }
    if (user.role === 'rider') {
      batch.update(db.doc(`riders/${targetId}`), {
        verificationStatus: status,
        ...(verified ? {} : { isOnline: false }),
        updatedAt: now,
      })
    }
  } else {
    const status = action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : 'active'
    if ((action === 'unsuspend' && user.status !== 'suspended') || (action === 'unban' && user.status !== 'banned')) {
      throw errors.conflict('no_change', `This account isn't ${action === 'unban' ? 'banned' : 'suspended'}.`)
    }
    batch.update(userRef, { status, updatedAt: now })
    signInBlocked = status !== 'active'
  }

  batch.create(db.collection('auditLog').doc(), {
    adminId: actor.uid,
    adminEmail: actor.email ?? null,
    action,
    targetId,
    details: { role: user.role, fullName: user.fullName },
    createdAt: now,
  })
  await batch.commit()

  if (signInBlocked !== null) {
    // Disabled accounts can't sign in; revoking tokens signs them out everywhere now.
    await adminAuth().updateUser(targetId, { disabled: signInBlocked })
    if (signInBlocked) await adminAuth().revokeRefreshTokens(targetId)
  }

  return getProfile(targetId)
}

// ------------------------------------------------------------ admin invites

export const inviteInput = z.object({
  fullName: name,
  email: z.email('Enter a valid email address.').trim().toLowerCase(),
})

// Creates the admin's login and returns a one-time link for them to set a
// password. The inviting admin sends the link; Firebase also lets them use
// "Forgot password?" on the sign-in page with the same email.
export async function inviteAdmin(actor: Actor, input: z.infer<typeof inviteInput>, signInUrl: string) {
  const auth = adminAuth()
  const existing = await auth.getUserByEmail(input.email).catch(() => null)
  if (existing) throw errors.conflict('email_in_use', 'An account with this email already exists.')

  const record = await auth.createUser({ email: input.email, displayName: input.fullName, emailVerified: false })
  await auth.setCustomUserClaims(record.uid, { role: 'admin' })

  const db = adminDb()
  const batch = db.batch()
  batch.create(db.doc(`users/${record.uid}`), {
    role: 'admin',
    fullName: input.fullName,
    email: input.email,
    phone: null,
    photoUrl: null,
    status: 'active',
    verified: true,
    verificationStatus: 'not_required',
    storeId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  batch.create(db.collection('auditLog').doc(), {
    adminId: actor.uid,
    adminEmail: actor.email ?? null,
    action: 'invite_admin',
    targetId: record.uid,
    details: { email: input.email, fullName: input.fullName },
    createdAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  const link = await auth.generatePasswordResetLink(input.email, { url: signInUrl })
  return { id: record.uid, email: input.email, setPasswordLink: link }
}
