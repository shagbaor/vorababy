import 'server-only'
import { z } from 'zod'
import { adminAuth, db } from '@/lib/firebase/admin'
import { toIso } from '@/lib/api/guard'
import { distanceKm, isOpenNow, travelMinutes, type LatLng } from '@/lib/server/geo'

// Browsing: which stores and products buyers can see, and how they look in
// lists. Search filters in memory over the visible catalog, which is fine for
// the first few thousand products; move to a search service after that.

export const UNITS = ['kg', 'g', 'bag', 'bunch', 'bundle', 'piece', 'pack', 'crate', 'plate', 'portion', 'bottle', 'litre', 'dozen', 'basket'] as const

export type StoreDoc = FirebaseFirestore.DocumentData & { id: string }
export type ProductDoc = FirebaseFirestore.DocumentData & { id: string }

// Approved stores whose owner is not suspended.
export async function visibleStores() {
  const snapshot = await db().collection('stores').where('verificationStatus', '==', 'approved').get()
  const stores = new Map<string, StoreDoc>()
  snapshot.docs.forEach((d) => d.get('ownerActive') !== false && stores.set(d.id, { ...d.data(), id: d.id }))
  return stores
}

export async function visibleProducts(stores: Map<string, StoreDoc>, filter?: { categoryId?: string; storeId?: string }) {
  let query: FirebaseFirestore.Query = db().collection('products').where('status', '==', 'published')
  if (filter?.storeId) query = query.where('storeId', '==', filter.storeId)
  else if (filter?.categoryId) query = query.where('categoryId', '==', filter.categoryId)
  const snapshot = await query.get()
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductDoc).filter((p) => stores.has(p.storeId))
}

export function storeEta(store: StoreDoc, from?: LatLng) {
  const km = from && store.location ? distanceKm(from, store.location) : null
  const prep = store.type === 'restaurant' ? (store.prepMinutes ?? 20) : 30
  const travel = km === null ? 25 : travelMinutes(km)
  return { distanceKm: km, etaMinutes: { min: prep + travel - 5, max: prep + travel + 5 } }
}

export function presentStoreCard(store: StoreDoc, from?: LatLng, highlights: string[] = []) {
  return {
    id: store.id,
    name: store.name,
    type: store.type,
    tagline: store.tagline ?? null,
    logoUrl: store.logoUrl ?? null,
    coverUrl: store.coverUrl ?? null,
    city: store.address?.city ?? null,
    rating: store.rating ?? null,
    ratingCount: store.ratingCount ?? 0,
    isOpenNow: isOpenNow(store.isOpen, store.openingHours),
    highlights,
    ...storeEta(store, from),
  }
}

export function presentProductCard(p: ProductDoc, store?: StoreDoc, wishlisted?: Set<string>) {
  const onDeal = typeof p.compareAtPriceKobo === 'number' && p.compareAtPriceKobo > p.priceKobo
  return {
    id: p.id,
    name: p.name,
    photoUrl: p.photos?.[0]?.url ?? null,
    priceKobo: p.priceKobo,
    compareAtPriceKobo: onDeal ? p.compareAtPriceKobo : null,
    unit: p.unit,
    inStock: (p.stock ?? 0) > 0,
    rating: p.rating ?? null,
    ratingCount: p.ratingCount ?? 0,
    prepMinutes: p.prepMinutes ?? null,
    categoryId: p.categoryId,
    store: store ? { id: store.id, name: store.name, type: store.type, isOpenNow: isOpenNow(store.isOpen, store.openingHours) } : { id: p.storeId, name: p.storeName },
    ...(wishlisted && { isWishlisted: wishlisted.has(p.id) }),
  }
}

export function presentProduct(p: ProductDoc, store: StoreDoc, wishlisted?: Set<string>) {
  return {
    ...presentProductCard(p, store, wishlisted),
    photos: (p.photos ?? []).map((photo: { url: string }) => photo.url),
    description: p.description ?? null,
    highlights: p.highlights ?? [],
    farmType: p.farmType ?? null,
    stock: p.stock ?? 0,
    soldCount: p.soldCount ?? 0,
    deliveryEstimate: store.type === 'restaurant' ? `${p.prepMinutes ?? 20} min prep` : (store.deliveryEstimate ?? '1d'),
    menuSectionId: p.menuSectionId ?? null,
    store: {
      ...presentStoreCard(store),
      isOnline: Boolean(store.lastSeenAt && Date.now() - store.lastSeenAt.toDate().getTime() < 10 * 60 * 1000),
      location: store.address ? `${store.address.city}${store.address.state ? `, ${store.address.state}` : ''}` : null,
    },
    createdAt: toIso(p.createdAt),
  }
}

// Optional sign-in for public endpoints (to show wishlist hearts).
export async function optionalUid(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match) return null
  try {
    return (await adminAuth().verifyIdToken(match[1])).uid
  } catch {
    return null
  }
}

export async function wishlistIds(uid: string | null) {
  if (!uid) return undefined
  const snapshot = await db().collection('users').doc(uid).collection('wishlist').get()
  return new Set(snapshot.docs.map((d) => d.id))
}

export const locationQuery = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
}

export function fromQuery(q: { lat?: number; lng?: number }): LatLng | undefined {
  return q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined
}
