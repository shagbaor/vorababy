import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { loadSellerRequest, presentSellerRequest, sendOffer } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

// Send to buyer.
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['seller'], approved: true })
  const id = (await params).id
  await sendOffer(user.uid, id)
  const { r, offer } = await loadSellerRequest(user.uid, id)
  return ok(presentSellerRequest(id, r, offer), 'Suggestions sent to the buyer')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
