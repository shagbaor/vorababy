import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { paystackEmail, startPayment } from '@/lib/server/payments'

export const dynamic = 'force-dynamic'

// Payment Methods. Cards are saved automatically after a successful card
// payment (Paystack keeps the card; we keep a reusable authorization only).
export const GET = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const snapshot = await ref.collection('cards').get()
  const items = snapshot.docs.map((d) => ({
    id: d.id,
    brand: d.get('brand'),
    last4: d.get('last4'),
    expMonth: d.get('expMonth'),
    expYear: d.get('expYear'),
    bank: d.get('bank') ?? null,
    isDefault: Boolean(d.get('isDefault')),
  }))
  return ok({ items: items.sort((a, b) => Number(b.isDefault) - Number(a.isDefault)) }, 'Cards loaded')
})

// "Add Card": a ₦50 card check through Paystack; the ₦50 goes into the wallet.
export const POST = handle(async (request) => {
  const { user, profile } = await requireProfile(request)
  const payment = await startPayment({ uid: user.uid, email: paystackEmail(user.uid, profile.email || user.email), purpose: 'card_check', amountKobo: 5_000, method: 'card' })
  return ok(payment, 'Enter your card details on the Paystack screen')
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
