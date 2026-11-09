import { z } from 'zod'
import { kobo, optionalText, parseBody, requireProfile, text } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { UNITS } from '@/lib/server/catalog'
import { addSuggestion, loadSellerRequest, presentSellerRequest } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: text(120, 2),
  priceKobo: kobo.positive('Enter a price'),
  unit: z.enum(UNITS),
  note: optionalText(300),
  productId: z.string().max(128).optional(),
})

// Add a suggestion (saved as a draft until "Send to buyer").
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const caller = await requireProfile(request, { roles: ['seller'], approved: true })
  const id = (await params).id
  await addSuggestion(caller, id, await parseBody(request, schema))
  const { r, offer } = await loadSellerRequest(caller.user.uid, id)
  return ok(presentSellerRequest(id, r, offer), 'Suggestion added', 201)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
