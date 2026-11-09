import { z } from 'zod'
import { pageQuery, paginate, parseQuery, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentSellerRequest, type OfferDoc, type RequestDoc } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

// PERSONAL SHOPPERS (seller): requests from buyers nearby.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller'], approved: true })
  const query = parseQuery(request, pageQuery.extend({ status: z.enum(['pending', 'sent', 'approved', 'all']).default('all') }))
  const snapshot = await db().collection('shoppingRequests').where('sellerIds', 'array-contains', user.uid).get()
  const offers = snapshot.empty ? [] : await db().getAll(...snapshot.docs.map((d) => d.ref.collection('offers').doc(user.uid)))
  const all = snapshot.docs
    .map((d, i) => presentSellerRequest(d.id, d.data() as RequestDoc, offers[i].exists ? (offers[i].data() as OfferDoc) : null))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const counts = { pending: 0, sent: 0, approved: 0 } as Record<string, number>
  for (const r of all) if (r.status in counts) counts[r.status] += 1
  const items = all.filter((r) => (query.status === 'all' ? r.status !== 'closed' : r.status === query.status))
  return ok({ counts, ...paginate(items, query) }, 'Requests loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
