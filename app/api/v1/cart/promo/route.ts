import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { cartGroups, loadCart, promoDiscount } from '@/lib/server/cart'
import { presentCart } from '@/lib/server/cart-present'

export const dynamic = 'force-dynamic'

// Promo code box + Apply. DELETE removes the code.
export const POST = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const { code } = await parseBody(request, z.object({ code: z.string().trim().min(2).max(30) }))
  const { groups } = await cartGroups(await loadCart(user.uid))
  const promo = await promoDiscount(code, groups.reduce((n, g) => n + g.subtotalKobo, 0))
  await db().collection('carts').doc(user.uid).set({ promoCode: promo.code }, { merge: true })
  return ok(await presentCart(user.uid), `Promo applied: ₦${(promo.discountKobo / 100).toLocaleString()} off`)
})

export const DELETE = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  await db().collection('carts').doc(user.uid).set({ promoCode: null }, { merge: true })
  return ok(await presentCart(user.uid), 'Promo removed')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH }
