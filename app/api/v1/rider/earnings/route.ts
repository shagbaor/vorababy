import { z } from 'zod'
import { pageQuery, paginate, parseQuery, requireProfile, toIso } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// My Earnings: career total, this week by day, and each delivery's pay.
export const GET = handle(async (request) => {
  const { user, ref } = await requireProfile(request, { roles: ['rider'] })
  const query = parseQuery(request, pageQuery.extend({ range: z.enum(['week', 'month', 'all']).default('week') }))
  const [ledger, orders] = await Promise.all([
    ref.collection('walletTransactions').where('kind', 'in', ['delivery_pay', 'bonus']).get(),
    db().collection('orders').where('riderId', '==', user.uid).get(),
  ])
  const now = new Date(Date.now() + 60 * 60 * 1000)
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 60 * 60 * 1000
  const startOfWeek = startOfDay - ((now.getUTCDay() + 6) % 7) * 86_400_000
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 60 * 60 * 1000
  const from = query.range === 'week' ? startOfWeek : query.range === 'month' ? startOfMonth : 0
  const at = (d: FirebaseFirestore.DocumentSnapshot) => (d.get('createdAt')?.toMillis?.() as number | undefined) ?? 0

  const transactions = orders.docs
    .filter((o) => ['delivered', 'completed'].includes(o.get('status')))
    .map((o) => ({
      orderId: o.id,
      buyerName: o.get('buyerName'),
      deliveredAt: toIso(o.get('deliveredAt')),
      payKobo: o.get('riderPayKobo'),
      bonusKobo: o.get('riderBonusKobo') ?? 0,
      status: o.get('escrowStatus') === 'released' ? 'paid' : 'pending',
    }))
    .sort((a, b) => (b.deliveredAt ?? '').localeCompare(a.deliveredAt ?? ''))

  return ok(
    {
      totalCareerKobo: ledger.docs.reduce((n, d) => n + d.get('amountKobo'), 0),
      rangeTotalKobo: ledger.docs.filter((d) => at(d) >= from).reduce((n, d) => n + d.get('amountKobo'), 0),
      deliveriesCompleted: transactions.length,
      byDay: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, i) => ({
        day,
        amountKobo: ledger.docs.filter((d) => at(d) >= startOfWeek + i * 86_400_000 && at(d) < startOfWeek + (i + 1) * 86_400_000).reduce((n, d) => n + d.get('amountKobo'), 0),
      })),
      ...paginate(transactions, query),
    },
    'Earnings loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
