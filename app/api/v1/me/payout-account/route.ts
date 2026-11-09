import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentPayout } from '@/lib/server/accounts'
import { accountSchema, resolveAccount } from '@/lib/server/banks'
import { paystack } from '@/lib/server/paystack'
import { allowAttempt } from '@/lib/admin/rate-limit'

export const dynamic = 'force-dynamic'

// Where sellers' and riders' earnings are paid. The account name always comes
// from the bank, never from the app.

export const GET = handle(async (request) => {
  const { profile } = await requireProfile(request, { roles: ['seller', 'rider'] })
  return ok(presentPayout(profile), profile.payoutAccount ? 'Payout account loaded' : 'No payout account yet')
})

export const PUT = handle(async (request) => {
  const { user, ref } = await requireProfile(request, { roles: ['seller', 'rider'] })
  const body = await parseBody(request, accountSchema)
  if (!(await allowAttempt(`bank-resolve:${user.uid}`, 20, 60))) throw new ApiError('rate_limited', 'Too many lookups. Try again in an hour.')
  const account = await resolveAccount(body.bankCode, body.accountNumber)
  const recipient = await paystack.createRecipient({ name: account.accountName, accountNumber: account.accountNumber, bankCode: account.bankCode })
  await ref.update({
    payoutAccount: { ...account, recipientCode: recipient.recipient_code },
    updatedAt: FieldValue.serverTimestamp(),
  })
  const updated = (await ref.get()).data()!
  return ok(presentPayout(updated as never), 'Payout account saved')
})

export { methodNotAllowed as POST, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
