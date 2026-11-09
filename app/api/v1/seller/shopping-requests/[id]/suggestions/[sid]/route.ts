import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { loadSellerRequest, presentSellerRequest, removeSuggestion } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

export const DELETE = handle<{ params: Promise<{ id: string; sid: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'], approved: true })
  const { id, sid } = await params
  await removeSuggestion(user.uid, id, sid)
  const { r, offer } = await loadSellerRequest(user.uid, id)
  return ok(presentSellerRequest(id, r, offer), 'Suggestion removed')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH }
