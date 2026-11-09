import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Wallet header. For sellers and riders, pendingKobo is money in orders still
// waiting for the buyer to confirm delivery.
export const GET = handle(async (request) => {
  const { user, profile, ref } = await requireProfile(request)
  const ledger = await ref.collection('walletTransactions').get()
  const sum = (kinds: string[]) => ledger.docs.filter((d) => kinds.includes(d.get('kind'))).reduce((n, d) => n + d.get('amountKobo'), 0)
  const count = (kinds: string[]) => ledger.docs.filter((d) => kinds.includes(d.get('kind'))).length

  let pendingKobo = 0
  if (profile.role === 'seller' || profile.role === 'rider') {
    const field = profile.role === 'seller' ? 'storeId' : 'riderId'
    const held = await db().collection('orders').where(field, '==', user.uid).where('escrowStatus', '==', 'held').get()
    pendingKobo = held.docs.reduce((n, d) => n + (profile.role === 'seller' ? d.get('sellerPayoutKobo') : d.get('riderPayKobo') + (d.get('riderBonusKobo') ?? 0)), 0)
  }

  return ok(
    {
      balanceKobo: profile.walletBalanceKobo ?? 0,
      pendingKobo,
      totalAddedKobo: sum(['top_up', 'card_check']),
      topUpCount: count(['top_up']),
      totalSpentKobo: sum(['order_payment', 'split_share']),
      orderCount: count(['order_payment', 'split_share']),
      totalEarnedKobo: sum(['sale', 'delivery_pay', 'bonus']),
      totalWithdrawnKobo: sum(['withdrawal']) - sum(['withdrawal_reversal']),
    },
    'Wallet loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
