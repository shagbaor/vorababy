import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { orderFor } from '@/lib/server/order-access'
import { presentOrder, STEPS } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// Order detail and the Order Status (tracking) screen. For live updates,
// listen to Firestore orders/{id}.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const order = await orderFor(user.uid, (await params).id, 'buyer')
  const rider = order.get('riderId') ? await db().collection('riders').doc(order.get('riderId')).get() : null
  return ok({ ...presentOrder(order.id, order.data()!, 'buyer', rider?.data()), steps: STEPS }, 'Order loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
