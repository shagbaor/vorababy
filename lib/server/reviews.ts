import 'server-only'
import { toIso } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'

// Store reviews (stores/{storeId}/reviews/{orderId}), written when a buyer
// rates a delivered order. Buyers may stay anonymous; then no name is kept.

export function presentReview(d: FirebaseFirestore.DocumentSnapshot, viewer?: string | null) {
  const helpfulBy = (d.get('helpfulBy') as string[] | undefined) ?? []
  return {
    id: d.id,
    rating: d.get('rating') as number,
    comment: (d.get('comment') as string | null) ?? null,
    name: d.get('anonymous') ? 'Anonymous' : ((d.get('buyerName') as string | null) ?? 'Vorapicks buyer'),
    anonymous: Boolean(d.get('anonymous')),
    items: (d.get('items') as string[] | undefined) ?? [],
    helpfulCount: helpfulBy.length,
    helpfulByMe: viewer ? helpfulBy.includes(viewer) : false,
    createdAt: toIso(d.get('createdAt')),
  }
}

export async function storeReviews(storeId: string, limit = 200, viewer?: string | null) {
  const snapshot = await db().collection('stores').doc(storeId).collection('reviews').orderBy('createdAt', 'desc').limit(limit).get()
  // Older reviews were saved without the items: read them from the orders.
  const missing = snapshot.docs.filter((d) => !d.get('items'))
  const orders = missing.length ? await db().getAll(...missing.map((d) => db().collection('orders').doc(d.id))) : []
  const items = new Map(orders.map((o) => [o.id, ((o.get('items') ?? []) as { name?: string }[]).map((i) => i.name).filter(Boolean).slice(0, 5) as string[]]))
  return snapshot.docs.map((d) => {
    const r = presentReview(d, viewer)
    return items.has(d.id) ? { ...r, items: items.get(d.id)! } : r
  })
}

// The most recent review with a comment, for the store page's rating card.
export async function topReview(storeId: string) {
  const snapshot = await db().collection('stores').doc(storeId).collection('reviews').orderBy('createdAt', 'desc').limit(20).get()
  const withText = snapshot.docs.find((d) => (d.get('comment') as string | null)?.trim())
  return withText ? presentReview(withText) : null
}
