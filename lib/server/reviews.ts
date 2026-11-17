import 'server-only'
import { toIso } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'

// Store reviews (stores/{storeId}/reviews/{orderId}), written when a buyer
// rates a delivered order. Buyers may stay anonymous; then no name is kept.

export function presentReview(d: FirebaseFirestore.DocumentSnapshot) {
  return {
    id: d.id,
    rating: d.get('rating') as number,
    comment: (d.get('comment') as string | null) ?? null,
    name: d.get('anonymous') ? 'Anonymous' : ((d.get('buyerName') as string | null) ?? 'Vorapicks buyer'),
    anonymous: Boolean(d.get('anonymous')),
    createdAt: toIso(d.get('createdAt')),
  }
}

export async function storeReviews(storeId: string, limit = 200) {
  const snapshot = await db().collection('stores').doc(storeId).collection('reviews').orderBy('createdAt', 'desc').limit(limit).get()
  return snapshot.docs.map(presentReview)
}

// The most recent review with a comment, for the store page's rating card.
export async function topReview(storeId: string) {
  const snapshot = await db().collection('stores').doc(storeId).collection('reviews').orderBy('createdAt', 'desc').limit(20).get()
  const withText = snapshot.docs.find((d) => (d.get('comment') as string | null)?.trim())
  return withText ? presentReview(withText) : null
}
