import { z } from 'zod'
import { kobo, parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { paystackEmail, startPayment } from '@/lib/server/payments'
import { getSettings } from '@/lib/server/settings'

export const dynamic = 'force-dynamic'

// Add Money: same payment flow as checkout; the wallet is credited once Paystack confirms.
const schema = z.object({ amountKobo: kobo, method: z.enum(['card', 'bank_transfer']), savedCardId: z.string().max(200).optional() })

export const POST = handle(async (request) => {
  const { user, profile } = await requireProfile(request)
  const body = await parseBody(request, schema)
  const settings = await getSettings()
  if (body.amountKobo < settings.minTopUpKobo) {
    throw new ApiError('validation_failed', `The minimum top-up is ₦${(settings.minTopUpKobo / 100).toLocaleString()}`, { amountKobo: 'Amount too small' })
  }
  if (body.amountKobo > 100_000_000) throw new ApiError('validation_failed', 'The maximum top-up is ₦1,000,000', { amountKobo: 'Amount too large' })
  const payment = await startPayment({
    uid: user.uid,
    email: paystackEmail(user.uid, profile.email || user.email),
    purpose: 'top_up',
    amountKobo: body.amountKobo,
    method: body.method,
    savedCardId: body.savedCardId,
  })
  return ok(payment, payment.status === 'success' ? 'Wallet topped up' : 'Complete the payment')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
