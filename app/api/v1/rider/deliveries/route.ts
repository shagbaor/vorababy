import { z } from 'zod'
import { pageQuery, paginate, parseQuery, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentOrder } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// My Deliveries.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['rider'] })
  const query = parseQuery(request, pageQuery.extend({ status: z.enum(['active', 'completed', 'all']).default('all') }))
  const snapshot = await db().collection('orders').where('riderId', '==', user.uid).get()
  const active = (s: string) => ['ready_for_pickup', 'out_for_delivery'].includes(s)
  const items = snapshot.docs
    .filter((d) => query.status === 'all' || (query.status === 'active') === active(d.get('status')))
    .sort((a, b) => (b.get('assignedAt')?.toMillis() ?? 0) - (a.get('assignedAt')?.toMillis() ?? 0))
    .map((d) => ({ ...presentOrder(d.id, d.data(), 'rider'), riderArrivedAt: d.get('riderArrivedAt')?.toDate?.().toISOString() ?? null }))
  return ok({ total: items.length, ...paginate(items, query) }, items.length ? 'Deliveries loaded' : 'No deliveries yet')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
