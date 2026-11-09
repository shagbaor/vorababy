import { z } from 'zod'
import { pageQuery, paginate, parseQuery, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentOrder } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// All Orders, with the New / In Progress / Ready / Completed tabs.
const TABS: Record<string, string[]> = {
  new: ['placed'],
  in_progress: ['confirmed', 'preparing'],
  ready: ['ready_for_pickup', 'out_for_delivery'],
  completed: ['delivered', 'completed'],
  cancelled: ['cancelled'],
  disputed: ['disputed'],
}

export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const query = parseQuery(request, pageQuery.extend({ status: z.enum(['new', 'in_progress', 'ready', 'completed', 'cancelled', 'disputed', 'all']).default('all') }))
  const snapshot = await db().collection('orders').where('storeId', '==', user.uid).get()
  const all = snapshot.docs.sort((a, b) => b.get('createdAt').toMillis() - a.get('createdAt').toMillis())
  const counts = Object.fromEntries(Object.entries(TABS).map(([tab, statuses]) => [tab, all.filter((d) => statuses.includes(d.get('status'))).length]))
  const items = all.filter((d) => query.status === 'all' || TABS[query.status].includes(d.get('status'))).map((d) => presentOrder(d.id, d.data(), 'seller'))
  return ok({ counts, total: items.length, ...paginate(items, query) }, 'Orders loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
