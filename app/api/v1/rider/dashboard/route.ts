import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Dashboard header: today's deliveries, earnings and distance.
export const GET = handle(async (request) => {
  const { user, profile, ref } = await requireProfile(request, { roles: ['rider'] })
  const [rider, orders, ledger] = await Promise.all([
    db().collection('riders').doc(user.uid).get(),
    db().collection('orders').where('riderId', '==', user.uid).get(),
    ref.collection('walletTransactions').where('kind', 'in', ['delivery_pay', 'bonus']).get(),
  ])
  const now = new Date(Date.now() + 60 * 60 * 1000)
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 60 * 60 * 1000
  const deliveredToday = orders.docs.filter((d) => (d.get('deliveredAt')?.toMillis?.() ?? 0) >= startOfDay)

  return ok(
    {
      name: profile.name,
      rating: rider.get('rating') ?? null,
      tripCount: rider.get('tripCount') ?? 0,
      isOnline: Boolean(rider.get('isOnline')),
      activeOrderId: rider.get('activeOrderId') ?? null,
      today: {
        deliveries: deliveredToday.length,
        earningsKobo: ledger.docs.filter((d) => (d.get('createdAt')?.toMillis?.() ?? 0) >= startOfDay).reduce((n, d) => n + d.get('amountKobo'), 0),
        distanceKm: Math.round(deliveredToday.reduce((n, d) => n + (d.get('distanceKm') ?? 0), 0) * 10) / 10,
      },
      verificationStatus: profile.verificationStatus,
    },
    'Dashboard loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
