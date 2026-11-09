import 'server-only'
import type { ApiUser } from '@/lib/api/auth'
import { dueForAutoApproval, toIso, type ProfileDoc } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'
import { isOpenNow } from '@/lib/server/geo'
import { approveIfDue, kycSatisfied, presentVerification } from '@/lib/server/kyc'

// What GET /me returns, and the checks for submitting a seller or rider for
// verification. users/{uid} holds the profile; stores/{uid} and riders/{uid}
// hold the seller's store and the rider's details (same id as the user).

export function verificationStatus(p: ProfileDoc) {
  if (p.role === 'buyer') return 'not_required'
  return p.verificationStatus ?? (p.verified ? 'approved' : 'incomplete')
}

export function presentPayout(p: ProfileDoc) {
  const account = p.payoutAccount as { bankCode: string; bankName: string; accountNumber: string; accountName: string } | undefined
  return account ? { bankCode: account.bankCode, bankName: account.bankName, accountNumberLast4: account.accountNumber.slice(-4), accountName: account.accountName } : null
}

export function presentStore(id: string, s: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: s.name,
    type: s.type,
    tagline: s.tagline ?? null,
    description: s.description ?? null,
    businessType: s.businessType ?? null,
    ownerLegalName: s.ownerLegalName ?? null,
    phone: s.phone ?? null,
    address: s.address,
    location: s.location,
    logoUrl: s.logoUrl ?? null,
    coverUrl: s.coverUrl ?? null,
    isOpen: s.isOpen !== false,
    isOpenNow: isOpenNow(s.isOpen, s.openingHours),
    openingHours: s.openingHours ?? null,
    rating: s.rating ?? null,
    ratingCount: s.ratingCount ?? 0,
    verificationStatus: s.verificationStatus ?? 'incomplete',
    documents: { cac: Boolean(s.documents?.cacFileId), nin: Boolean(s.documents?.ninFileId) },
  }
}

export function presentRider(r: FirebaseFirestore.DocumentData) {
  return {
    legalName: r.legalName ?? null,
    dateOfBirth: r.dateOfBirth ?? null,
    address: r.address ?? null,
    vehicle: r.vehicle ?? null,
    isOnline: Boolean(r.isOnline),
    rating: r.rating ?? null,
    ratingCount: r.ratingCount ?? 0,
    tripCount: r.tripCount ?? 0,
    activeOrderId: r.activeOrderId ?? null,
    verificationStatus: r.verificationStatus ?? 'incomplete',
    documents: { driversLicence: Boolean(r.documents?.driversLicenceFileId), nin: Boolean(r.documents?.ninFileId) },
  }
}

export async function presentMe(user: ApiUser) {
  const snapshot = await db().collection('users').doc(user.uid).get()
  const base = { uid: user.uid, email: user.email, phone: user.phone }
  if (!snapshot.exists) return { ...base, profile: null, store: null, rider: null }

  let p = snapshot.data() as ProfileDoc
  if (dueForAutoApproval(p) && (await approveIfDue(user.uid))) p = (await snapshot.ref.get()).data() as ProfileDoc
  const [store, rider] = await Promise.all([
    p.role === 'seller' ? db().collection('stores').doc(user.uid).get() : null,
    p.role === 'rider' ? db().collection('riders').doc(user.uid).get() : null,
  ])

  return {
    ...base,
    profile: {
      role: p.role,
      name: p.name,
      email: p.email || user.email,
      phone: p.phone || user.phone,
      avatarUrl: (p.avatarUrl as string | undefined) ?? null,
      location: p.location || null,
      status: p.banned ? 'banned' : p.suspended ? 'suspended' : 'active',
      verified: p.verified,
      verificationStatus: verificationStatus(p),
      verificationNote: p.verificationNote ?? null,
      verification: await presentVerification(p),
      shoppingMode: (p.shoppingMode as string | undefined) ?? 'all',
      notifications: { orderUpdates: true, promotions: true, news: false, sms: true, ...(p.notifications as object | undefined) },
      walletBalanceKobo: p.walletBalanceKobo ?? 0,
      payoutAccount: presentPayout(p),
      createdAt: toIso(p.createdAt),
    },
    store: store?.exists ? presentStore(store.id, store.data()!) : null,
    rider: rider?.exists ? presentRider(rider.data()!) : null,
  }
}

// What a seller or rider still has to do before "Submit for review".
export async function missingForReview(uid: string, p: ProfileDoc) {
  const missing: Record<string, string> = {}
  if (!p.payoutAccount) missing.payoutAccount = 'Add your payout bank account'
  if (p.role === 'seller') {
    const store = await db().collection('stores').doc(uid).get()
    if (!store.exists) missing.store = 'Add your business details'
    if (!kycSatisfied(p, 'business', Boolean(store.get('documents.cacFileId')))) missing.cac = 'Verify your CAC number or upload your CAC document'
    if (!kycSatisfied(p, 'identity', Boolean(store.get('documents.ninFileId')))) missing.nin = 'Verify your NIN or upload your NIN document'
  } else if (p.role === 'rider') {
    const rider = await db().collection('riders').doc(uid).get()
    if (!rider.get('legalName')) missing.profile = 'Add your personal details'
    if (!rider.get('vehicle')) missing.vehicle = 'Add your vehicle details'
    if (!kycSatisfied(p, 'licence', Boolean(rider.get('documents.driversLicenceFileId')))) missing.driversLicence = "Verify your driver's licence or upload it"
    if (!kycSatisfied(p, 'identity', Boolean(rider.get('documents.ninFileId')))) missing.nin = 'Verify your NIN and selfie or upload your NIN document'
  }
  return missing
}
