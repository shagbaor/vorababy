import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { loadBuyerRequest, presentRequest } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

// Request detail with every seller's sent suggestions.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const id = (await params).id
  const { r, offers } = await loadBuyerRequest(user.uid, id)
  return ok(presentRequest(id, r, offers), 'Request loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
