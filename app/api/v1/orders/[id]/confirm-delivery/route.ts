import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { orderFor } from '@/lib/server/order-access'
import { releaseOrder } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// "Delivery Confirmed!": releases the escrow to the seller and rider.
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const order = await orderFor(user.uid, (await params).id, 'buyer')
  await releaseOrder(order.id, { uid: user.uid, role: 'buyer' })
  return ok({ id: order.id, status: 'completed', escrowStatus: 'released', totalKobo: order.get('totalKobo') }, 'Delivery confirmed. Payment released to the seller.')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
