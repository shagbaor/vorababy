import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { addressSchema, presentAddress } from '@/lib/server/addresses'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export const PATCH = handle<Context>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  const { id } = await params
  const body = await parseBody(request, addressSchema.partial())
  const doc = ref.collection('addresses').doc(id)

  await db().runTransaction(async (transaction) => {
    if (!(await transaction.get(doc)).exists) throw new ApiError('not_found', 'Address not found')
    if (body.isDefault) {
      const others = await transaction.get(ref.collection('addresses').where('isDefault', '==', true))
      others.docs.forEach((d) => d.id !== id && transaction.update(d.ref, { isDefault: false }))
    }
    transaction.update(doc, { ...body, updatedAt: FieldValue.serverTimestamp() })
  })
  return ok(presentAddress(await doc.get()), 'Address updated')
})

export const DELETE = handle<Context>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  const { id } = await params
  const doc = ref.collection('addresses').doc(id)
  const snapshot = await doc.get()
  if (!snapshot.exists) throw new ApiError('not_found', 'Address not found')
  await doc.delete()
  // Keep one default if any addresses remain.
  if (snapshot.get('isDefault')) {
    const next = await ref.collection('addresses').orderBy('createdAt', 'desc').limit(1).get()
    if (!next.empty) await next.docs[0].ref.update({ isDefault: true })
  }
  return ok(null, 'Address deleted')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PUT }
