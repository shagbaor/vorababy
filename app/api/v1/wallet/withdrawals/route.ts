import { pageQuery, paginate, parseQuery, requireProfile, toIso } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// status: processing → paid | failed (money returned to the wallet)
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller', 'rider'] })
  const query = parseQuery(request, pageQuery)
  const snapshot = await db().collection('withdrawals').where('uid', '==', user.uid).get()
  const items = snapshot.docs
    .map((d) => ({ reference: d.id, amountKobo: d.get('amountKobo'), feeKobo: d.get('feeKobo'), account: d.get('account'), status: d.get('status'), createdAt: toIso(d.get('createdAt')) }))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  return ok({ total: items.length, ...paginate(items, query) }, 'Withdrawals loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
