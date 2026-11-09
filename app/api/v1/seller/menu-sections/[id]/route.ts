import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile, text } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

export const PATCH = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const body = await parseBody(request, z.object({ name: text(40).optional(), position: z.number().int().min(0).max(100).optional() }))
  const ref = db().collection('stores').doc(user.uid).collection('menuSections').doc((await params).id)
  if (!(await ref.get()).exists) throw new ApiError('not_found', 'Menu section not found')
  await ref.update({ ...body, updatedAt: FieldValue.serverTimestamp() })
  const doc = await ref.get()
  return ok({ id: doc.id, name: doc.get('name'), position: doc.get('position') }, 'Menu section updated')
})

// Products in the section move to "All".
export const DELETE = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const { id } = await params
  const ref = db().collection('stores').doc(user.uid).collection('menuSections').doc(id)
  if (!(await ref.get()).exists) throw new ApiError('not_found', 'Menu section not found')
  const products = await db().collection('products').where('storeId', '==', user.uid).where('menuSectionId', '==', id).get()
  const batch = db().batch()
  products.docs.forEach((p) => batch.update(p.ref, { menuSectionId: null }))
  batch.delete(ref)
  await batch.commit()
  return ok(null, 'Menu section deleted')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PUT }
