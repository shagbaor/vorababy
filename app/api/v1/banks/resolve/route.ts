import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { allowAttempt } from '@/lib/admin/rate-limit'
import { ApiError } from '@/lib/api/response'
import { accountSchema, resolveAccount } from '@/lib/server/banks'

export const dynamic = 'force-dynamic'

// Shows the account holder's name so the person can confirm it.
export const POST = handle(async (request) => {
  const { user } = await requireProfile(request)
  const body = await parseBody(request, accountSchema)
  if (!(await allowAttempt(`bank-resolve:${user.uid}`, 20, 60))) throw new ApiError('rate_limited', 'Too many lookups. Try again in an hour.')
  const account = await resolveAccount(body.bankCode, body.accountNumber)
  return ok({ accountName: account.accountName, bankName: account.bankName }, 'Account found')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
