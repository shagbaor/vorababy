import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { loadConversation, presentChat, presentSupport, type ChatDoc } from '@/lib/server/chat'

export const dynamic = 'force-dynamic'

// Chat header: counterpart, order number, unread.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request)
  const { id } = await params
  const convo = await loadConversation(user.uid, id)
  return ok(convo.support ? presentSupport(id, convo.data) : presentChat(id, convo.data as ChatDoc, user.uid), 'Conversation loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
