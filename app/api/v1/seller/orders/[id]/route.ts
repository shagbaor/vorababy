import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { orderFor } from '@/lib/server/order-access'
import { presentOrder } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const order = await orderFor(user.uid, (await params).id, 'seller')
  return ok(presentOrder(order.id, order.data()!, 'seller'), 'Order loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
