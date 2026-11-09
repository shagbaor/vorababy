import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile, text } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { notify } from '@/lib/server/notify'
import { orderFor } from '@/lib/server/order-access'
import { useFile } from '@/lib/server/storage'

export const dynamic = 'force-dynamic'

// Report a problem: opens a dispute for the admin team. The payment stays in
// escrow until an admin decides (refund the buyer or release to the seller).
const REASONS = {
  wrong_items: 'Wrong items delivered',
  missing_items: 'Missing item in order',
  quality: 'Quality not as described',
  late: 'Order arrived late',
  not_delivered: 'Order not delivered',
  other: 'Problem with order',
} as const

const schema = z.object({
  reason: z.enum(Object.keys(REASONS) as [keyof typeof REASONS, ...(keyof typeof REASONS)[]]),
  description: text(1000, 10),
  photoFileIds: z.array(z.string().max(100)).max(5).optional(),
})

export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user, profile } = await requireProfile(request, { roles: ['buyer'] })
  const body = await parseBody(request, schema)
  const order = await orderFor(user.uid, (await params).id, 'buyer')
  const o = order.data()!
  if (o.escrowStatus !== 'held') throw new ApiError('conflict', 'Payment for this order is already settled. Contact support.')
  if (o.disputeId) throw new ApiError('conflict', 'You have already reported this order')
  if (!['out_for_delivery', 'delivered'].includes(o.status)) throw new ApiError('conflict', 'You can report a problem once the order is on its way')
  const photos = await Promise.all((body.photoFileIds ?? []).map((id) => useFile(user.uid, id, ['chat_attachment', 'delivery_proof', 'product_photo'])))

  const disputeId = await db().runTransaction(async (tx) => {
    const counters = await tx.get(db().collection('meta').doc('counters'))
    const n = ((counters.get('disputes') as number | undefined) ?? 100) + 1
    const id = `D-${n}`
    tx.set(db().collection('meta').doc('counters'), { disputes: n }, { merge: true })
    // Shape read by the admin Disputes pages.
    tx.create(db().collection('disputes').doc(id), {
      title: REASONS[body.reason],
      reason: body.reason,
      orderId: order.id,
      amount: o.totalKobo / 100,
      status: 'open',
      summary: body.description,
      buyerId: user.uid,
      buyerName: profile.name,
      buyerClaim: body.description,
      storeId: o.storeId,
      sellerName: o.storeName,
      sellerResponse: '',
      evidence: [...photos.map((_, i) => `Photo ${i + 1}`), 'Original order receipt'],
      photoFileIds: photos.map((p) => p.fileId),
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.update(order.ref, { status: 'disputed', disputeId: id, statusBeforeDispute: o.status, flagged: true, updatedAt: FieldValue.serverTimestamp() })
    return id
  })
  await notify(o.storeId, 'order_status', 'Problem reported', `The buyer reported a problem with ${order.id}. Our team will contact you.`, { orderId: order.id })
  return ok({ disputeId, orderId: order.id }, 'Problem reported. Our team will review it and contact you.', 201)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
