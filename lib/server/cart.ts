import 'server-only'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { visibleStores, type ProductDoc, type StoreDoc } from '@/lib/server/catalog'
import { distanceKm, isOpenNow, lagosNow, type LatLng } from '@/lib/server/geo'
import { deliveryFeeKobo, getSettings, riderPayKobo, type Settings } from '@/lib/server/settings'

// The server-side cart (carts/{uid}) and how it is priced. One order is
// created per store; the service fee is charged per order and a promo
// discount is shared across the orders in proportion to their subtotals.

export type CartDoc = { items: Record<string, number>; promoCode?: string | null; ownerId?: string }

export const DELIVERY_SLOTS = ['asap', 'today_12_14', 'today_16_18', 'tomorrow_morning'] as const
export type DeliverySlot = (typeof DELIVERY_SLOTS)[number]

export async function loadCart(uid: string): Promise<CartDoc> {
  const snapshot = await db().collection('carts').doc(uid).get()
  return { items: {}, promoCode: null, ...(snapshot.data() as CartDoc | undefined), ownerId: uid }
}

export function slotAvailable(slot: DeliverySlot, now = new Date()) {
  const { minutes } = lagosNow(now)
  if (slot === 'today_12_14') return minutes < 13 * 60
  if (slot === 'today_16_18') return minutes < 17 * 60
  return true
}

export type PromoDoc = {
  type: 'percent' | 'fixed'
  value: number
  minSubtotalKobo?: number
  maxDiscountKobo?: number
  active: boolean
  expiresAt?: FirebaseFirestore.Timestamp
  usageLimit?: number
  usedCount?: number
}

export async function promoDiscount(code: string | null | undefined, subtotalKobo: number) {
  if (!code) return { code: null, discountKobo: 0 }
  const snapshot = await db().collection('promoCodes').doc(code.toUpperCase()).get()
  const promo = snapshot.data() as PromoDoc | undefined
  const invalid = (message: string) => new ApiError('validation_failed', message, { code: message })
  if (!promo || !promo.active) throw invalid('This promo code is not valid')
  if (promo.expiresAt && promo.expiresAt.toMillis() < Date.now()) throw invalid('This promo code has expired')
  if (promo.usageLimit && (promo.usedCount ?? 0) >= promo.usageLimit) throw invalid('This promo code has been used up')
  if (promo.minSubtotalKobo && subtotalKobo < promo.minSubtotalKobo) {
    throw invalid(`Spend at least ₦${(promo.minSubtotalKobo / 100).toLocaleString()} to use this code`)
  }
  let discount = promo.type === 'percent' ? Math.round((subtotalKobo * promo.value) / 100) : promo.value
  if (promo.maxDiscountKobo) discount = Math.min(discount, promo.maxDiscountKobo)
  return { code: snapshot.id, discountKobo: Math.min(discount, subtotalKobo) }
}

export type CartLine = {
  productId: string
  name: string
  photoUrl: string | null
  unit: string
  priceKobo: number
  quantity: number
  lineTotalKobo: number
  stock: number
  available: boolean
  problem: string | null
}

export type CartGroup = {
  store: StoreDoc
  lines: CartLine[]
  subtotalKobo: number
}

// Catalogue products, or a personal-shopping product made for this buyer.
export function buyable(p: FirebaseFirestore.DocumentData, buyerId: string | undefined) {
  return p.status === 'published' || (p.status === 'custom' && Boolean(buyerId) && p.customForBuyerId === buyerId)
}

// Reads the cart's products and stores. Lines that can't be bought say why.
export async function cartGroups(cart: CartDoc) {
  const ids = Object.keys(cart.items).filter((id) => cart.items[id] > 0)
  const stores = await visibleStores()
  const products = ids.length ? await db().getAll(...ids.map((id) => db().collection('products').doc(id))) : []
  const groups = new Map<string, CartGroup>()
  const missing: string[] = []

  for (const snapshot of products) {
    const p = snapshot.exists ? ({ ...snapshot.data()!, id: snapshot.id } as ProductDoc) : null
    const store = p && stores.get(p.storeId)
    if (!p || !store || !buyable(p, cart.ownerId)) {
      missing.push(snapshot.id)
      continue
    }
    const quantity = cart.items[p.id]
    const stock = p.stock ?? 0
    const problem = stock <= 0 ? 'Out of stock' : quantity > stock ? `Only ${stock} left` : store.isOpen === false ? 'Store is closed' : null
    const group = groups.get(store.id) ?? { store, lines: [], subtotalKobo: 0 }
    group.lines.push({
      productId: p.id,
      name: p.name,
      photoUrl: p.photos?.[0]?.url ?? null,
      unit: p.unit,
      priceKobo: p.priceKobo,
      quantity,
      lineTotalKobo: p.priceKobo * quantity,
      stock,
      available: !problem,
      problem,
    })
    if (!problem) group.subtotalKobo += p.priceKobo * quantity
    groups.set(store.id, group)
  }
  return { groups: [...groups.values()], missing }
}

export type OrderDraft = {
  storeId: string
  storeName: string
  storeType: string
  storeAddress: unknown
  storeLocation: LatLng
  lines: CartLine[]
  itemCount: number
  subtotalKobo: number
  deliveryFeeKobo: number
  serviceFeeKobo: number
  discountKobo: number
  totalKobo: number
  commissionKobo: number
  sellerPayoutKobo: number
  riderPayKobo: number
  platformFeeKobo: number
  distanceKm: number
}

// Prices every store group for delivery to `to`. With `strict`, anything that
// would stop checkout throws (used by quote and checkout).
export async function priceGroups(groups: CartGroup[], to: LatLng | null, promoCode: string | null | undefined, options: { strict: boolean; slot?: DeliverySlot }, settings?: Settings) {
  const s = settings ?? (await getSettings())
  if (options.strict) {
    if (!groups.length) throw new ApiError('validation_failed', 'Your cart is empty', { cart: 'Your cart is empty' })
    const unavailable = groups.flatMap((g) => g.lines.filter((l) => !l.available))
    if (unavailable.length) {
      throw new ApiError('conflict', 'Some items in your cart are no longer available', Object.fromEntries(unavailable.map((l) => [l.productId, l.problem])))
    }
    if (options.slot && !slotAvailable(options.slot)) throw new ApiError('validation_failed', 'This delivery time has passed', { deliverySlot: 'Choose another delivery time' })
    for (const g of groups) {
      if (options.slot === 'asap' && !isOpenNow(g.store.isOpen, g.store.openingHours)) {
        throw new ApiError('validation_failed', `${g.store.name} is closed now. Choose a later delivery time.`, { deliverySlot: `${g.store.name} is closed now` })
      }
    }
  }

  const subtotal = groups.reduce((sum, g) => sum + g.subtotalKobo, 0)
  const promo = await promoDiscount(promoCode, subtotal).catch((error) => {
    if (options.strict) throw error
    return { code: null, discountKobo: 0, error: (error as ApiError).message }
  })

  let discountLeft = promo.discountKobo
  const drafts: OrderDraft[] = groups.map((g, index) => {
    const km = to ? distanceKm(g.store.location, to) : 0
    if (options.strict && km > s.maxDeliveryKm) {
      throw new ApiError('validation_failed', `${g.store.name} does not deliver this far (${km} km)`, { address: `Outside ${g.store.name}'s delivery area` })
    }
    const deliveryFee = deliveryFeeKobo(s, km)
    const discount = index === groups.length - 1 ? discountLeft : Math.round((promo.discountKobo * g.subtotalKobo) / Math.max(1, subtotal))
    discountLeft -= discount
    const commission = Math.round(g.subtotalKobo * s.commissionRate)
    const riderPay = riderPayKobo(s, deliveryFee)
    const lines = g.lines.filter((l) => l.available)
    return {
      storeId: g.store.id,
      storeName: g.store.name,
      storeType: g.store.type,
      storeAddress: g.store.address,
      storeLocation: g.store.location,
      lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      subtotalKobo: g.subtotalKobo,
      deliveryFeeKobo: deliveryFee,
      serviceFeeKobo: s.serviceFeeKobo,
      discountKobo: discount,
      totalKobo: g.subtotalKobo + deliveryFee + s.serviceFeeKobo - discount,
      commissionKobo: commission,
      sellerPayoutKobo: g.subtotalKobo - commission,
      riderPayKobo: riderPay,
      platformFeeKobo: commission + s.serviceFeeKobo + (deliveryFee - riderPay) - discount,
      distanceKm: km,
    }
  })

  const totals = {
    subtotalKobo: subtotal,
    deliveryFeeKobo: drafts.reduce((n, d) => n + d.deliveryFeeKobo, 0),
    serviceFeeKobo: drafts.reduce((n, d) => n + d.serviceFeeKobo, 0),
    discountKobo: promo.discountKobo,
    totalKobo: drafts.reduce((n, d) => n + d.totalKobo, 0),
    itemCount: drafts.reduce((n, d) => n + d.itemCount, 0),
  }
  return { drafts, totals, promo }
}
