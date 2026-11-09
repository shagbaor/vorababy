import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentSellerProduct, productSchema } from '@/lib/server/seller-products'
import { useFile } from '@/lib/server/storage'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

async function ownProduct(uid: string, id: string) {
  const ref = db().collection('products').doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists || snapshot.get('storeId') !== uid || snapshot.get('status') === 'deleted') throw new ApiError('not_found', 'Product not found')
  return { ref, snapshot }
}

export const GET = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const { snapshot } = await ownProduct(user.uid, (await params).id)
  return ok(presentSellerProduct(snapshot.id, snapshot.data()!), 'Product loaded')
})

// Edit (pencil), restock, publish or unpublish.
export const PATCH = handle<Context>(async (request, { params }) => {
  const { user, profile } = await requireProfile(request, { roles: ['seller'] })
  const { ref } = await ownProduct(user.uid, (await params).id)
  const body = await parseBody(request, productSchema.partial())
  if (body.status === 'published' && profile.verificationStatus !== 'approved') {
    throw new ApiError('forbidden', 'You can publish once your store is approved')
  }
  if (body.categoryId && !(await db().collection('categories').doc(body.categoryId).get()).exists) {
    throw new ApiError('validation_failed', 'Choose a category', { categoryId: 'Choose a category' })
  }
  const { photoFileIds, ...fields } = body
  const update: Record<string, unknown> = { ...fields, updatedAt: FieldValue.serverTimestamp() }
  if (fields.name) update.nameLower = fields.name.toLowerCase()
  if (photoFileIds) {
    const photos = await Promise.all(photoFileIds.map((id) => useFile(user.uid, id, ['product_photo'])))
    update.photos = photos.map((p) => ({ fileId: p.fileId, url: p.url }))
  }
  await ref.update(update)
  return ok(presentSellerProduct(ref.id, (await ref.get()).data()!), 'Product updated')
})

// "Delete Product?". Products in past orders are kept for the record but hidden everywhere.
export const DELETE = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const { ref } = await ownProduct(user.uid, (await params).id)
  const ordered = await db().collection('orders').where('productIds', 'array-contains', ref.id).limit(1).get()
  if (ordered.empty) await ref.delete()
  else await ref.update({ status: 'deleted', updatedAt: FieldValue.serverTimestamp() })
  return ok(null, 'Product deleted')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT }
