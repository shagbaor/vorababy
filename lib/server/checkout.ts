import 'server-only'
import { z } from 'zod'
import { optionalText, type Caller } from '@/lib/api/guard'
import { addressSchema, resolveAddress } from '@/lib/server/addresses'
import { cartGroups, DELIVERY_SLOTS, loadCart, priceGroups } from '@/lib/server/cart'

// Shared by POST /checkout/quote, POST /checkout and POST /splits.
export const deliverySchema = z.object({
  addressId: z.string().max(100).optional(),
  address: addressSchema.omit({ label: true, isDefault: true }).extend({ label: z.string().max(40).optional() }).optional(),
  deliverySlot: z.enum(DELIVERY_SLOTS).default('asap'),
  note: optionalText(200),
})

export async function quoteCheckout(caller: Caller, input: z.infer<typeof deliverySchema>) {
  const cart = await loadCart(caller.user.uid)
  const address = await resolveAddress(caller.ref, input as never)
  const { groups } = await cartGroups(cart)
  const priced = await priceGroups(groups, address.location, cart.promoCode, { strict: true, slot: input.deliverySlot })
  return { cart, address, ...priced }
}
