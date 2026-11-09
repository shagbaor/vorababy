import 'server-only'
import { randomBytes } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import type { OrderDraft } from '@/lib/server/cart'
import { notify } from '@/lib/server/notify'
import { notifyNewOrders, readForPlacement, writeOrders, type PlacementContext } from '@/lib/server/orders'
import { paystack, type Authorization, type Transaction } from '@/lib/server/paystack'
import { loadWallets } from '@/lib/server/wallet'

// Card and bank-transfer payments through Paystack (payments/{reference}).
// Nothing is placed or credited until Paystack confirms the money arrived,
// either by webhook or when the app asks for the payment's status. Both paths
// end in `finalizePayment`, which is safe to run more than once.

export type PaymentPurpose = 'checkout' | 'top_up' | 'card_check' | 'split_share'
export type PaymentMethod = 'card' | 'bank_transfer'

export function newReference(prefix: string) {
  return `VP-${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase()
}

export function paystackEmail(uid: string, email: string | null | undefined) {
  return email && /@/.test(email) ? email : `${uid}@customers.vorapicks.com`
}

type StartInput = {
  uid: string
  email: string
  purpose: PaymentPurpose
  amountKobo: number
  method: PaymentMethod
  savedCardId?: string
  // Saved with the payment so it can be completed later.
  checkout?: { drafts: OrderDraft[]; ctx: Omit<PlacementContext, 'paymentMethod' | 'paymentRef'> }
  splitId?: string
}

export async function startPayment(input: StartInput) {
  const reference = newReference(input.purpose === 'checkout' ? 'ORD' : input.purpose === 'top_up' ? 'TOP' : input.purpose === 'split_share' ? 'SPL' : 'CRD')
  const ref = db().collection('payments').doc(reference)
  const metadata = { uid: input.uid, purpose: input.purpose, reference }
  await ref.set({
    uid: input.uid,
    purpose: input.purpose,
    method: input.method,
    amountKobo: input.amountKobo,
    status: 'pending',
    checkout: input.checkout ?? null,
    splitId: input.splitId ?? null,
    orderIds: [],
    createdAt: FieldValue.serverTimestamp(),
  })

  if (input.method === 'bank_transfer') {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
    const charge = await paystack.bankTransfer({ email: input.email, amountKobo: input.amountKobo, reference, metadata, expiresAt })
    return {
      status: 'pending' as const,
      reference,
      bankName: charge.bank?.name ?? null,
      accountNumber: charge.account_number ?? null,
      accountName: charge.account_name ?? null,
      amountKobo: input.amountKobo,
      expiresAt: charge.account_expires_at ?? expiresAt.toISOString(),
    }
  }

  if (input.savedCardId) {
    const card = await db().collection('users').doc(input.uid).collection('cards').doc(input.savedCardId).get()
    if (!card.exists) throw new ApiError('validation_failed', 'Card not found', { savedCardId: 'Choose a saved card' })
    const charge = await paystack.chargeAuthorization({ email: input.email, amountKobo: input.amountKobo, reference, authorizationCode: card.get('authorizationCode'), metadata })
    if (charge.status === 'success') return { ...(await finalizePayment(reference, charge)), reference }
    if (charge.status === 'failed') {
      await ref.update({ status: 'failed', failureReason: 'Card declined' })
      throw new ApiError('payment_required', 'Your card was declined. Try another card or payment method.')
    }
    return { status: 'pending' as const, reference, authorizationUrl: charge.authorization_url ?? null, accessCode: null }
  }

  const init = await paystack.initialize({ email: input.email, amountKobo: input.amountKobo, reference, metadata, channels: ['card'] })
  return { status: 'pending' as const, reference, authorizationUrl: init.authorization_url, accessCode: init.access_code }
}

function saveCard(uid: string, auth: Authorization | undefined) {
  if (!auth?.reusable || auth.channel !== 'card') return null
  return async () => {
    const cards = db().collection('users').doc(uid).collection('cards')
    const existing = await cards.get()
    await cards.doc(auth.signature).set(
      {
        authorizationCode: auth.authorization_code,
        brand: auth.brand ?? auth.card_type,
        last4: auth.last4,
        expMonth: Number(auth.exp_month),
        expYear: Number(auth.exp_year),
        bank: auth.bank ?? null,
        isDefault: existing.empty || existing.docs.every((d) => d.id === auth.signature && d.get('isDefault')),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  }
}

// Completes a payment Paystack reports as successful. Idempotent.
export async function finalizePayment(reference: string, tx: Transaction) {
  const ref = db().collection('payments').doc(reference)
  if (tx.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(tx.status)) await ref.update({ status: 'failed', failureReason: tx.status })
    const current = await ref.get()
    return { status: (current.get('status') as string) ?? 'pending', orderIds: (current.get('orderIds') as string[]) ?? [] }
  }

  let after: (() => Promise<void>) | null = null
  const result = await db().runTransaction(async (t) => {
    const snapshot = await t.get(ref)
    if (!snapshot.exists) throw new ApiError('not_found', 'Payment not found')
    const p = snapshot.data()!
    if (p.status === 'success') return { status: 'success', orderIds: p.orderIds as string[], already: true }
    if (tx.amount < p.amountKobo || tx.currency !== 'NGN') {
      t.update(ref, { status: 'failed', failureReason: `Paid ${tx.amount} ${tx.currency}, expected ${p.amountKobo} NGN` })
      return { status: 'failed', orderIds: [], already: false }
    }

    if (p.purpose === 'checkout') {
      const prepared = await readForPlacement(t, p.checkout.drafts)
      if (prepared.shortages.length) {
        // Sold out while paying: the money goes to the buyer's wallet instead.
        const wallets = await loadWallets(t, [p.uid])
        wallets.apply([{ uid: p.uid, amountKobo: p.amountKobo, kind: 'refund', description: `Refund: ${prepared.shortages.join(', ')} sold out`, reference }])
        t.update(ref, { status: 'refunded_to_wallet', paystack: { channel: tx.channel }, completedAt: FieldValue.serverTimestamp() })
        after = () => notify(p.uid, 'payment', 'Order not placed', `${prepared.shortages.join(', ')} sold out while you were paying. ₦${(p.amountKobo / 100).toLocaleString()} is in your wallet.`)
        return { status: 'refunded_to_wallet', orderIds: [], already: false }
      }
      const ids = writeOrders(t, prepared, p.checkout.drafts, { ...p.checkout.ctx, paymentMethod: p.method, paymentRef: reference })
      // Bought items leave the cart.
      const bought = p.checkout.drafts.flatMap((d: OrderDraft) => d.lines.map((l) => l.productId))
      t.set(db().collection('carts').doc(p.uid), { items: Object.fromEntries(bought.map((id: string) => [id, FieldValue.delete()])), promoCode: null }, { merge: true })
      t.update(ref, { status: 'success', orderIds: ids, paystack: { channel: tx.channel }, completedAt: FieldValue.serverTimestamp() })
      after = () => notifyNewOrders(ids)
      return { status: 'success', orderIds: ids, already: false }
    }

    if (p.purpose === 'top_up' || p.purpose === 'card_check') {
      const wallets = await loadWallets(t, [p.uid])
      wallets.apply([
        {
          uid: p.uid,
          amountKobo: p.amountKobo,
          kind: p.purpose === 'top_up' ? 'top_up' : 'card_check',
          description: p.purpose === 'top_up' ? `Wallet top-up via ${tx.channel === 'bank_transfer' ? 'bank transfer' : 'card'}` : 'Card check (added to your wallet)',
          reference,
        },
      ])
      t.update(ref, { status: 'success', paystack: { channel: tx.channel }, completedAt: FieldValue.serverTimestamp() })
      return { status: 'success', orderIds: [], already: false }
    }

    if (p.purpose === 'split_share') {
      const { settleSplitShare } = await import('@/lib/server/splits')
      const out = await settleSplitShare(t, p, reference)
      t.update(ref, { status: 'success', paystack: { channel: tx.channel }, completedAt: FieldValue.serverTimestamp() })
      after = out.after
      return { status: 'success', orderIds: out.orderIds, already: false }
    }
    throw new Error(`unknown payment purpose ${p.purpose}`)
  })

  if (!result.already) {
    const owner = (await ref.get()).get('uid') as string
    await saveCard(owner, tx.authorization)?.()
    if (after) await (after as () => Promise<void>)()
  }
  return { status: result.status, orderIds: result.orderIds }
}

// GET /payments/{reference}: asks Paystack if the webhook hasn't arrived yet.
export async function paymentStatus(uid: string, reference: string) {
  const ref = db().collection('payments').doc(reference)
  const snapshot = await ref.get()
  if (!snapshot.exists || snapshot.get('uid') !== uid) throw new ApiError('not_found', 'Payment not found')
  if (snapshot.get('status') === 'pending') {
    try {
      return { reference, ...(await finalizePayment(reference, await paystack.verify(reference))) }
    } catch (error) {
      if (error instanceof ApiError) throw error
      console.error('Paystack verify failed', error)
    }
  }
  const current = await ref.get()
  return { reference, status: current.get('status') as string, orderIds: (current.get('orderIds') as string[]) ?? [] }
}

export { Timestamp }
