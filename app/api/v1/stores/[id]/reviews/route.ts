import { pageQuery, paginate, parseQuery } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { visibleStores } from '@/lib/server/catalog'
import { requireUser } from '@/lib/api/auth'
import { storeReviews } from '@/lib/server/reviews'

export const dynamic = 'force-dynamic'

// Public: a store's reviews (newest first) with the rating breakdown.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params
  const query = parseQuery(request, pageQuery)
  const store = (await visibleStores()).get(id)
  if (!store) throw new ApiError('not_found', 'Store not found')
  // Signed-in viewers see which reviews they marked helpful.
  const viewer = await requireUser(request).then((u) => u.uid).catch(() => null)
  const items = await storeReviews(id, 200, viewer)
  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: items.filter((r) => r.rating === stars).length }))
  return ok(
    { rating: store.rating ?? null, ratingCount: store.ratingCount ?? 0, breakdown, total: items.length, ...paginate(items, query) },
    items.length ? 'Reviews loaded' : 'No reviews yet',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
