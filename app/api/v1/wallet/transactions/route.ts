import { z } from 'zod'
import { pageQuery, paginate, parseQuery, requireProfile, toIso } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// Wallet History with the all / credit / debit tabs.
export const GET = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const query = parseQuery(request, pageQuery.extend({ type: z.enum(['all', 'credit', 'debit']).default('all') }))
  const snapshot = await ref.collection('walletTransactions').orderBy('createdAt', 'desc').limit(1000).get()
  const items = snapshot.docs
    .filter((d) => query.type === 'all' || d.get('type') === query.type)
    .map((d) => ({
      id: d.id,
      type: d.get('type'),
      kind: d.get('kind'),
      amountKobo: d.get('amountKobo'),
      description: d.get('description'),
      orderId: d.get('orderId') ?? null,
      balanceAfterKobo: d.get('balanceAfterKobo'),
      createdAt: toIso(d.get('createdAt')),
    }))
  return ok({ total: items.length, ...paginate(items, query) }, 'Transactions loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
