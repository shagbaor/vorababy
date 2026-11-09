import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { markRead } from '@/lib/server/chat'

export const dynamic = 'force-dynamic'

// Opening a chat clears its unread badge.
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request)
  await markRead(user.uid, (await params).id)
  return ok(null, 'Marked as read')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
