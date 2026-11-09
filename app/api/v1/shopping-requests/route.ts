import { z } from 'zod'
import { kobo, pageQuery, paginate, parseBody, parseQuery, requireProfile, text } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { addressSchema, resolveAddress } from '@/lib/server/addresses'
import { createRequest, presentRequest, type RequestDoc } from '@/lib/server/shopping'

export const dynamic = 'force-dynamic'

// My shopping requests (buyer).
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const query = parseQuery(request, pageQuery)
  const snapshot = await db().collection('shoppingRequests').where('buyerId', '==', user.uid).get()
  const items = snapshot.docs
    .map((d) => presentRequest(d.id, d.data() as RequestDoc))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  return ok(paginate(items, query), 'Requests loaded')
})

// Make a Shopping Request → Request Submitted!
const schema = z.object({
  description: text(500, 5),
  budgetKobo: kobo.positive().optional(),
  neededBy: z.string().datetime({ offset: true, message: 'Use an ISO date and time' }),
  addressId: z.string().max(100).optional(),
  address: addressSchema.omit({ label: true, isDefault: true }).extend({ label: z.string().max(40).optional() }).optional(),
})

export const POST = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['buyer'] })
  const body = await parseBody(request, schema)
  const address = await resolveAddress(caller.ref, body as never)
  const { id, doc } = await createRequest(caller, { description: body.description, budgetKobo: body.budgetKobo, neededBy: new Date(body.neededBy), address })
  return ok({ ...presentRequest(id, doc), sellersNotified: doc.sellerIds.length }, 'Request submitted. Sellers nearby will send suggestions.', 201)
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
