import { z } from 'zod'
import { parse, requireProfile, text } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { orderFor } from '@/lib/server/order-access'
import { presentOrder, refundOrder, requireStatus, transition } from '@/lib/server/orders'
import { notify } from '@/lib/server/notify'
import { offerJob } from '@/lib/server/riders'

export const dynamic = 'force-dynamic'

// Seller order actions:
//   accept     placed → confirmed
//   reject     placed → cancelled (buyer refunded)      body { reason }
//   preparing  confirmed → preparing
//   ready      confirmed|preparing → ready_for_pickup  (nearby riders are offered the job)
//   handoff    ready_for_pickup → out_for_delivery     (seller checked the code with the rider)
export const POST = handle<{ params: Promise<{ id: string; action: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'], approved: true })
  const { id, action } = await params
  const order = await orderFor(user.uid, id, 'seller')

  if (action === 'accept') {
    await transition(id, (o) => requireStatus(o, ['placed']), 'confirmed', { confirmedAt: new Date() })
  } else if (action === 'reject') {
    const { reason } = parse(z.object({ reason: text(200, 3) }), await readJson(request).catch(() => ({})))
    requireStatus(order.data()!, ['placed'], 'You can only reject a new order. Contact support to cancel an accepted order.')
    await refundOrder(id, { uid: user.uid, role: 'seller' }, `The seller could not take this order: ${reason}`)
  } else if (action === 'preparing') {
    await transition(id, (o) => requireStatus(o, ['confirmed']), 'preparing')
  } else if (action === 'ready') {
    await transition(id, (o) => requireStatus(o, ['confirmed', 'preparing']), 'ready_for_pickup', { readyAt: new Date() })
    await offerJob(id)
  } else if (action === 'handoff') {
    if (!order.get('riderId')) throw new ApiError('conflict', 'Wait for a rider to accept this order first')
    await transition(id, (o) => requireStatus(o, ['ready_for_pickup']), 'out_for_delivery', { pickedUpAt: new Date(), handedOffBy: 'seller' })
    await notify(order.get('riderId'), 'order_status', 'Order handed over', `${id} is yours. Head to the buyer.`, { orderId: id })
  } else {
    throw new ApiError('not_found', 'No such endpoint')
  }
  const fresh = await db().collection('orders').doc(id).get()
  return ok(presentOrder(id, fresh.data()!, 'seller'), {
    accept: 'Order accepted',
    reject: 'Order rejected. The buyer has been refunded.',
    preparing: 'Marked as being prepared',
    ready: 'Ready for pickup. Nearby riders have been notified.',
    handoff: 'Handed over. The order is out for delivery.',
  }[action]!)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
