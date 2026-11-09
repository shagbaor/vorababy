import { z } from 'zod'
import { parse, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { presentCart } from '@/lib/server/cart-present'
import { acceptOffer, closeRequest, loadBuyerRequest, presentRequest } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

const acceptSchema = z.object({
  sellerId: z.string().min(1).max(128),
  suggestionIds: z.array(z.string().max(20)).min(1, 'Choose at least one item').max(30),
  // Optional quantities per suggestion id (default 1).
  quantities: z.record(z.number().int().min(1).max(99)).optional(),
})

// accept: the chosen suggestions go into the cart, then normal checkout.
// close: the buyer no longer needs the request.
export const POST = handle<{ params: Promise<{ id: string; action: string }> }>(async (request, { params }) => {
  const caller = await requireProfile(request, { roles: ['buyer'] })
  const { id, action } = await params

  if (action === 'accept') {
    const body = parse(acceptSchema, await readJson(request))
    const picks = [...new Set(body.suggestionIds)].map((suggestionId) => ({ suggestionId, quantity: body.quantities?.[suggestionId] ?? 1 }))
    await acceptOffer(caller, id, body.sellerId, picks)
    return ok({ cart: await presentCart(caller.user.uid) }, 'Added to your cart. Check out to place the order.')
  }
  if (action === 'close') {
    await closeRequest(caller.user.uid, id)
    const { r, offers } = await loadBuyerRequest(caller.user.uid, id)
    return ok(presentRequest(id, r, offers), 'Request closed')
  }
  throw new ApiError('not_found', 'No such endpoint')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
