import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { addressFields, latLng, optionalText, text, type Caller } from '@/lib/api/guard'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { missingForReview, verificationStatus } from '@/lib/server/accounts'

// Seller and rider onboarding: details, documents, then "submit for review".
// Admins approve in the admin app (Users → Verify User).

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour')
const day = z.object({ open: time, close: time }).nullable()
export const openingHoursSchema = z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day })

export const storeSchema = z.object({
  name: text(80, 2),
  ownerLegalName: text(100, 2),
  type: z.enum(['farm', 'restaurant', 'vendor']),
  businessType: text(60),
  tagline: optionalText(100),
  description: optionalText(500),
  phone: optionalText(20),
  address: addressFields,
  location: latLng,
})

export const storeUpdateSchema = storeSchema.partial().extend({
  logoFileId: z.string().max(100).optional(),
  coverFileId: z.string().max(100).optional(),
  isOpen: z.boolean().optional(),
  openingHours: openingHoursSchema.nullable().optional(),
})

export const riderProfileSchema = z.object({
  legalName: text(100, 2),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((value) => {
      const age = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      return age >= 18 && age < 100
    }, 'Riders must be at least 18'),
  address: addressFields,
})

export const vehicleSchema = z.object({
  type: z.enum(['motorcycle', 'bicycle', 'car', 'van']),
  plateNumber: optionalText(20),
  color: text(30),
  makeModel: text(60),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
}).refine((v) => v.type === 'bicycle' || Boolean(v.plateNumber), { message: 'Enter the licence plate', path: ['plateNumber'] })

// Details can change while incomplete or rejected; once pending, wait for the
// review. Approved sellers can still edit their store page.
export function assertEditable(caller: Caller, kind: 'details' | 'documents') {
  const status = verificationStatus(caller.profile)
  if (status === 'pending') throw new ApiError('conflict', 'Your details are being reviewed. You can edit them after the review.')
  if (status === 'approved' && kind === 'documents') throw new ApiError('conflict', 'Your documents are already approved')
}

export async function submitForReview(caller: Caller) {
  const status = verificationStatus(caller.profile)
  if (status === 'pending') throw new ApiError('conflict', 'Already submitted. We will notify you within 24–48 hours.')
  if (status === 'approved') throw new ApiError('conflict', 'Your account is already approved')
  const missing = await missingForReview(caller.user.uid, caller.profile)
  if (Object.keys(missing).length) throw new ApiError('validation_failed', 'Some steps are not finished yet', missing)

  const now = FieldValue.serverTimestamp()
  const batch = db().batch()
  batch.update(caller.ref, { verificationStatus: 'pending', verificationNote: FieldValue.delete(), submittedAt: now, updatedAt: now })
  batch.update(db().collection(caller.profile.role === 'seller' ? 'stores' : 'riders').doc(caller.user.uid), { verificationStatus: 'pending', updatedAt: now })
  await batch.commit()
}
