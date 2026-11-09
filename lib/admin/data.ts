import 'server-only'
import type { Timestamp } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase/admin'
import { formatDate } from '@/lib/users'
import type { AdminAccount, AdminUser, Conversation, Dispute, Order } from '@/lib/admin/mock-data'

// Firestore collections behind the admin app. Documents use the same shape as
// the types in mock-data.ts, keyed by `id`.
// - users/{uid} and admins/{uid} are real accounts, keyed by Firebase Auth uid,
//   with a createdAt timestamp (newest first).
// - orders and disputes carry createdAt; orders also releasedAt/refundedAt and
//   platformFee (Vorapicks' commission, in naira).
// - conversations carry a `rank` field that keeps the seeded display order.
// - meta/settings holds business settings such as commissionRate.
export const COLLECTIONS = {
  orders: 'orders',
  disputes: 'disputes',
  users: 'users',
  conversations: 'conversations',
  admins: 'admins',
  meta: 'meta',
} as const

export const DEFAULT_COMMISSION_RATE = 0.1

// Every figure is computed from the collections above. `earnings` is only
// filled in for super admins; regular admins never receive it.
export type DashboardMetrics = {
  activeSellers: number
  activeRiders: number
  totalUsers: number
  newUsersThisWeek: number
  ordersToday: number
  ordersYesterday: number
  disputesOpenedToday: number
  escrowHeld: number
  earnings: {
    today: number
    thisWeek: number
    allTime: number
    // Monday to Sunday of the current week.
    byDay: { day: string; amount: number }[]
  } | null
}

export type AdminData = {
  orders: Order[]
  disputes: Dispute[]
  users: AdminUser[]
  conversations: Conversation[]
  admins: AdminAccount[]
  dashboard: DashboardMetrics
}

type Doc = FirebaseFirestore.QueryDocumentSnapshot

// Lagos is UTC+1 all year (no daylight saving).
const LAGOS_OFFSET_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function startOfLagosDay(now: Date) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS)
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - LAGOS_OFFSET_MS)
}

function startOfLagosWeek(now: Date) {
  const today = startOfLagosDay(now)
  const weekday = (new Date(today.getTime() + LAGOS_OFFSET_MS).getUTCDay() + 6) % 7 // Monday = 0
  return new Date(today.getTime() - weekday * DAY_MS)
}

const toDate = (value: unknown) => (value as Timestamp | undefined)?.toDate?.()

function formatPlacedAt(date: Date) {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
}

function timeAgo(date: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// Drop bookkeeping fields; Timestamps cannot be passed to client components.
function clean(doc: Doc) {
  const {
    rank: _rank,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    createdAt,
    approvedAt: _a,
    revokedAt: _r,
    releasedAt: _rel,
    refundedAt: _ref,
    ...data
  } = doc.data()
  const created = toDate(createdAt)
  return { data: { ...data, id: doc.id }, created }
}

async function newestFirst(collection: string) {
  const snapshot = await db().collection(collection).orderBy('createdAt', 'desc').get()
  return snapshot.docs
}

async function countActive(role: string) {
  const query = db().collection(COLLECTIONS.users).where('banned', '==', false).where('suspended', '==', false).where('role', '==', role)
  return (await query.count().get()).data().count
}

export async function loadAdminData({ superAdmin }: { superAdmin: boolean }): Promise<AdminData> {
  const now = new Date()
  const today = startOfLagosDay(now)
  const yesterday = new Date(today.getTime() - DAY_MS)
  const weekStart = startOfLagosWeek(now)

  const [orderDocs, disputeDocs, userDocs, conversationDocs, adminDocs, settings, activeSellers, activeRiders] = await Promise.all([
    newestFirst(COLLECTIONS.orders),
    newestFirst(COLLECTIONS.disputes),
    newestFirst(COLLECTIONS.users),
    db().collection(COLLECTIONS.conversations).orderBy('rank').get(),
    newestFirst(COLLECTIONS.admins),
    db().collection(COLLECTIONS.meta).doc('settings').get(),
    countActive('seller'),
    countActive('rider'),
  ])
  const commissionRate = (settings.get('commissionRate') as number | undefined) ?? DEFAULT_COMMISSION_RATE

  const orders = orderDocs.map((doc) => {
    const { data, created } = clean(doc)
    return { ...data, placedAt: created ? formatPlacedAt(created) : '' } as Order
  })
  const disputes = disputeDocs.map((doc) => {
    const { data, created } = clean(doc)
    return { ...data, openedAgo: created ? timeAgo(created, now) : '' } as Dispute
  })
  const users = userDocs.map((doc) => {
    const { data, created } = clean(doc)
    return { totalOrders: 0, activeOrders: 0, location: '', phone: '', ...data, joined: created ? formatDate(created) : '' } as AdminUser
  })
  const admins = adminDocs.map((doc) => {
    const { data, created } = clean(doc)
    return { phone: '', role: 'admin', ...data, requested: created ? formatDate(created) : '' } as AdminAccount
  })

  const createdBetween = (docs: Doc[], from: Date, to?: Date) =>
    docs.filter((doc) => {
      const created = toDate(doc.get('createdAt'))
      return created && created >= from && (!to || created < to)
    }).length

  let earnings: DashboardMetrics['earnings'] = null
  if (superAdmin) {
    const byDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({ day, amount: 0 }))
    earnings = { today: 0, thisWeek: 0, allTime: 0, byDay }
    for (const doc of orderDocs) {
      const releasedAt = toDate(doc.get('releasedAt'))
      if (doc.get('status') !== 'released' || !releasedAt) continue
      const fee = (doc.get('platformFee') as number | undefined) ?? Math.round((doc.get('amount') as number) * commissionRate)
      earnings.allTime += fee
      if (releasedAt >= weekStart) {
        earnings.thisWeek += fee
        byDay[Math.min(6, Math.floor((releasedAt.getTime() - weekStart.getTime()) / DAY_MS))].amount += fee
      }
      if (releasedAt >= today) earnings.today += fee
    }
  }

  return {
    orders,
    disputes,
    users,
    admins,
    conversations: conversationDocs.docs.map((doc) => clean(doc).data as Conversation),
    dashboard: {
      activeSellers,
      activeRiders,
      totalUsers: userDocs.length,
      newUsersThisWeek: createdBetween(userDocs, new Date(now.getTime() - 7 * DAY_MS)),
      ordersToday: createdBetween(orderDocs, today),
      ordersYesterday: createdBetween(orderDocs, yesterday, today),
      disputesOpenedToday: createdBetween(disputeDocs, today),
      escrowHeld: orderDocs.filter((doc) => doc.get('status') === 'held' || doc.get('status') === 'disputed').reduce((sum, doc) => sum + ((doc.get('amount') as number) ?? 0), 0),
      earnings,
    },
  }
}
