// Placeholder data for the admin dashboard until it is wired to a database.
// Swap these exports for real queries without changing the page components.

export type FeedStatus = 'open' | 'resolved'

export type FeedItem = {
  id: string
  title: string
  orderId: string
  timeAgo: string
  amount: number
  status: FeedStatus
}

export const adminProfile = {
  name: 'Vorapicks HQ',
  initials: 'VH',
}

export const platformRevenue = 12_840_000

export const platformStats = {
  activeSellers: 58,
  activeRiders: 34,
  resolvedDisputes: 142,
}

export const todaysOverview = {
  ordersToday: { value: 87, change: 12 },
  activeDisputes: { value: 8, change: 12 },
  feesHeld: { value: 5_100_000, change: 12 },
  totalUsers: { value: 892, change: 12 },
}

export const liveOrderFeed: FeedItem[] = [
  { id: 'D-001', title: 'Wrong items delivered', orderId: 'ORD-0389', timeAgo: '2 hours ago', amount: 16.5, status: 'open' },
  { id: 'D-003', title: 'Quality not as described', orderId: 'ORD-0365', timeAgo: '2 hours ago', amount: 16.5, status: 'open' },
  { id: 'D-004', title: 'Order arrived late', orderId: 'ORD-0352', timeAgo: '3 hours ago', amount: 24, status: 'resolved' },
]
