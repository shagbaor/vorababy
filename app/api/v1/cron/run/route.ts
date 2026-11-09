import { timingSafeEqual } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { releaseOrder } from '@/lib/server/orders'
import { getSettings } from '@/lib/server/settings'
import { closeSplit } from '@/lib/server/splits'
import { approveAllDue } from '@/lib/server/kyc'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Housekeeping run by Vercel Cron (vercel.json), which sends
// "Authorization: Bearer $CRON_SECRET":
// - pays sellers and riders for delivered orders the buyer never confirmed
// - expires split-the-bill requests nobody finished paying (refunds to wallets)
// - closes personal shopping requests whose time has passed
function authorised(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return Boolean(secret) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}

export const GET = handle(async (request) => {
  if (!authorised(request)) throw new ApiError('unauthenticated', 'Not allowed')
  const { autoReleaseHours } = await getSettings()
  const now = Date.now()
  const result = { approved: await approveAllDue(), released: 0, splitsExpired: 0, requestsClosed: 0, errors: 0 }

  const delivered = await db().collection('orders').where('status', '==', 'delivered').get()
  for (const d of delivered.docs) {
    const at = (d.get('deliveredAt') as Timestamp | undefined)?.toMillis() ?? 0
    if (d.get('escrowStatus') !== 'held' || !at || now - at < autoReleaseHours * 3600_000) continue
    try {
      await releaseOrder(d.id, { uid: 'system', role: 'system' })
      result.released += 1
    } catch (error) {
      console.error('auto-release', d.id, error)
      result.errors += 1
    }
  }

  const splits = await db().collection('splits').where('status', '==', 'collecting').get()
  for (const s of splits.docs) {
    if ((s.get('expiresAt') as Timestamp).toMillis() > now) continue
    try {
      await closeSplit(s.id, 'expired', 'Not everyone paid in time, so the order was not placed.')
      result.splitsExpired += 1
    } catch (error) {
      console.error('split expiry', s.id, error)
      result.errors += 1
    }
  }

  const requests = await db().collection('shoppingRequests').where('status', 'in', ['open', 'suggestions_received']).get()
  for (const r of requests.docs) {
    if ((r.get('neededBy') as Timestamp).toMillis() > now) continue
    await r.ref.update({ status: 'closed', closedAt: FieldValue.serverTimestamp() })
    result.requestsClosed += 1
  }

  return ok(result, 'Housekeeping done')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
