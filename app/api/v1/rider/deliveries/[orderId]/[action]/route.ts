import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parse, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { notify } from '@/lib/server/notify'
import { orderFor } from '@/lib/server/order-access'
import { presentOrder, requireStatus, transition } from '@/lib/server/orders'
import { useFile } from '@/lib/server/storage'

export const dynamic = 'force-dynamic'

// Delivery Progress:
//   arrived-at-store  "Arrived at Seller"
//   picked-up         "Items Picked Up"  → out_for_delivery
//   delivered         "Delivered"        → delivered; the buyer is asked to confirm   body { proofPhotoFileId? }
export const POST = handle<{ params: Promise<{ orderId: string; action: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['rider'], approved: true })
  const { orderId, action } = await params
  const order = await orderFor(user.uid, orderId, 'rider')

  if (action === 'arrived-at-store') {
    requireStatus(order.data()!, ['ready_for_pickup'])
    await order.ref.update({ riderArrivedAt: FieldValue.serverTimestamp() })
    await notify(order.get('storeId'), 'order_status', 'Rider has arrived', `The rider for ${orderId} is at your store.`, { orderId })
  } else if (action === 'picked-up') {
    await transition(orderId, (o) => requireStatus(o, ['ready_for_pickup']), 'out_for_delivery', { pickedUpAt: new Date() })
  } else if (action === 'delivered') {
    const body = parse(z.object({ proofPhotoFileId: z.string().max(100).optional() }), await readJson(request).catch(() => ({})))
    const proof = body.proofPhotoFileId ? await useFile(user.uid, body.proofPhotoFileId, ['delivery_proof']) : null
    await transition(orderId, (o) => requireStatus(o, ['out_for_delivery']), 'delivered', {
      deliveredAt: new Date(),
      deliveryProofFileId: proof?.fileId ?? null,
    })
    await db().collection('riders').doc(user.uid).update({ activeOrderId: null })
    await notify(order.get('buyerId'), 'order_status', 'Order delivered', `Please confirm ${orderId} arrived so the seller gets paid.`, { orderId })
  } else {
    throw new ApiError('not_found', 'No such endpoint')
  }
  const fresh = await order.ref.get()
  return ok(presentOrder(orderId, fresh.data()!, 'rider'), { 'arrived-at-store': 'Arrived at seller', 'picked-up': 'Items picked up', delivered: 'Delivered. Waiting for the buyer to confirm.' }[action]!)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
