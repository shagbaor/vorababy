import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parse, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { HANDOFF_MAX_TRIES, handoffCode } from '@/lib/server/handoff'
import { notify } from '@/lib/server/notify'
import { orderFor } from '@/lib/server/order-access'
import { releaseOrder, requireStatus } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// The buyer enters the 4-digit code the rider tells them. A correct code marks
// the order delivered and releases the escrow to the seller and rider. Wrong
// codes are counted; after HANDOFF_MAX_TRIES the order is locked and flagged
// for support.
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const order = await orderFor(user.uid, (await params).id, 'buyer')
  const o = order.data()!
  if (o.escrowStatus !== 'held') throw new ApiError('conflict', 'Payment for this order has already been settled')
  requireStatus(o, ['out_for_delivery', 'delivered'], 'You can confirm once your rider is on the way')
  if (o.handoffLocked) throw new ApiError('forbidden', 'Too many wrong codes. Our support team has been alerted and will contact you.', { attemptsLeft: 0, locked: true })
  const body = parse(z.object({ code: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit code from your rider') }), await readJson(request).catch(() => ({})))

  if (body.code !== handoffCode(o.orderNumber ?? order.id)) {
    const tries = ((o.handoffFailedAttempts as number | undefined) ?? 0) + 1
    const locked = tries >= HANDOFF_MAX_TRIES
    await order.ref.update({
      handoffFailedAttempts: tries,
      ...(locked ? { handoffLocked: true, flagged: true, flagReason: 'Handoff code entered wrong too many times' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (locked) {
      await Promise.all([
        notify(o.storeId, 'order_status', 'Handoff needs support', `${order.id}: the buyer entered the wrong code too many times. Support will step in.`, { orderId: order.id }),
        ...(o.riderId ? [notify(o.riderId, 'order_status', 'Handoff needs support', `${order.id}: the code was entered wrong too many times. Support will contact you.`, { orderId: order.id })] : []),
      ])
      throw new ApiError('forbidden', 'Too many wrong codes. Our support team has been alerted and will contact you.', { attemptsLeft: 0, locked: true })
    }
    const left = HANDOFF_MAX_TRIES - tries
    throw new ApiError('validation_failed', `Incorrect code. ${left} ${left === 1 ? 'try' : 'tries'} left.`, { attemptsLeft: left, locked: false })
  }

  if (o.status === 'out_for_delivery') {
    await order.ref.update({
      status: 'delivered',
      deliveredAt: new Date(),
      handoffConfirmedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({ status: 'delivered', at: new Date() }),
    })
    if (o.riderId) await db().collection('riders').doc(o.riderId).update({ activeOrderId: null }).catch(() => {})
  }
  await releaseOrder(order.id, { uid: user.uid, role: 'buyer' })
  if (o.riderId) await notify(o.riderId, 'order_status', 'Delivery complete', `${order.id} was confirmed by the buyer. Your pay is in your wallet.`, { orderId: order.id })
  return ok({ id: order.id, status: 'completed', escrowStatus: 'released', totalKobo: o.totalKobo }, 'Delivery confirmed. Payment released to the seller.')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
