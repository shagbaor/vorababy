import 'server-only'
import { db } from '@/lib/firebase/admin'
import type { AdminUser, Conversation, Dispute, Order } from '@/lib/admin/mock-data'

// Firestore collections behind the admin app. Documents use the same shape as
// the types in mock-data.ts, keyed by `id`, plus a `rank` field that keeps the
// seeded display order. scripts/seed.mjs fills them for development.
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

async function list<T>(collection: string): Promise<T[]> {
  const snapshot = await db().collection(collection).orderBy('rank').get()
  return snapshot.docs.map((doc) => {
    // Drop bookkeeping fields; Timestamps cannot be passed to client components.
    const { rank: _rank, updatedAt: _updatedAt, updatedBy: _updatedBy, ...data } = doc.data()
    return { ...data, id: doc.id } as T
  })
}

export async function loadAdminData(): Promise<AdminData> {
  const [orders, disputes, users, conversations, dashboard] = await Promise.all([
    list<Order>(COLLECTIONS.orders),
    list<Dispute>(COLLECTIONS.disputes),
    list<AdminUser>(COLLECTIONS.users),
    list<Conversation>(COLLECTIONS.conversations),
    db().collection(COLLECTIONS.meta).doc('dashboard').get(),
  ])
  return {
    orders,
    disputes,
    users,
    conversations,
    dashboard: { ...EMPTY_DASHBOARD, ...(dashboard.data() as Partial<DashboardMetrics> | undefined) },
  }
}
