import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentOrder } from '@/lib/server/orders'

export const dynamic = 'force-dynamic'

// Seller dashboard. Earnings are the seller's payout (after commission) on
// orders placed in the period, excluding cancelled ones.
export const GET = handle(async (request) => {
  const { user, profile } = await requireProfile(request, { roles: ['seller'] })
  const [orders, products, store] = await Promise.all([
    db().collection('orders').where('storeId', '==', user.uid).get(),
    db().collection('products').where('storeId', '==', user.uid).get(),
    db().collection('stores').doc(user.uid).get(),
  ])
  const lagos = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000)
  const now = lagos(new Date())
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 60 * 60 * 1000
  const startOfYesterday = startOfDay - 24 * 60 * 60 * 1000
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 60 * 60 * 1000
  const weekday = (now.getUTCDay() + 6) % 7
  const startOfWeek = startOfDay - weekday * 24 * 60 * 60 * 1000

  const live = orders.docs.filter((d) => d.get('status') !== 'cancelled')
  const at = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.get('createdAt').toMillis() as number
  const earnings = (from: number, to = Infinity) => live.filter((d) => at(d) >= from && at(d) < to).reduce((n, d) => n + d.get('sellerPayoutKobo'), 0)
  const todayOrders = live.filter((d) => at(d) >= startOfDay).length
  const yesterdayOrders = live.filter((d) => at(d) >= startOfYesterday && at(d) < startOfDay).length
  const published = products.docs.filter((p) => p.get('status') === 'published')

  return ok(
    {
      storeName: store.get('name') ?? profile.name,
      verificationStatus: profile.verificationStatus,
      todayEarningsKobo: earnings(startOfDay),
      monthEarningsKobo: earnings(startOfMonth),
      todayOrders,
      todayOrdersChangePct: yesterdayOrders ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100) : null,
      pendingOrders: orders.docs.filter((d) => d.get('status') === 'placed').length,
      activeProducts: published.length,
      lowStockItems: published.filter((p) => (p.get('stock') ?? 0) <= (p.get('lowStockThreshold') ?? 3)).length,
      weeklySales: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, i) => ({
        day,
        amountKobo: earnings(startOfWeek + i * 86_400_000, startOfWeek + (i + 1) * 86_400_000),
      })),
      recentOrders: orders.docs
        .sort((a, b) => at(b) - at(a))
        .slice(0, 5)
        .map((d) => presentOrder(d.id, d.data(), 'seller')),
    },
    'Dashboard loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
