import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { paymentStatus } from '@/lib/server/payments'

export const dynamic = 'force-dynamic'

// Processing Payment → Payment Successful / Unsuccessful. Poll every 2 s.
// status: pending | success | failed | refunded_to_wallet (sold out while paying)
export const GET = handle<{ params: Promise<{ reference: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request)
  const result = await paymentStatus(user.uid, (await params).reference)
  const messages: Record<string, string> = {
    pending: 'Waiting for payment',
    success: 'Payment successful',
    failed: 'Payment unsuccessful',
    refunded_to_wallet: 'Some items sold out; your money is in your wallet',
  }
  return ok(result, messages[result.status] ?? 'Payment status')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
