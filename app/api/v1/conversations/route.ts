import { z } from 'zod'
import { pageQuery, paginate, parseBody, parseQuery, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { loadConversation, openOrderChat, openSupport, presentChat, presentSupport, supportId, type ChatDoc } from '@/lib/server/chat'

export const dynamic = 'force-dynamic'

// Messages list. Tabs: buyers see seller / rider / support; sellers see
// buyer / rider / support; riders see buyer / seller / support.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request)
  const query = parseQuery(request, pageQuery.extend({ type: z.enum(['buyer', 'seller', 'rider', 'support', 'all']).default('all') }))
  const [chats, support, summary] = await Promise.all([
    db().collection('chats').where('participantIds', 'array-contains', user.uid).get(),
    db().collection('conversations').doc(supportId(user.uid)).get(),
    db().collection('users').doc(user.uid).collection('inbox').doc('summary').get(),
  ])
  const everything = [
    ...chats.docs.map((d) => presentChat(d.id, d.data() as ChatDoc, user.uid)),
    ...(support.exists ? [presentSupport(support.id, support.data()!)] : []),
  ]
  const all = everything
    .filter((c) => query.type === 'all' || c.type === query.type)
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
  const unreadByType = { buyer: 0, seller: 0, rider: 0, support: 0 } as Record<string, number>
  for (const c of everything) unreadByType[c.type] += c.unreadCount
  return ok({ total: all.length, totalUnread: (summary.get('unread') as number | undefined) ?? 0, unreadByType, ...paginate(all, query) }, 'Conversations loaded')
})

// Open a conversation: { orderId, with: 'seller' | 'rider' | 'buyer' } for an
// order chat, or { type: 'support', orderId? } for Vorapicks support.
const schema = z.union([
  z.object({ type: z.literal('support'), orderId: z.string().max(40).optional() }),
  z.object({ orderId: z.string().min(1).max(40), with: z.enum(['buyer', 'seller', 'rider']) }),
])

export const POST = handle(async (request) => {
  const caller = await requireProfile(request)
  const body = await parseBody(request, schema)
  if ('type' in body) {
    const id = await openSupport(caller, body.orderId)
    const convo = await loadConversation(caller.user.uid, id)
    return ok(presentSupport(id, convo.data), 'Conversation ready')
  }
  if (caller.profile.role === body.with) throw new ApiError('validation_failed', 'Choose who to message', { with: 'Choose someone else' })
  const { id, doc } = await openOrderChat(caller, body.orderId, body.with)
  return ok(presentChat(id, doc, caller.user.uid), 'Conversation ready')
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
