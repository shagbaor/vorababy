import { pageQuery, paginate, parseQuery, requireProfile, toIso } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// In-app notifications (Alerts). The same events are also sent as pushes.
export const GET = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const query = parseQuery(request, pageQuery)
  const snapshot = await ref.collection('notifications').orderBy('createdAt', 'desc').limit(200).get()
  const items = snapshot.docs.map((d) => ({
    id: d.id,
    type: d.get('type'),
    title: d.get('title'),
    body: d.get('body'),
    data: d.get('data') ?? {},
    read: Boolean(d.get('read')),
    createdAt: toIso(d.get('createdAt')),
  }))
  return ok({ unreadCount: items.filter((n) => !n.read).length, total: items.length, ...paginate(items, query) }, 'Notifications loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
