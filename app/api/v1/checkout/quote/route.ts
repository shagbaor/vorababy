import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { DELIVERY_SLOTS, slotAvailable } from '@/lib/server/cart'
import { deliverySchema, quoteCheckout } from '@/lib/server/checkout'

export const dynamic = 'force-dynamic'

// Delivery Details → Order Summary: exact totals for this address and time.
export const POST = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['buyer'] })
  const body = await parseBody(request, deliverySchema)
  const quote = await quoteCheckout(caller, body)
  return ok(
    {
      ...quote.totals,
      promo: quote.promo.code ? { code: quote.promo.code, discountKobo: quote.promo.discountKobo } : null,
      address: quote.address,
      deliverySlot: body.deliverySlot,
      orders: quote.drafts.map((d) => ({
        store: { id: d.storeId, name: d.storeName },
        itemCount: d.itemCount,
        subtotalKobo: d.subtotalKobo,
        deliveryFeeKobo: d.deliveryFeeKobo,
        serviceFeeKobo: d.serviceFeeKobo,
        discountKobo: d.discountKobo,
        totalKobo: d.totalKobo,
        distanceKm: d.distanceKm,
      })),
      deliverySlots: DELIVERY_SLOTS.map((id) => ({ id, available: slotAvailable(id) })),
    },
    'Quote ready',
  )
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
