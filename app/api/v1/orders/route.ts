import { z } from 'zod'
import { pageQuery, paginate, parseQuery, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { isActive, presentOrder } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// My Orders.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const query = parseQuery(request, pageQuery.extend({ status: z.enum(['active', 'completed', 'all']).default('all') }))
  const snapshot = await db().collection('orders').where('buyerId', '==', user.uid).get()
  const items = snapshot.docs
    .filter((d) => query.status === 'all' || (query.status === 'active') === isActive(d.get('status')))
    .sort((a, b) => b.get('createdAt').toMillis() - a.get('createdAt').toMillis())
    .map((d) => {
      const o = presentOrder(d.id, d.data(), 'buyer')
      return { id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt, itemCount: o.itemCount, status: o.status, step: o.step, totalKobo: (o as { totalKobo: number }).totalKobo, escrowStatus: o.escrowStatus, store: o.store }
    })
  return ok({ total: items.length, ...paginate(items, query) }, items.length ? 'Orders loaded' : 'No orders yet')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
