import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { pageQuery, paginate, parseQuery } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import {
  fromQuery,
  locationQuery,
  optionalUid,
  presentProductCard,
  storeEta,
  visibleProducts,
  visibleStores,
  wishlistIds,
} from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: Search and Filter & Sort.
const bool = z.enum(['true', 'false']).transform((v) => v === 'true')
const schema = pageQuery.extend({
  q: z.string().trim().max(80).optional(),
  mode: z.enum(['farm', 'restaurants', 'all']).default('all'),
  category: z.string().max(100).optional(),
  minPriceKobo: z.coerce.number().int().nonnegative().optional(),
  maxPriceKobo: z.coerce.number().int().nonnegative().optional(),
  farmType: z.enum(['organic', 'local', 'imported']).optional(),
  inStock: bool.optional(),
  maxDeliveryHours: z.coerce.number().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  deals: bool.optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'newest', 'popular']).default('relevance'),
  ...locationQuery,
})

function searchTerms(q: string) {
  return q.toLowerCase().split(/\s+/).filter(Boolean)
}

export const GET = handle(async (request) => {
  const query = parseQuery(request, schema)
  const from = fromQuery(query)
  const stores = await visibleStores()
  let products = await visibleProducts(stores, { categoryId: query.category })
  const terms = query.q ? searchTerms(query.q) : []

  const score = (p: (typeof products)[number]) => {
    const name = String(p.nameLower ?? p.name.toLowerCase())
    const haystack = `${name} ${String(p.description ?? '').toLowerCase()} ${String(p.storeName ?? '').toLowerCase()}`
    if (!terms.every((t) => haystack.includes(t))) return 0
    return terms.reduce((s, t) => s + (name.startsWith(t) ? 3 : name.includes(t) ? 2 : 1), 0) + Math.min(1, (p.soldCount ?? 0) / 1000)
  }

  products = products.filter((p) => {
    const store = stores.get(p.storeId)!
    if (query.mode === 'restaurants' && store.type !== 'restaurant') return false
    if (query.mode === 'farm' && store.type === 'restaurant') return false
    if (terms.length && score(p) === 0) return false
    if (query.minPriceKobo !== undefined && p.priceKobo < query.minPriceKobo) return false
    if (query.maxPriceKobo !== undefined && p.priceKobo > query.maxPriceKobo) return false
    if (query.farmType && p.farmType !== query.farmType) return false
    if (query.inStock && !((p.stock ?? 0) > 0)) return false
    if (query.minRating !== undefined && (p.rating ?? 0) < query.minRating) return false
    if (query.deals && !((p.compareAtPriceKobo ?? 0) > p.priceKobo)) return false
    if (query.maxDeliveryHours !== undefined) {
      const hours = store.type === 'restaurant' ? storeEta(store, from).etaMinutes.max / 60 : 24
      if (hours > query.maxDeliveryHours) return false
    }
    return true
  })

  const sorters: Record<typeof query.sort, (a: (typeof products)[number], b: (typeof products)[number]) => number> = {
    relevance: (a, b) => score(b) - score(a) || (b.soldCount ?? 0) - (a.soldCount ?? 0),
    price_asc: (a, b) => a.priceKobo - b.priceKobo,
    price_desc: (a, b) => b.priceKobo - a.priceKobo,
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
    newest: (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
    popular: (a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0),
  }
  products.sort(sorters[query.sort])

  // Count searches for "Popular Searches".
  if (query.q && !query.cursor && query.q.length >= 2) {
    const term = query.q.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().slice(0, 40)
    if (term) void db().collection('meta').doc('searchStats').set({ terms: { [term]: FieldValue.increment(1) } }, { merge: true }).catch(() => null)
  }

  const wishlisted = await wishlistIds(await optionalUid(request))
  const cards = products.map((p) => presentProductCard(p, stores.get(p.storeId), wishlisted))
  return ok({ total: cards.length, ...paginate(cards, query) }, cards.length ? `${cards.length} item${cards.length === 1 ? '' : 's'} found` : 'No products found')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
