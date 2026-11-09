import { z } from 'zod'
import { parseQuery, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { withdrawalQuote } from '@/lib/server/withdrawals'

export const dynamic = 'force-dynamic'

// Shows the fee before withdrawing.
export const GET = handle(async (request) => {
  await requireProfile(request, { roles: ['seller', 'rider'] })
  const { amountKobo } = parseQuery(request, z.object({ amountKobo: z.coerce.number().int().nonnegative() }))
  return ok(await withdrawalQuote(amountKobo), 'Quote ready')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
