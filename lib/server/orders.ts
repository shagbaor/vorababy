import 'server-only'
import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { toIso } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'
import type { OrderDraft, DeliverySlot } from '@/lib/server/cart'
import { notify } from '@/lib/server/notify'
import { loadWallets, type WalletChange } from '@/lib/server/wallet'

// Orders (orders/{orderNumber}): one per store, created only once paid.
//
// status:       placed → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered → completed
//               (cancelled, disputed on the side)
// escrowStatus: held → released (seller and rider paid) | refunded (buyer paid back to wallet)

export const STEPS = [
  { status: 'placed', label: 'Order Placed', detail: 'Your order has been received' },
  { status: 'confirmed', label: 'Order Confirmed', detail: 'Seller confirmed your order' },
  { status: 'preparing', label: 'Being Prepared', detail: 'Seller is preparing your items' },
  { status: 'ready_for_pickup', label: 'Ready for Pickup', detail: 'Order packed and ready' },
  { status: 'out_for_delivery', label: 'Out for Delivery', detail: 'Dispatch rider is on the way' },
  { status: 'delivered', label: 'Delivered', detail: 'Order delivered successfully' },
] as const

export type OrderStatus = (typeof STEPS)[number]['status'] | 'completed' | 'cancelled' | 'disputed'

const ACTIVE = new Set(['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'disputed'])

export function stepOf(status: OrderStatus) {
  const index = status === 'completed' ? STEPS.length - 1 : STEPS.findIndex((s) => s.status === status)
  return index >= 0 ? { index: index + 1, of: STEPS.length, label: STEPS[index].label } : null
}

export type BuyerInfo = { uid: string; name: string; phone: string }
export type PlacementContext = {
  buyer: BuyerInfo
  address: Record<string, unknown> & { location: { lat: number; lng: number } }
  deliverySlot: DeliverySlot
  note: string | null
  paymentMethod: 'wallet' | 'card' | 'bank_transfer' | 'split'
  paymentRef: string | null
  promoCode: string | null
  splitId?: string
}

// Reads needed before placing (Firestore wants all reads first).
export async function readForPlacement(tx: Transaction, drafts: OrderDraft[]) {
  const productIds = [...new Set(drafts.flatMap((d) => d.lines.map((l) => l.productId)))]
  const [products, counter] = await Promise.all([
    productIds.length ? tx.getAll(...productIds.map((id) => db().collection('products').doc(id))) : [],
    tx.get(db().collection('meta').doc('counters')),
  ])
  const stock = new Map(products.map((p) => [p.id, p.exists && p.get('status') === 'published' ? ((p.get('stock') as number) ?? 0) : 0]))
  const shortages = drafts.flatMap((d) => d.lines.filter((l) => (stock.get(l.productId) ?? 0) < l.quantity).map((l) => l.name))
  return { shortages, counter: (counter.get(`orders${new Date().getFullYear()}`) as number | undefined) ?? 0 }
}

// Writes the orders, takes the stock and counts the sale. Returns the order ids.
export function writeOrders(tx: Transaction, prepared: Awaited<ReturnType<typeof readForPlacement>>, drafts: OrderDraft[], ctx: PlacementContext) {
  const year = new Date().getFullYear()
  const now = Timestamp.now()
  let n = prepared.counter
  const ids: string[] = []
  for (const d of drafts) {
    n += 1
    const id = `ORD-${year}-${String(n).padStart(4, '0')}`
    ids.push(id)
    tx.create(db().collection('orders').doc(id), {
      orderNumber: id,
      buyerId: ctx.buyer.uid,
      buyerName: ctx.buyer.name,
      buyerPhone: ctx.buyer.phone,
      storeId: d.storeId,
      storeName: d.storeName,
      storeType: d.storeType,
      storeAddress: d.storeAddress,
      storeLocation: d.storeLocation,
      riderId: null,
      items: d.lines.map((l) => ({ productId: l.productId, name: l.name, unit: l.unit, priceKobo: l.priceKobo, quantity: l.quantity, photoUrl: l.photoUrl })),
      productIds: d.lines.map((l) => l.productId),
      itemCount: d.itemCount,
      subtotalKobo: d.subtotalKobo,
      deliveryFeeKobo: d.deliveryFeeKobo,
      serviceFeeKobo: d.serviceFeeKobo,
      discountKobo: d.discountKobo,
      totalKobo: d.totalKobo,
      commissionKobo: d.commissionKobo,
      sellerPayoutKobo: d.sellerPayoutKobo,
      riderPayKobo: d.riderPayKobo,
      riderBonusKobo: 0,
      platformFeeKobo: d.platformFeeKobo,
      distanceKm: d.distanceKm,
      address: ctx.address,
      deliverySlot: ctx.deliverySlot,
      note: ctx.note,
      paymentMethod: ctx.paymentMethod,
      paymentRef: ctx.paymentRef,
      promoCode: ctx.promoCode,
      splitId: ctx.splitId ?? null,
      status: 'placed',
      escrowStatus: 'held',
      timeline: [{ status: 'placed', at: now }],
      // Fields the admin app reads.
      amount: d.totalKobo / 100,
      flagged: false,
      createdAt: now,
      updatedAt: now,
    })
    for (const l of d.lines) {
      tx.update(db().collection('products').doc(l.productId), { stock: FieldValue.increment(-l.quantity), soldCount: FieldValue.increment(l.quantity) })
    }
    tx.update(db().collection('users').doc(ctx.buyer.uid), { totalOrders: FieldValue.increment(1), activeOrders: FieldValue.increment(1) })
  }
  tx.set(db().collection('meta').doc('counters'), { [`orders${year}`]: n }, { merge: true })
  if (ctx.promoCode) tx.set(db().collection('promoCodes').doc(ctx.promoCode), { usedCount: FieldValue.increment(1) }, { merge: true })
  return ids
}

export async function notifyNewOrders(orderIds: string[]) {
  const orders = await db().getAll(...orderIds.map((id) => db().collection('orders').doc(id)))
  await Promise.all(
    orders.map(async (o) => {
      await notify(o.get('storeId'), 'new_order', 'New order received', `${o.get('buyerName')} · ${o.get('itemCount')} item${o.get('itemCount') === 1 ? '' : 's'}`, { orderId: o.id })
      await notify(o.get('buyerId'), 'order_status', 'Order placed', `${o.id}: your payment is held safely until you confirm delivery.`, { orderId: o.id })
    }),
  )
}

// Moves an order along, checking who may do it and from which status.
export async function transition(
  orderId: string,
  check: (order: FirebaseFirestore.DocumentData) => void,
  to: OrderStatus,
  extra: Record<string, unknown> = {},
) {
  const ref = db().collection('orders').doc(orderId)
  const order = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new ApiError('not_found', 'Order not found')
    const data = snapshot.data()!
    check(data)
    tx.update(ref, { status: to, timeline: FieldValue.arrayUnion({ status: to, at: Timestamp.now() }), updatedAt: FieldValue.serverTimestamp(), ...extra })
    return data
  })
  const step = STEPS.find((s) => s.status === to)
  if (step) await notify(order.buyerId, 'order_status', step.label, `${orderId}: ${step.detail}`, { orderId })
  return order
}

export function requireStatus(order: FirebaseFirestore.DocumentData, allowed: OrderStatus[], message?: string) {
  if (!allowed.includes(order.status)) throw new ApiError('conflict', message ?? `This order is ${String(order.status).replace(/_/g, ' ')}`)
}

// Escrow release: pays the seller and rider. Buyers trigger it by confirming
// delivery; it also happens automatically after a while, or by an admin.
export async function releaseOrder(orderId: string, by: { uid: string; role: 'buyer' | 'admin' | 'system' }) {
  const ref = db().collection('orders').doc(orderId)
  const order = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new ApiError('not_found', 'Order not found')
    const o = snapshot.data()!
    if (o.escrowStatus !== 'held') throw new ApiError('conflict', 'Payment for this order has already been settled')
    if (by.role === 'buyer') {
      if (o.buyerId !== by.uid) throw new ApiError('not_found', 'Order not found')
      requireStatus(o, ['delivered'], 'You can confirm once the rider marks the order delivered')
    }
    const wallets = await loadWallets(tx, [o.storeId, ...(o.riderId ? [o.riderId] : [])])
    const changes: WalletChange[] = [
      { uid: o.storeId, amountKobo: o.sellerPayoutKobo, kind: 'sale', description: `Order ${orderId} sale`, orderId },
    ]
    if (o.riderId) {
      changes.push({ uid: o.riderId, amountKobo: o.riderPayKobo, kind: 'delivery_pay', description: `Delivery ${orderId}`, orderId })
      if (o.riderBonusKobo > 0) changes.push({ uid: o.riderId, amountKobo: o.riderBonusKobo, kind: 'bonus', description: `Bonus for ${orderId}`, orderId })
    } else {
      // No rider (e.g. admin settled it early): the delivery fee stays with Vorapicks.
      tx.update(ref, { platformFeeKobo: o.platformFeeKobo + o.riderPayKobo })
    }
    wallets.apply(changes)
    const now = Timestamp.now()
    tx.update(ref, {
      escrowStatus: 'released',
      status: o.status === 'delivered' || o.status === 'disputed' ? 'completed' : o.status,
      releasedAt: now,
      releasedBy: by.uid,
      timeline: FieldValue.arrayUnion({ status: 'completed', at: now }),
      // The admin app reads platformFee in naira.
      platformFee: (o.riderId ? o.platformFeeKobo : o.platformFeeKobo + o.riderPayKobo) / 100,
      updatedAt: now,
    })
    tx.update(db().collection('users').doc(o.buyerId), { activeOrders: FieldValue.increment(-1) })
    if (o.riderId) tx.update(db().collection('riders').doc(o.riderId), { activeOrderId: null, tripCount: FieldValue.increment(1) })
    return o
  })
  await notify(order.storeId, 'payment', 'Payment released', `₦${(order.sellerPayoutKobo / 100).toLocaleString()} for ${orderId} is in your wallet.`, { orderId })
  if (order.riderId) {
    await notify(order.riderId, 'payment', 'Delivery paid', `₦${((order.riderPayKobo + order.riderBonusKobo) / 100).toLocaleString()} for ${orderId} is in your wallet.`, { orderId })
  }
}

// Refund to the buyer's wallet; stock goes back on the shelf.
export async function refundOrder(orderId: string, by: { uid: string; role: 'buyer' | 'seller' | 'admin' | 'system' }, reason: string) {
  const ref = db().collection('orders').doc(orderId)
  const order = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new ApiError('not_found', 'Order not found')
    const o = snapshot.data()!
    if (o.escrowStatus !== 'held') throw new ApiError('conflict', 'Payment for this order has already been settled')
    const wallets = await loadWallets(tx, [o.buyerId])
    wallets.apply([{ uid: o.buyerId, amountKobo: o.totalKobo, kind: 'refund', description: `Refund for ${orderId}`, orderId }])
    for (const item of o.items as { productId: string; quantity: number }[]) {
      tx.update(db().collection('products').doc(item.productId), { stock: FieldValue.increment(item.quantity), soldCount: FieldValue.increment(-item.quantity) })
    }
    const now = Timestamp.now()
    tx.update(ref, {
      escrowStatus: 'refunded',
      status: 'cancelled',
      cancelReason: reason,
      cancelledBy: by.role,
      refundedAt: now,
      platformFee: 0,
      timeline: FieldValue.arrayUnion({ status: 'cancelled', at: now }),
      updatedAt: now,
    })
    tx.update(db().collection('users').doc(o.buyerId), { activeOrders: FieldValue.increment(-1) })
    if (o.riderId) tx.update(db().collection('riders').doc(o.riderId), { activeOrderId: null })
    return o
  })
  await notify(order.buyerId, 'order_status', 'Order cancelled', `${orderId}: ₦${(order.totalKobo / 100).toLocaleString()} is back in your wallet. ${reason}`, { orderId })
  if (by.role !== 'seller') await notify(order.storeId, 'order_status', 'Order cancelled', `${orderId} was cancelled. ${reason}`, { orderId })
  if (order.riderId) await notify(order.riderId, 'order_status', 'Delivery cancelled', `${orderId} was cancelled.`, { orderId })
}

type Viewer = 'buyer' | 'seller' | 'rider'

export function presentOrder(id: string, o: FirebaseFirestore.DocumentData, viewer: Viewer, rider?: FirebaseFirestore.DocumentData | null) {
  const base = {
    id,
    orderNumber: o.orderNumber ?? id,
    status: o.status as OrderStatus,
    step: stepOf(o.status),
    escrowStatus: o.escrowStatus,
    itemCount: o.itemCount,
    items: o.items,
    deliverySlot: o.deliverySlot,
    note: o.note ?? null,
    timeline: (o.timeline ?? []).map((t: { status: string; at: unknown }) => ({ status: t.status, at: toIso(t.at) })),
    createdAt: toIso(o.createdAt),
    deliveredAt: toIso(o.deliveredAt),
    cancelReason: o.cancelReason ?? null,
    store: { id: o.storeId, name: o.storeName, type: o.storeType, address: o.storeAddress, location: o.storeLocation },
    tracking: o.tracking ? { ...o.tracking, updatedAt: toIso(o.tracking.updatedAt) } : null,
  }
  const riderInfo = o.riderId
    ? { id: o.riderId, name: o.riderName ?? null, phone: o.riderPhone ?? null, vehicle: o.riderVehicle ?? null, rating: rider?.rating ?? null }
    : null

  if (viewer === 'buyer') {
    return {
      ...base,
      subtotalKobo: o.subtotalKobo,
      deliveryFeeKobo: o.deliveryFeeKobo,
      serviceFeeKobo: o.serviceFeeKobo,
      discountKobo: o.discountKobo,
      totalKobo: o.totalKobo,
      paymentMethod: o.paymentMethod,
      address: o.address,
      rider: riderInfo,
      canCancel: o.status === 'placed' && o.escrowStatus === 'held',
      canConfirm: o.status === 'delivered' && o.escrowStatus === 'held',
      canReview: ['delivered', 'completed'].includes(o.status) && !o.reviewedAt,
      canReport: ['delivered', 'completed', 'out_for_delivery'].includes(o.status) && !o.disputeId && o.escrowStatus === 'held',
      disputeId: o.disputeId ?? null,
    }
  }
  const firstName = String(o.buyerName ?? '').split(' ')[0]
  const area = [o.address?.area, o.address?.city].filter(Boolean).join(', ')
  if (viewer === 'seller') {
    return {
      ...base,
      buyer: { name: o.buyerName, area },
      subtotalKobo: o.subtotalKobo,
      commissionKobo: o.commissionKobo,
      payoutKobo: o.sellerPayoutKobo,
      rider: riderInfo,
    }
  }
  return {
    ...base,
    buyer: { name: firstName, phone: o.riderId ? o.buyerPhone : null, address: o.address },
    payKobo: o.riderPayKobo,
    bonusKobo: o.riderBonusKobo ?? 0,
    distanceKm: o.distanceKm,
    paymentProtected: o.escrowStatus === 'held',
  }
}

export function isActive(status: string) {
  return ACTIVE.has(status)
}
