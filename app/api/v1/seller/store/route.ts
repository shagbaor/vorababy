import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentStore, verificationStatus } from '@/lib/server/accounts'
import { useFile } from '@/lib/server/storage'
import { assertEditable, storeSchema, storeUpdateSchema } from '@/lib/server/verification'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// The seller's store (stores/{uid}): onboarding step 1 and Edit Business Information.

export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const store = await db().collection('stores').doc(user.uid).get()
  if (!store.exists) throw new ApiError('not_found', 'Add your business details first')
  return ok(presentStore(store.id, store.data()!), 'Store loaded')
})

export const PUT = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller'] })
  assertEditable(caller, 'details')
  const body = await parseBody(request, storeSchema)
  const ref = db().collection('stores').doc(caller.user.uid)
  const existing = await ref.get()
  await ref.set(
    {
      ...body,
      nameLower: body.name.toLowerCase(),
      ownerId: caller.user.uid,
      verificationStatus: verificationStatus(caller.profile),
      ...(!existing.exists && { isOpen: true, rating: null, ratingCount: 0, createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await caller.ref.update({ location: `${body.address.city}${body.address.state ? `, ${body.address.state}` : ''}` })
  const store = await ref.get()
  return ok(presentStore(store.id, store.data()!), 'Business details saved')
})

export const PATCH = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller'] })
  const body = await parseBody(request, storeUpdateSchema)
  const ref = db().collection('stores').doc(caller.user.uid)
  if (!(await ref.get()).exists) throw new ApiError('not_found', 'Add your business details first')

  const { logoFileId, coverFileId, ...fields } = body
  const changesDetails = ['name', 'ownerLegalName', 'type', 'businessType', 'address', 'location'].some((k) => k in fields)
  if (changesDetails) assertEditable(caller, 'details')

  const update: Record<string, unknown> = { ...fields, updatedAt: FieldValue.serverTimestamp() }
  if (fields.name) update.nameLower = fields.name.toLowerCase()
  if (logoFileId) update.logoUrl = (await useFile(caller.user.uid, logoFileId, ['store_logo'])).url
  if (coverFileId) update.coverUrl = (await useFile(caller.user.uid, coverFileId, ['store_cover'])).url
  await ref.update(update)

  // Product listings carry the store's name and open state for search.
  if (fields.name || fields.isOpen !== undefined) {
    const products = await db().collection('products').where('storeId', '==', caller.user.uid).get()
    const batch = db().batch()
    products.docs.forEach((p) =>
      batch.update(p.ref, { ...(fields.name && { storeName: fields.name }), ...(fields.isOpen !== undefined && { storeOpen: fields.isOpen }) }),
    )
    await batch.commit()
  }
  const store = await ref.get()
  return ok(presentStore(store.id, store.data()!), 'Store updated')
})

export { methodNotAllowed as POST, methodNotAllowed as DELETE }
