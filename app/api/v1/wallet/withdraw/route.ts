import { z } from 'zod'
import { kobo, parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { requestWithdrawal } from '@/lib/server/withdrawals'

export const dynamic = 'force-dynamic'

// Withdraw Earnings (sellers and riders) to the verified payout account.
export const POST = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller', 'rider'], approved: true })
  const { amountKobo } = await parseBody(request, z.object({ amountKobo: kobo }))
  return ok(await requestWithdrawal(caller, amountKobo), 'Withdrawal initiated', 201)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
