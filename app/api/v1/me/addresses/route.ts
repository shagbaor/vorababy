import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { addressSchema, listAddresses, presentAddress } from '@/lib/server/addresses'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export const GET = handle(async (request) => {
  const { ref } = await requireProfile(request)
  return ok({ items: await listAddresses(ref) }, 'Addresses loaded')
})

export const POST = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const body = await parseBody(request, addressSchema)
  const existing = await ref.collection('addresses').get()
  if (existing.size >= 20) throw new ApiError('conflict', 'You can save up to 20 addresses')

  const isDefault = body.isDefault ?? existing.empty
  const doc = ref.collection('addresses').doc()
  await db().runTransaction(async (transaction) => {
    if (isDefault) existing.docs.forEach((d) => d.get('isDefault') && transaction.update(d.ref, { isDefault: false }))
    transaction.create(doc, { ...body, isDefault, createdAt: FieldValue.serverTimestamp() })
  })
  return ok(presentAddress(await doc.get()), 'Address saved', 201)
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
