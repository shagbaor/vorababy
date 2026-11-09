import { z } from 'zod'
import { parseQuery } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import {
  fromQuery,
  locationQuery,
  optionalUid,
  presentProductCard,
  presentStoreCard,
  visibleProducts,
  visibleStores,
  wishlistIds,
} from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: everything on the home screen in one call.
const schema = z.object({ mode: z.enum(['farm', 'restaurants', 'all']).default('all'), ...locationQuery })

export const GET = handle(async (request) => {
  const query = parseQuery(request, schema)
  const from = fromQuery(query)
  const [stores, categories, content, uid] = await Promise.all([
    visibleStores(),
    db().collection('categories').orderBy('position').get(),
    db().collection('meta').doc('content').get(),
    optionalUid(request),
  ])
  const products = await visibleProducts(stores)
  const wishlisted = await wishlistIds(uid)
  const inMode = (type: string) => query.mode === 'all' || (query.mode === 'restaurants' ? type === 'restaurant' : type !== 'restaurant')

  const shopProducts = products.filter((p) => inMode(stores.get(p.storeId)!.type) && (p.stock ?? 0) > 0)
  const card = (p: (typeof products)[number]) => presentProductCard(p, stores.get(p.storeId), wishlisted)

  const restaurants = [...stores.values()]
    .filter((s) => s.type === 'restaurant')
    .map((s) => {
      const top = products.filter((p) => p.storeId === s.id).sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
      return presentStoreCard(s, from, top.slice(0, 3).map((p) => p.name))
    })
    .sort((a, b) => Number(b.isOpenNow) - Number(a.isOpenNow) || (a.distanceKm ?? 999) - (b.distanceKm ?? 999))

  return ok(
    {
      banners: (content.get('banners') as unknown[] | undefined) ?? [
        { id: 'farm-fresh', title: 'Farm Fresh Daily', subtitle: 'Direct from local farms to your door', action: 'Shop Now', mode: 'farm' },
      ],
      categories: categories.docs
        .map((d) => ({ id: d.id, name: d.get('name'), icon: d.get('icon') ?? null, mode: d.get('mode') }))
        .filter((c) => query.mode === 'all' || c.mode === query.mode),
      flashDeals: shopProducts.filter((p) => (p.compareAtPriceKobo ?? 0) > p.priceKobo).slice(0, 10).map(card),
      popular: [...shopProducts].sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0)).slice(0, 10).map(card),
      newArrivals: [...shopProducts].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 10).map(card),
      restaurantsNearby: query.mode === 'farm' ? [] : restaurants.slice(0, 10),
      restaurantsNearbyCount: query.mode === 'farm' ? 0 : restaurants.length,
    },
    'Home loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
