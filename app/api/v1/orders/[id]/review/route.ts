import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { optionalText, parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { orderFor } from '@/lib/server/order-access'

export const dynamic = 'force-dynamic'

// Rate your experience (after delivery), once per order.
const rating = z.number().int().min(1).max(5)
const schema = z.object({
  storeRating: rating,
  riderRating: rating.optional(),
  comment: optionalText(500),
  productRatings: z.array(z.object({ productId: z.string().max(100), rating })).max(50).optional(),
})

export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user, profile } = await requireProfile(request, { roles: ['buyer'] })
  const body = await parseBody(request, schema)
  const order = await orderFor(user.uid, (await params).id, 'buyer')
  const o = order.data()!
  if (!['delivered', 'completed'].includes(o.status)) throw new ApiError('conflict', 'You can rate the order after it is delivered')
  if (o.reviewedAt) throw new ApiError('conflict', 'You have already rated this order')
  const productIds = new Set((o.items as { productId: string }[]).map((i) => i.productId))
  const productRatings = (body.productRatings ?? []).filter((r) => productIds.has(r.productId))

  await db().runTransaction(async (tx) => {
    const storeRef = db().collection('stores').doc(o.storeId)
    const riderRef = o.riderId && body.riderRating ? db().collection('riders').doc(o.riderId) : null
    const productRefs = productRatings.map((r) => db().collection('products').doc(r.productId))
    const [store, rider, ...products] = await Promise.all([tx.get(storeRef), riderRef ? tx.get(riderRef) : null, ...productRefs.map((r) => tx.get(r))])
    const fresh = await tx.get(order.ref)
    if (fresh.get('reviewedAt')) throw new ApiError('conflict', 'You have already rated this order')

    const average = (doc: FirebaseFirestore.DocumentSnapshot, value: number) => {
      const count = (doc.get('ratingCount') as number | undefined) ?? 0
      const avg = (doc.get('rating') as number | null | undefined) ?? 0
      return { rating: Math.round(((avg * count + value) / (count + 1)) * 10) / 10, ratingCount: count + 1 }
    }
    tx.update(storeRef, average(store, body.storeRating))
    if (riderRef && rider) tx.update(riderRef, average(rider, body.riderRating!))
    products.forEach((p, i) => {
      if (!p.exists) return
      tx.update(p.ref, average(p, productRatings[i].rating))
      tx.set(p.ref.collection('reviews').doc(order.id), {
        rating: productRatings[i].rating,
        comment: body.comment ?? null,
        buyerName: String(profile.name).split(' ')[0],
        buyerId: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      })
    })
    tx.update(order.ref, { reviewedAt: FieldValue.serverTimestamp(), review: { storeRating: body.storeRating, riderRating: body.riderRating ?? null, comment: body.comment ?? null } })
  })
  return ok({ id: order.id }, 'Thanks for your feedback')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
