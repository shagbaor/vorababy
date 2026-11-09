import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { loadSellerRequest, presentSellerRequest } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'], approved: true })
  const id = (await params).id
  const { r, offer } = await loadSellerRequest(user.uid, id)
  return ok(presentSellerRequest(id, r, offer), 'Request loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
