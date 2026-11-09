import 'server-only'
import { FieldValue, type Transaction } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

// Wallet balances live on users/{uid}.walletBalanceKobo, and every change is
// recorded in users/{uid}/walletTransactions with the balance after it.
//
// Firestore transactions need all reads before any write, so callers use
// `loadWallets` first (with their other reads), then `apply` the changes.

export type WalletKind =
  | 'top_up'
  | 'order_payment'
  | 'refund'
  | 'sale'
  | 'delivery_pay'
  | 'bonus'
  | 'withdrawal'
  | 'withdrawal_reversal'
  | 'split_share'
  | 'card_check'

export type WalletChange = {
  uid: string
  amountKobo: number // positive = credit, negative = debit
  kind: WalletKind
  description: string
  orderId?: string
  reference?: string
}

export async function loadWallets(tx: Transaction, uids: string[]) {
  const unique = [...new Set(uids)]
  const docs = unique.length ? await tx.getAll(...unique.map((uid) => db().collection('users').doc(uid))) : []
  const balances = new Map(docs.map((d) => [d.id, (d.get('walletBalanceKobo') as number | undefined) ?? 0]))

  return {
    balance: (uid: string) => balances.get(uid) ?? 0,
    // Writes the changes; throws payment_required if a debit would go below zero.
    apply(changes: WalletChange[]) {
      for (const change of changes) {
        if (!balances.has(change.uid)) throw new Error(`wallet ${change.uid} was not loaded`)
        const next = balances.get(change.uid)! + change.amountKobo
        if (next < 0) throw new ApiError('payment_required', 'Your wallet balance is too low')
        balances.set(change.uid, next)
        const user = db().collection('users').doc(change.uid)
        tx.update(user, { walletBalanceKobo: next })
        tx.set(user.collection('walletTransactions').doc(), {
          type: change.amountKobo >= 0 ? 'credit' : 'debit',
          kind: change.kind,
          amountKobo: Math.abs(change.amountKobo),
          description: change.description,
          orderId: change.orderId ?? null,
          reference: change.reference ?? null,
          balanceAfterKobo: next,
          createdAt: FieldValue.serverTimestamp(),
        })
      }
    },
  }
}
