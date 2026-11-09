import { z } from 'zod'
import { pageQuery, paginate, parseQuery } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { optionalUid, presentProductCard, visibleProducts, visibleStores, wishlistIds } from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: a store's menu or produce. section=popular sorts by sales.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params
  const query = parseQuery(request, pageQuery.extend({ section: z.string().max(100).optional() }))
  const stores = await visibleStores()
  const store = stores.get(id)
  if (!store) throw new ApiError('not_found', 'Store not found')

  let products = await visibleProducts(stores, { storeId: id })
  if (query.section === 'popular') products = products.sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
  else if (query.section && query.section !== 'all') products = products.filter((p) => p.menuSectionId === query.section)
  else products = products.sort((a, b) => a.name.localeCompare(b.name))

  const wishlisted = await wishlistIds(await optionalUid(request))
  return ok({ total: products.length, ...paginate(products.map((p) => ({ ...presentProductCard(p, store, wishlisted), description: p.description ?? null })), query) }, 'Products loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
