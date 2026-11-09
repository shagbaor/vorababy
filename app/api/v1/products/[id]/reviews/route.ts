import { pageQuery, paginate, parseQuery, toIso } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Public: the Reviews tab. Reviews are written by POST /orders/{id}/review.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params
  const query = parseQuery(request, pageQuery)
  const snapshot = await db().collection('products').doc(id).collection('reviews').orderBy('createdAt', 'desc').limit(500).get()
  const items = snapshot.docs.map((d) => ({
    id: d.id,
    rating: d.get('rating'),
    comment: d.get('comment') ?? null,
    buyerName: d.get('buyerName'),
    createdAt: toIso(d.get('createdAt')),
  }))
  return ok({ total: items.length, ...paginate(items, query) }, 'Reviews loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
