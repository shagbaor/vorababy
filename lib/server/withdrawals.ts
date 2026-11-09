import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import type { Caller } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'
import { notify } from '@/lib/server/notify'
import { newReference } from '@/lib/server/payments'
import { paystack } from '@/lib/server/paystack'
import { getSettings } from '@/lib/server/settings'
import { loadWallets } from '@/lib/server/wallet'

// Sellers and riders withdraw to their verified payout account
// (withdrawals/{reference}). The wallet is debited first; a failed or
// reversed transfer puts the money back.

export async function withdrawalQuote(amountKobo: number) {
  const s = await getSettings()
  return { amountKobo, feeKobo: s.withdrawalFeeKobo, totalDebitedKobo: amountKobo + s.withdrawalFeeKobo, minKobo: s.minWithdrawalKobo }
}

export async function requestWithdrawal(caller: Caller, amountKobo: number) {
  const account = caller.profile.payoutAccount as { recipientCode: string; bankName: string; accountNumber: string; accountName: string } | undefined
  if (!account) throw new ApiError('conflict', 'Add your payout bank account first')
  const quote = await withdrawalQuote(amountKobo)
  if (amountKobo < quote.minKobo) {
    throw new ApiError('validation_failed', `The minimum withdrawal is ₦${(quote.minKobo / 100).toLocaleString()}`, { amountKobo: 'Amount too small' })
  }
  const reference = newReference('WDR')
  const ref = db().collection('withdrawals').doc(reference)

  await db().runTransaction(async (tx) => {
    const wallets = await loadWallets(tx, [caller.user.uid])
    if (wallets.balance(caller.user.uid) < quote.totalDebitedKobo) {
      throw new ApiError('payment_required', `Your balance is too low (₦${(quote.feeKobo / 100).toLocaleString()} fee included)`)
    }
    wallets.apply([{ uid: caller.user.uid, amountKobo: -quote.totalDebitedKobo, kind: 'withdrawal', description: `Withdrawal to ${account.bankName} ••${account.accountNumber.slice(-4)}`, reference }])
    tx.create(ref, {
      uid: caller.user.uid,
      amountKobo,
      feeKobo: quote.feeKobo,
      account: { bankName: account.bankName, accountNumberLast4: account.accountNumber.slice(-4), accountName: account.accountName },
      status: 'processing',
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  try {
    await paystack.transfer({ amountKobo, recipientCode: account.recipientCode, reference, reason: 'Vorapicks earnings' })
  } catch (error) {
    console.error('Paystack transfer failed to start', error)
    await settleWithdrawal(reference, 'failed')
    throw new ApiError('internal_error', 'We could not start the transfer. Your money is back in your wallet; try again later.')
  }
  return { reference, ...quote, status: 'processing' }
}

export async function settleWithdrawal(reference: string, outcome: 'success' | 'failed' | 'reversed') {
  const ref = db().collection('withdrawals').doc(reference)
  const w = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists || snapshot.get('status') !== 'processing') return null
    const data = snapshot.data()!
    if (outcome === 'success') {
      tx.update(ref, { status: 'paid', paidAt: FieldValue.serverTimestamp() })
    } else {
      const wallets = await loadWallets(tx, [data.uid])
      wallets.apply([{ uid: data.uid, amountKobo: data.amountKobo + data.feeKobo, kind: 'withdrawal_reversal', description: 'Withdrawal returned to your wallet', reference }])
      tx.update(ref, { status: 'failed', failedAt: FieldValue.serverTimestamp() })
    }
    return data
  })
  if (w) {
    await notify(
      w.uid,
      'payout',
      outcome === 'success' ? 'Withdrawal paid' : 'Withdrawal failed',
      outcome === 'success'
        ? `₦${(w.amountKobo / 100).toLocaleString()} was sent to ${w.account.bankName} ••${w.account.accountNumberLast4}.`
        : `₦${((w.amountKobo + w.feeKobo) / 100).toLocaleString()} is back in your wallet.`,
      { reference },
    )
  }
}
