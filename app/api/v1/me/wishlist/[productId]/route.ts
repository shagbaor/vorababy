import { FieldValue } from 'firebase-admin/firestore'
import { requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ productId: string }> }

// The heart on a product: PUT saves, DELETE removes. Both are safe to repeat.
export const PUT = handle<Context>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  const { productId } = await params
  if (!(await db().collection('products').doc(productId).get()).exists) throw new ApiError('not_found', 'Product not found')
  await ref.collection('wishlist').doc(productId).set({ createdAt: FieldValue.serverTimestamp() })
  return ok({ productId, isWishlisted: true }, 'Saved to wishlist')
})

export const DELETE = handle<Context>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  const { productId } = await params
  await ref.collection('wishlist').doc(productId).delete()
  return ok({ productId, isWishlisted: false }, 'Removed from wishlist')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PATCH }
