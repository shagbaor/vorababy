import 'server-only'
import type { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore'
import { z } from 'zod'
import { latLng, optionalText, text } from '@/lib/api/guard'
import { ApiError } from '@/lib/api/response'

// Saved delivery addresses: users/{uid}/addresses/{id}.

export const addressSchema = z.object({
  label: text(40),
  line: text(200),
  area: optionalText(100),
  city: text(80),
  state: optionalText(80),
  location: latLng,
  instructions: optionalText(200),
  isDefault: z.boolean().optional(),
})

export type Address = z.infer<typeof addressSchema>

export function presentAddress(doc: DocumentSnapshot) {
  const a = doc.data()!
  return {
    id: doc.id,
    label: a.label,
    line: a.line,
    area: a.area ?? null,
    city: a.city,
    state: a.state ?? null,
    location: a.location,
    instructions: a.instructions ?? null,
    isDefault: Boolean(a.isDefault),
  }
}

export async function listAddresses(user: DocumentReference) {
  const snapshot = await user.collection('addresses').orderBy('createdAt', 'desc').get()
  return snapshot.docs.map(presentAddress).sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

// Resolves either a saved address id or an address given inline at checkout.
export async function resolveAddress(user: DocumentReference, input: { addressId?: string; address?: Address }) {
  if (input.addressId) {
    const doc = await user.collection('addresses').doc(input.addressId).get()
    if (!doc.exists) throw new ApiError('validation_failed', 'Address not found', { addressId: 'Choose a saved address' })
    const { id: _id, isDefault: _d, ...address } = presentAddress(doc)
    return address
  }
  if (input.address) return { ...input.address, area: input.address.area ?? null, state: input.address.state ?? null, instructions: input.address.instructions ?? null }
  const fallback = (await listAddresses(user)).find((a) => a.isDefault)
  if (!fallback) throw new ApiError('validation_failed', 'Add a delivery address', { address: 'Add a delivery address' })
  const { id: _id, isDefault: _d, ...address } = fallback
  return address
}
