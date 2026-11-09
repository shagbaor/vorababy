import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentCart } from '@/lib/server/cart-present'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ productId: string }> }

// Add to Cart and the −/+ buttons: sets the quantity (0 removes).
export const PUT = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const { productId } = await params
  const { quantity } = await parseBody(request, z.object({ quantity: z.number().int().min(0).max(999) }))
  const ref = db().collection('carts').doc(user.uid)

  if (quantity > 0) {
    const product = await db().collection('products').doc(productId).get()
    if (!product.exists || product.get('status') !== 'published') throw new ApiError('not_found', 'Product not found')
    const stock = (product.get('stock') as number) ?? 0
    if (stock <= 0) throw new ApiError('conflict', 'This product is out of stock')
    if (quantity > stock) throw new ApiError('validation_failed', `Only ${stock} left`, { quantity: `Only ${stock} left` })
    const cart = await ref.get()
    if (Object.keys((cart.get('items') as object | undefined) ?? {}).length >= 50 && !cart.get(`items.${productId}`)) {
      throw new ApiError('conflict', 'Your cart is full (50 products)')
    }
  }
  await ref.set({ items: { [productId]: quantity > 0 ? quantity : FieldValue.delete() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  return ok(await presentCart(user.uid), quantity > 0 ? 'Cart updated' : 'Removed from cart')
})

export const DELETE = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const { productId } = await params
  await db().collection('carts').doc(user.uid).set({ items: { [productId]: FieldValue.delete() } }, { merge: true })
  return ok(await presentCart(user.uid), 'Removed from cart')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PATCH }
