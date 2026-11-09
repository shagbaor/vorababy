import 'server-only'
import { createHash } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { toIso, type Caller, type ProfileDoc } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'
import { DojahError, dojahConfigured, liveness, lookupCac, lookupLicence, lookupNin, verifyNinWithSelfie } from '@/lib/server/dojah'
import { notify } from '@/lib/server/notify'
import { getSettings } from '@/lib/server/settings'

// Instant identity checks with Dojah (users/{uid}.kyc):
//   identity  NIN (+ selfie match and liveness for riders): sellers and riders
//   business  CAC registration: sellers
//   licence   driver's licence: riders
// Each check is verified, failed (with a reason; retry allowed), pending
// (Dojah unavailable: a person reviews it) or review (attempts used up or a
// fraud signal: a person reviews it). Sellers and riders whose required
// checks are all verified are approved automatically `autoApproveMinutes`
// after submitting, unless an admin approves or rejects them first.

export type CheckName = 'identity' | 'business' | 'licence'
export type CheckStatus = 'not_started' | 'verified' | 'failed' | 'pending' | 'review'

export type CheckDoc = {
  status: CheckStatus
  reason: string | null
  attempts: number
  checkedAt: Timestamp
  details: Record<string, string | number | boolean | null>
}

export const REQUIRED: Record<'seller' | 'rider', CheckName[]> = {
  seller: ['identity', 'business'],
  rider: ['identity', 'licence'],
}

export const REASONS: Record<string, string> = {
  nin_not_found: "We couldn't find this NIN. Check the 11 digits and try again.",
  name_mismatch: "The name on this record doesn't match the name you gave us. Check your details and try again.",
  dob_mismatch: "The date of birth on your NIN doesn't match the one you gave us.",
  face_mismatch: "Your selfie doesn't match the photo on your NIN. Try again in good light, facing the camera.",
  liveness_failed: "We couldn't confirm a live selfie. Take it again yourself, facing the camera, without glasses or a hat.",
  no_nin_photo: 'Your NIN has no photo we can compare with. Our team will review your account.',
  nin_in_use: 'This NIN is already linked to another Vorapicks account. Our team will review your account.',
  cac_in_use: 'This business is already linked to another Vorapicks account. Our team will review your account.',
  cac_not_found: "We couldn't find this business. Check the RC/BN number and the business type.",
  cac_inactive: 'This business is not active on the CAC register.',
  licence_not_found: "We couldn't find this driver's licence. Check the number and try again.",
  licence_expired: "This driver's licence has expired.",
  provider_unavailable: 'Verification is busy right now. Our team will review your details instead, or you can try again later.',
  too_many_attempts: 'Too many attempts. Our team will review your details within 24–48 hours.',
}

const hash = (value: string) => createHash('sha256').update(`vorapicks-kyc:${value}`).digest('hex')

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 1)

// The given legal name must contain the record's first and last names (any
// order, middle names optional), or at least two of the record's names.
export function namesMatch(given: string, record: { firstName: string; middleName?: string; lastName: string }) {
  const mine = new Set(words(given))
  const first = words(record.firstName)
  const last = words(record.lastName)
  const all = [...first, ...words(record.middleName ?? ''), ...last]
  if (!all.length) return false
  const hits = all.filter((w) => mine.has(w)).length
  return (first.some((w) => mine.has(w)) && last.some((w) => mine.has(w))) || hits >= 2
}

// Dates come back as YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY.
function isoDate(value: string | null | undefined) {
  if (!value) return null
  const v = value.trim()
  let m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  m = v.toLowerCase().match(/^(\d{1,2})[-\s]([a-z]{3})[a-z]*[-\s](\d{4})/)
  if (m && months.includes(m[2])) return `${m[3]}-${String(months.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

type Outcome = { status: 'verified' | 'failed' | 'pending' | 'review'; reason: string | null; details: CheckDoc['details']; countsAsAttempt: boolean }

// Runs a check and stores the result. Failures use up an attempt; after the
// last one the check goes to a person.
async function record(caller: Caller, name: CheckName, run: () => Promise<Outcome>) {
  if (caller.profile.role !== 'seller' && caller.profile.role !== 'rider') throw new ApiError('forbidden', 'Only sellers and riders verify their identity')
  if (!REQUIRED[caller.profile.role].includes(name)) throw new ApiError('not_found', 'This check is not needed for your account')
  const status = caller.profile.verificationStatus
  if (status === 'pending' || status === 'approved') throw new ApiError('conflict', status === 'approved' ? 'Your account is already approved' : 'Your details are being reviewed')
  if (!dojahConfigured()) throw new ApiError('conflict', 'Instant verification is not available yet. Upload your documents instead.')

  const { kycMaxAttempts } = await getSettings()
  const current = (caller.profile.kyc as Record<string, CheckDoc> | undefined)?.[name]
  if (current?.status === 'verified') throw new ApiError('conflict', 'Already verified')
  if (current?.status === 'review') throw new ApiError('conflict', REASONS.too_many_attempts)

  let outcome: Outcome
  try {
    outcome = await run()
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DojahError && !error.notFound) {
      console.error('dojah', name, error.message)
      outcome = { status: 'pending', reason: 'provider_unavailable', details: {}, countsAsAttempt: false }
    } else throw error
  }
  const attempts = (current?.attempts ?? 0) + (outcome.countsAsAttempt ? 1 : 0)
  if (outcome.status === 'failed' && attempts >= kycMaxAttempts) outcome = { ...outcome, status: 'review' }
  const doc: CheckDoc = { status: outcome.status, reason: outcome.reason, attempts, checkedAt: Timestamp.now(), details: outcome.details }
  await caller.ref.update({ [`kyc.${name}`]: doc, updatedAt: FieldValue.serverTimestamp() })
  return presentCheck(name, doc, kycMaxAttempts)
}

const last4 = (v: string) => v.slice(-4)

export async function checkIdentity(caller: Caller, input: { nin: string; selfieImage?: string }) {
  const role = caller.profile.role
  const extra = role === 'rider' ? await db().collection('riders').doc(caller.user.uid).get() : await db().collection('stores').doc(caller.user.uid).get()
  const legalName = (role === 'rider' ? extra.get('legalName') : extra.get('ownerLegalName')) as string | undefined
  if (!legalName) throw new ApiError('conflict', role === 'rider' ? 'Add your personal details first' : 'Add your business details first')
  if (role === 'rider' && !input.selfieImage) throw new ApiError('validation_failed', 'Take a selfie', { selfieImage: 'Take a selfie' })
  const { kycFaceMatchThreshold } = await getSettings()

  return record(caller, 'identity', async (): Promise<Outcome> => {
    const ninHash = hash(input.nin)
    const owner = await db().collection('kycIndex').doc(`nin_${ninHash}`).get()
    const base = { ninLast4: last4(input.nin), legalName }
    if (owner.exists && owner.get('uid') !== caller.user.uid) {
      return { status: 'review', reason: 'nin_in_use', details: { ...base }, countsAsAttempt: false }
    }
    let person
    try {
      person = input.selfieImage ? await verifyNinWithSelfie(input.nin, input.selfieImage, kycFaceMatchThreshold) : await lookupNin(input.nin)
    } catch (error) {
      if (error instanceof DojahError && error.notFound) return { status: 'failed', reason: 'nin_not_found', details: base, countsAsAttempt: true }
      throw error
    }
    const details = { ...base, firstName: person.firstName, middleName: person.middleName, lastName: person.lastName, dateOfBirth: isoDate(person.dateOfBirth) }
    if (!namesMatch(legalName, person)) return { status: 'failed', reason: 'name_mismatch', details, countsAsAttempt: true }
    if (role === 'rider') {
      const given = extra.get('dateOfBirth') as string | undefined
      if (given && details.dateOfBirth && given !== details.dateOfBirth) return { status: 'failed', reason: 'dob_mismatch', details, countsAsAttempt: true }
    }
    if (input.selfieImage) {
      if (person.selfieMatch === undefined) return { status: 'review', reason: 'no_nin_photo', details, countsAsAttempt: false }
      const withFace = { ...details, faceConfidence: person.selfieConfidence ?? null }
      if (!person.selfieMatch) return { status: 'failed', reason: 'face_mismatch', details: withFace, countsAsAttempt: true }
      const live = await liveness(input.selfieImage)
      const withLive = { ...withFace, liveness: live.probability }
      if (!live.live) return { status: 'failed', reason: 'liveness_failed', details: withLive, countsAsAttempt: true }
      await db().collection('kycIndex').doc(`nin_${ninHash}`).set({ uid: caller.user.uid, at: FieldValue.serverTimestamp() })
      return { status: 'verified', reason: null, details: withLive, countsAsAttempt: true }
    }
    await db().collection('kycIndex').doc(`nin_${ninHash}`).set({ uid: caller.user.uid, at: FieldValue.serverTimestamp() })
    return { status: 'verified', reason: null, details, countsAsAttempt: true }
  })
}

export const COMPANY_TYPES = ['BUSINESS_NAME', 'COMPANY', 'INCORPORATED_TRUSTEES', 'LIMITED_PARTNERSHIP', 'LIMITED_LIABILITY_PARTNERSHIP'] as const

export async function checkBusiness(caller: Caller, input: { rcNumber: string; companyType: (typeof COMPANY_TYPES)[number] }) {
  const store = await db().collection('stores').doc(caller.user.uid).get()
  if (!store.exists) throw new ApiError('conflict', 'Add your business details first')
  return record(caller, 'business', async (): Promise<Outcome> => {
    const rcNumber = input.rcNumber.replace(/^(rc|bn)\s*/i, '')
    const owner = await db().collection('kycIndex').doc(`cac_${hash(rcNumber)}`).get()
    if (owner.exists && owner.get('uid') !== caller.user.uid) {
      return { status: 'review', reason: 'cac_in_use', details: { rcNumber }, countsAsAttempt: false }
    }
    let company
    try {
      company = await lookupCac(rcNumber, input.companyType)
    } catch (error) {
      if (error instanceof DojahError && error.notFound) return { status: 'failed', reason: 'cac_not_found', details: { rcNumber }, countsAsAttempt: true }
      throw error
    }
    const details = { rcNumber, companyName: company.companyName, companyStatus: company.status, companyType: company.type ?? input.companyType }
    if (company.status && /inactive|struck|dissolved|liquidat/i.test(company.status)) return { status: 'failed', reason: 'cac_inactive', details, countsAsAttempt: true }
    await db().collection('kycIndex').doc(`cac_${hash(rcNumber)}`).set({ uid: caller.user.uid, at: FieldValue.serverTimestamp() })
    await store.ref.update({ registeredName: company.companyName, rcNumber })
    return { status: 'verified', reason: null, details, countsAsAttempt: true }
  })
}

export async function checkLicence(caller: Caller, input: { licenceNumber: string }) {
  const rider = await db().collection('riders').doc(caller.user.uid).get()
  const legalName = rider.get('legalName') as string | undefined
  if (!legalName) throw new ApiError('conflict', 'Add your personal details first')
  return record(caller, 'licence', async (): Promise<Outcome> => {
    const number = input.licenceNumber.toUpperCase().replace(/\s/g, '')
    const base = { licenceLast4: last4(number), legalName }
    let licence
    try {
      licence = await lookupLicence(number)
    } catch (error) {
      if (error instanceof DojahError && error.notFound) return { status: 'failed', reason: 'licence_not_found', details: base, countsAsAttempt: true }
      throw error
    }
    const expiry = isoDate(licence.expiryDate)
    const details = { ...base, firstName: licence.firstName, lastName: licence.lastName, expiryDate: expiry }
    if (!namesMatch(legalName, licence)) return { status: 'failed', reason: 'name_mismatch', details, countsAsAttempt: true }
    if (expiry && expiry < new Date().toISOString().slice(0, 10)) return { status: 'failed', reason: 'licence_expired', details, countsAsAttempt: true }
    return { status: 'verified', reason: null, details, countsAsAttempt: true }
  })
}

export function presentCheck(name: CheckName, c: CheckDoc | undefined, maxAttempts: number) {
  const status: CheckStatus = c?.status ?? 'not_started'
  return {
    check: name,
    status,
    reason: c?.reason ?? null,
    message: c?.reason ? (REASONS[c.reason] ?? null) : status === 'verified' ? 'Verified' : null,
    attemptsLeft: status === 'failed' || status === 'not_started' ? Math.max(0, maxAttempts - (c?.attempts ?? 0)) : 0,
    checkedAt: toIso(c?.checkedAt),
  }
}

export async function presentVerification(p: ProfileDoc) {
  if (p.role !== 'seller' && p.role !== 'rider') return null
  const { kycMaxAttempts } = await getSettings()
  const kyc = (p.kyc ?? {}) as Record<string, CheckDoc>
  const checks = REQUIRED[p.role].map((name) => presentCheck(name, kyc[name], kycMaxAttempts))
  return {
    instantAvailable: dojahConfigured(),
    checks,
    allVerified: checks.every((c) => c.status === 'verified'),
    reviewMode: (p.reviewMode as string | undefined) ?? null,
    autoApproveAt: toIso(p.autoApproveAt),
  }
}

// What submitForReview needs per check: a verified, pending or review result,
// or (the fallback, as in the designs) an uploaded document.
export function kycSatisfied(p: ProfileDoc, name: CheckName, hasDocument: boolean) {
  const status = ((p.kyc ?? {}) as Record<string, CheckDoc>)[name]?.status
  return hasDocument || status === 'verified' || status === 'pending' || status === 'review'
}

export function allVerified(p: ProfileDoc) {
  if (p.role !== 'seller' && p.role !== 'rider') return false
  const kyc = (p.kyc ?? {}) as Record<string, CheckDoc>
  return REQUIRED[p.role].every((name) => kyc[name]?.status === 'verified')
}

// Approves one seller or rider whose auto-approval time has passed. Safe to
// call repeatedly; does nothing unless still pending in auto mode.
export async function approveIfDue(uid: string) {
  const ref = db().collection('users').doc(uid)
  const approved = await db().runTransaction(async (t) => {
    const p = (await t.get(ref)).data() as ProfileDoc | undefined
    const at = (p?.autoApproveAt as Timestamp | undefined)?.toMillis() ?? Infinity
    if (!p || p.verificationStatus !== 'pending' || p.reviewMode !== 'auto' || at > Date.now()) return null
    t.update(ref, { verificationStatus: 'approved', verified: true, approvedAt: FieldValue.serverTimestamp(), approvedBy: 'auto', updatedAt: FieldValue.serverTimestamp() })
    t.set(db().collection(p.role === 'seller' ? 'stores' : 'riders').doc(uid), { verificationStatus: 'approved' }, { merge: true })
    return p.role
  })
  if (approved) {
    await notify(uid, 'verification', 'You are verified', approved === 'seller' ? 'Your store is approved. You can publish products now.' : 'Your rider account is approved. Go online to receive jobs.')
  }
  return Boolean(approved)
}

// Everyone whose time has come (admin app load and the daily cron).
export async function approveAllDue() {
  const snapshot = await db().collection('users').where('reviewMode', '==', 'auto').where('verificationStatus', '==', 'pending').get()
  let n = 0
  for (const d of snapshot.docs) {
    const at = (d.get('autoApproveAt') as Timestamp | undefined)?.toMillis() ?? Infinity
    if (at <= Date.now() && (await approveIfDue(d.id))) n += 1
  }
  return n
}
