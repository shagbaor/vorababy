import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { orderFor } from '@/lib/server/order-access'
import { refundOrder, requireStatus } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// Buyers can cancel until the seller accepts; the money goes back to the wallet.
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const order = await orderFor(user.uid, (await params).id, 'buyer')
  requireStatus(order.data()!, ['placed'], 'The seller has already accepted this order. Contact support to cancel.')
  await refundOrder(order.id, { uid: user.uid, role: 'buyer' }, 'Cancelled by you.')
  return ok({ id: order.id, status: 'cancelled', escrowStatus: 'refunded' }, 'Order cancelled. Your money is back in your wallet.')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
