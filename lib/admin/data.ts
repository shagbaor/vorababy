import 'server-only'
import type { Timestamp } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase/admin'
import { formatDate } from '@/lib/users'
import type { AdminAccount, AdminUser, Conversation, Dispute, Order } from '@/lib/admin/mock-data'

// Firestore collections behind the admin app. Documents use the same shape as
// the types in mock-data.ts, keyed by `id`.
// - users/{uid} and admins/{uid} are real accounts, keyed by Firebase Auth uid,
//   with a createdAt timestamp (newest first).
// - orders, disputes and conversations carry a `rank` field that keeps the
//   seeded display order until the marketplace writes real ones.
export const COLLECTIONS = {
  orders: 'orders',
  disputes: 'disputes',
  users: 'users',
  conversations: 'conversations',
  admins: 'admins',
  meta: 'meta',
} as const

export type DashboardMetrics = {
  platformRevenue: number
  activeSellers: number
  activeRiders: number
  ordersToday: { value: number; change: number }
  activeDisputesChange: number
  feesHeld: { value: number; change: number }
  totalUsers: { value: number; change: number }
}

export type AdminData = {
  orders: Order[]
  disputes: Dispute[]
  users: AdminUser[]
  conversations: Conversation[]
  admins: AdminAccount[]
  dashboard: DashboardMetrics
}

const EMPTY_DASHBOARD: DashboardMetrics = {
  platformRevenue: 0,
  activeSellers: 0,
  activeRiders: 0,
  ordersToday: { value: 0, change: 0 },
  activeDisputesChange: 0,
  feesHeld: { value: 0, change: 0 },
  totalUsers: { value: 0, change: 0 },
}

type Doc = FirebaseFirestore.QueryDocumentSnapshot

// Drop bookkeeping fields; Timestamps cannot be passed to client components.
function clean(doc: Doc) {
  const { rank: _rank, updatedAt: _updatedAt, updatedBy: _updatedBy, createdAt, approvedAt: _a, revokedAt: _r, ...data } = doc.data()
  const created = (createdAt as Timestamp | undefined)?.toDate()
  return { data: { ...data, id: doc.id }, created: created ? formatDate(created) : '' }
}

async function ranked<T>(collection: string): Promise<T[]> {
  const snapshot = await db().collection(collection).orderBy('rank').get()
  return snapshot.docs.map((doc) => clean(doc).data as T)
}

async function newestFirst(collection: string) {
  const snapshot = await db().collection(collection).orderBy('createdAt', 'desc').get()
  return snapshot.docs.map(clean)
}

async function countActive(role?: string) {
  let query = db().collection(COLLECTIONS.users).where('banned', '==', false).where('suspended', '==', false)
  if (role) query = query.where('role', '==', role)
  return (await query.count().get()).data().count
}

export async function loadAdminData(): Promise<AdminData> {
  const [orders, disputes, users, conversations, admins, dashboard, activeSellers, activeRiders, totalUsers] = await Promise.all([
    ranked<Order>(COLLECTIONS.orders),
    ranked<Dispute>(COLLECTIONS.disputes),
    newestFirst(COLLECTIONS.users),
    ranked<Conversation>(COLLECTIONS.conversations),
    newestFirst(COLLECTIONS.admins),
    db().collection(COLLECTIONS.meta).doc('dashboard').get(),
    countActive('seller'),
    countActive('rider'),
    db().collection(COLLECTIONS.users).count().get(),
  ])
  const metrics = { ...EMPTY_DASHBOARD, ...(dashboard.data() as Partial<DashboardMetrics> | undefined) }

  return {
    orders,
    disputes,
    conversations,
    users: users.map(({ data, created }) => ({ totalOrders: 0, activeOrders: 0, location: '', phone: '', ...data, joined: created }) as AdminUser),
    admins: admins.map(({ data, created }) => ({ phone: '', role: 'admin', ...data, requested: created }) as AdminAccount),
    // User counts are live; the order and revenue figures stay in meta/dashboard
    // until orders are real.
    dashboard: {
      ...metrics,
      activeSellers,
      activeRiders,
      totalUsers: { ...metrics.totalUsers, value: totalUsers.data().count },
    },
  }
}
