import { z } from 'zod'
import { pageQuery, paginate, parseQuery } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { fromQuery, locationQuery, presentStoreCard, visibleProducts, visibleStores } from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: "See all" restaurants or farms, nearest and open first.
const schema = pageQuery.extend({ type: z.enum(['farm', 'restaurant', 'vendor']).optional(), q: z.string().max(80).optional(), ...locationQuery })

export const GET = handle(async (request) => {
  const query = parseQuery(request, schema)
  const from = fromQuery(query)
  const stores = await visibleStores()
  const products = await visibleProducts(stores)
  const q = query.q?.trim().toLowerCase()

  const cards = [...stores.values()]
    .filter((s) => (!query.type || s.type === query.type) && (!q || s.nameLower?.includes(q) || s.tagline?.toLowerCase().includes(q)))
    .map((s) => {
      const top = products.filter((p) => p.storeId === s.id).sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
      return presentStoreCard(s, from, top.slice(0, 3).map((p) => p.name))
    })
    .sort((a, b) => Number(b.isOpenNow) - Number(a.isOpenNow) || (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || (b.rating ?? 0) - (a.rating ?? 0))

  return ok({ total: cards.length, ...paginate(cards, query) }, 'Stores loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
