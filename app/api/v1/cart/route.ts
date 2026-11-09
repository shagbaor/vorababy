import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentCart } from '@/lib/server/cart-present'

export const dynamic = 'force-dynamic'

// The Cart screen. Items are grouped by store; each store becomes one order.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  return ok(await presentCart(user.uid), 'Cart loaded')
})

export const DELETE = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  await db().collection('carts').doc(user.uid).delete()
  return ok(await presentCart(user.uid), 'Cart cleared')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH }
