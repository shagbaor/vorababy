import 'server-only'
import { db } from '@/lib/firebase/admin'
import { listAddresses } from '@/lib/server/addresses'
import { cartGroups, loadCart, priceGroups } from '@/lib/server/cart'

// GET /cart and the responses of every cart change.
export async function presentCart(uid: string) {
  const cart = await loadCart(uid)
  const { groups, missing } = await cartGroups(cart)
  if (missing.length) {
    // Products that disappeared are dropped quietly.
    const { FieldValue } = await import('firebase-admin/firestore')
    await db().collection('carts').doc(uid).set({ items: Object.fromEntries(missing.map((id) => [id, FieldValue.delete()])) }, { merge: true })
  }
  const address = (await listAddresses(db().collection('users').doc(uid))).find((a) => a.isDefault)
  const priced = await priceGroups(groups, address?.location ?? null, cart.promoCode, { strict: false })

  return {
    groups: groups.map((g) => ({
      store: { id: g.store.id, name: g.store.name, type: g.store.type, isOpen: g.store.isOpen !== false },
      items: g.lines,
      subtotalKobo: g.subtotalKobo,
    })),
    itemCount: groups.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.quantity, 0), 0),
    promo: cart.promoCode ? { code: cart.promoCode, discountKobo: priced.promo.discountKobo, error: (priced.promo as { error?: string }).error ?? null } : null,
    // Delivery is estimated to the default address until checkout.
    totals: priced.totals,
    deliveryEstimatedTo: address ? { id: address.id, label: address.label } : null,
  }
}
