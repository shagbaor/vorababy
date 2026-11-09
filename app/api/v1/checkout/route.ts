import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { deliverySchema, quoteCheckout } from '@/lib/server/checkout'
import { notifyNewOrders, readForPlacement, writeOrders } from '@/lib/server/orders'
import { paystackEmail, startPayment } from '@/lib/server/payments'
import { loadWallets } from '@/lib/server/wallet'

export const dynamic = 'force-dynamic'

// Place order / Pay. Wallet payments place the orders at once; card and bank
// transfer return what the app needs to finish paying with Paystack.
const schema = deliverySchema.extend({
  paymentMethod: z.enum(['wallet', 'card', 'bank_transfer']),
  savedCardId: z.string().max(200).optional(),
})

export const POST = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['buyer'] })
  const body = await parseBody(request, schema)
  const quote = await quoteCheckout(caller, body)
  const ctx = {
    buyer: { uid: caller.user.uid, name: caller.profile.name, phone: caller.profile.phone || caller.user.phone || '' },
    address: quote.address,
    deliverySlot: body.deliverySlot,
    note: body.note ?? null,
    promoCode: quote.promo.code,
  }

  if (body.paymentMethod === 'wallet') {
    const ids = await db().runTransaction(async (tx) => {
      const prepared = await readForPlacement(tx, quote.drafts)
      if (prepared.shortages.length) throw new ApiError('conflict', `${prepared.shortages.join(', ')} just sold out`)
      const wallets = await loadWallets(tx, [caller.user.uid])
      if (wallets.balance(caller.user.uid) < quote.totals.totalKobo) {
        throw new ApiError('payment_required', 'Your wallet balance is too low. Top up or choose another payment method.', {
          balanceKobo: wallets.balance(caller.user.uid),
          totalKobo: quote.totals.totalKobo,
        })
      }
      const orderIds = writeOrders(tx, prepared, quote.drafts, { ...ctx, paymentMethod: 'wallet', paymentRef: null })
      wallets.apply([{ uid: caller.user.uid, amountKobo: -quote.totals.totalKobo, kind: 'order_payment', description: `Payment for ${orderIds.join(', ')}` }])
      const bought = quote.drafts.flatMap((d) => d.lines.map((l) => l.productId))
      tx.set(db().collection('carts').doc(caller.user.uid), { items: Object.fromEntries(bought.map((id) => [id, FieldValue.delete()])), promoCode: null }, { merge: true })
      return orderIds
    })
    await notifyNewOrders(ids)
    return ok({ status: 'success', orderIds: ids, totalKobo: quote.totals.totalKobo }, 'Order placed', 201)
  }

  const payment = await startPayment({
    uid: caller.user.uid,
    email: paystackEmail(caller.user.uid, caller.profile.email || caller.user.email),
    purpose: 'checkout',
    amountKobo: quote.totals.totalKobo,
    method: body.paymentMethod,
    savedCardId: body.savedCardId,
    checkout: { drafts: quote.drafts, ctx },
  })
  return ok({ ...payment, totalKobo: quote.totals.totalKobo }, payment.status === 'success' ? 'Order placed' : 'Complete the payment', payment.status === 'success' ? 201 : 200)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
