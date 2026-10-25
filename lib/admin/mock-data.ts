// Placeholder data for the admin app until it is wired to a database.
// The admin store seeds itself from these exports, so swapping them for real
// queries (or replacing the store with API calls) leaves the pages unchanged.

export type OrderStatus = 'held' | 'released' | 'refunded' | 'disputed'
export type OrderProgress = 'New' | 'In Progress' | 'In Delivery' | 'Delivered'

export type Order = {
  id: string
  placedAt: string
  items: number
  progress: OrderProgress
  amount: number
  status: OrderStatus
  flagged: boolean
}

export type DisputeStatus = 'open' | 'in_review' | 'resolved'
export type DisputeResolution = 'refunded' | 'released'

export type Dispute = {
  id: string
  title: string
  orderId: string
  openedAgo: string
  amount: number
  status: DisputeStatus
  resolution?: DisputeResolution
  summary: string
  buyerName: string
  buyerClaim: string
  sellerName: string
  sellerResponse: string
  evidence: string[]
}

export type UserRole = 'buyer' | 'seller' | 'rider'

export type AdminUser = {
  id: string
  name: string
  email: string
  role: UserRole
  phone: string
  location: string
  joined: string
  totalOrders: number
  activeOrders: number
  verified: boolean
  suspended: boolean
  banned: boolean
}

export type ChatMessage = {
  id: string
  from: 'user' | 'admin'
  text: string
  time: string
}

export type Conversation = {
  id: string
  userId: string
  orderId: string
  orderAmount: number
  lastActive: string
  unread: number
  closed: boolean
  messages: ChatMessage[]
}

export const adminProfile = {
  name: 'Vorapicks HQ',
  initials: 'VH',
}

export const platformRevenue = 12_840_000

export const platformStats = {
  activeSellers: 58,
  activeRiders: 34,
}

export const todaysOverview = {
  ordersToday: { value: 87, change: 12 },
  activeDisputes: { change: 12 },
  feesHeld: { value: 5_100_000, change: 12 },
  totalUsers: { value: 892, change: 12 },
}

export const seedOrders: Order[] = [
  { id: 'ORD-0395', placedAt: 'Mar 26, 09:45 AM', items: 2, progress: 'In Progress', amount: 6_100, status: 'held', flagged: false },
  { id: 'ORD-0392', placedAt: 'Mar 26, 10:10 AM', items: 1, progress: 'New', amount: 5_800, status: 'held', flagged: false },
  { id: 'ORD-2026-0389', placedAt: 'Mar 26, 08:30 AM', items: 3, progress: 'In Delivery', amount: 9_300, status: 'disputed', flagged: true },
  { id: 'ORD-0391', placedAt: 'Mar 26, 07:55 AM', items: 5, progress: 'In Progress', amount: 14_250, status: 'held', flagged: false },
  { id: 'ORD-0388', placedAt: 'Mar 25, 06:40 PM', items: 2, progress: 'In Delivery', amount: 7_400, status: 'held', flagged: false },
  { id: 'ORD-0385', placedAt: 'Mar 25, 03:22 PM', items: 4, progress: 'Delivered', amount: 6_600, status: 'released', flagged: false },
  { id: 'ORD-0379', placedAt: 'Mar 25, 11:05 AM', items: 1, progress: 'New', amount: 3_200, status: 'held', flagged: false },
  { id: 'ORD-0373', placedAt: 'Mar 24, 09:42 AM', items: 1, progress: 'Delivered', amount: 10_000, status: 'released', flagged: false },
  { id: 'ORD-0365', placedAt: 'Mar 24, 08:15 AM', items: 2, progress: 'Delivered', amount: 16_500, status: 'disputed', flagged: true },
  { id: 'ORD-0368', placedAt: 'Mar 24, 07:30 AM', items: 3, progress: 'In Progress', amount: 8_900, status: 'held', flagged: false },
]

export const seedDisputes: Dispute[] = [
  {
    id: 'D-001',
    title: 'Wrong items delivered',
    orderId: 'ORD-0389',
    openedAgo: '2 hours ago',
    amount: 16_500,
    status: 'open',
    summary:
      'Buyer claims she received different vegetables than what she ordered. She ordered fresh basil and tomatoes but received onions and peppers instead.',
    buyerName: 'Amaka Osei',
    buyerClaim: 'I ordered tomatoes and basil but received completely different items. The packaging was also damaged.',
    sellerName: 'Green Valley Farm',
    sellerResponse: 'We packed the items exactly as ordered. The driver may have mixed up the bags.',
    evidence: ['Photo of delivered items', 'Original order receipt', 'Chat transcript with seller'],
  },
  {
    id: 'D-003',
    title: 'Quality not as described',
    orderId: 'ORD-0365',
    openedAgo: '2 hours ago',
    amount: 16_500,
    status: 'open',
    summary:
      'Buyer reports the rice delivered was unclean and not fit for consumption, and is requesting a full refund.',
    buyerName: 'Chukwuemeka Bello',
    buyerClaim: 'The rice is unclean and not fit for consumption. I want a full refund.',
    sellerName: 'Harvest Fields',
    sellerResponse: 'Our rice is cleaned and processed before sale. This may be an isolated incident.',
    evidence: ['Photo of delivered items', 'Original order receipt'],
  },
  {
    id: 'D-004',
    title: 'Order arrived late',
    orderId: 'ORD-0352',
    openedAgo: '5 hours ago',
    amount: 9_800,
    status: 'in_review',
    summary: 'Buyer received the order three hours after the promised delivery window and the vegetables had wilted.',
    buyerName: 'Amaka Osei',
    buyerClaim: 'My order came three hours late and the greens were wilted by the time it arrived.',
    sellerName: 'Happy Hens Farm',
    sellerResponse: 'The order was ready on time. The delay happened during delivery.',
    evidence: ['Delivery timeline', 'Photo of delivered items'],
  },
  {
    id: 'D-002',
    title: 'Missing item in order',
    orderId: 'ORD-0347',
    openedAgo: '1 day ago',
    amount: 4_200,
    status: 'resolved',
    resolution: 'refunded',
    summary: 'One crate of eggs was missing from the delivered order.',
    buyerName: 'Chukwuemeka Bello',
    buyerClaim: 'The eggs I paid for were not in the bag.',
    sellerName: 'Happy Hens Farm',
    sellerResponse: 'We confirmed the crate was left behind at packing. Happy to refund.',
    evidence: ['Original order receipt'],
  },
  {
    id: 'D-005',
    title: 'Seller cancelled after payment',
    orderId: 'ORD-0331',
    openedAgo: '2 days ago',
    amount: 12_000,
    status: 'resolved',
    resolution: 'released',
    summary: 'Buyer believed the seller cancelled, but the order was delivered and confirmed by the rider.',
    buyerName: 'Amaka Osei',
    buyerClaim: 'I got a cancellation message but was still charged.',
    sellerName: 'Green Valley Farm',
    sellerResponse: 'The message was sent in error. The order was delivered the same day.',
    evidence: ['Delivery confirmation', 'Chat transcript with seller'],
  },
]

export const seedUsers: AdminUser[] = [
  { id: 'amaka-osei', name: 'Amaka Osei', email: 'amaka.osei@email.com', role: 'buyer', phone: '+234 801 234 5678', location: 'Lekki, Lagos', joined: 'Jan 15, 2026', totalOrders: 24, activeOrders: 24, verified: false, suspended: false, banned: false },
  { id: 'chukwuemeka-bello', name: 'Chukwuemeka Bello', email: 'chukwu.bello@email.com', role: 'buyer', phone: '+234 802 345 6789', location: 'Victoria Island, Lagos', joined: 'Feb 3, 2026', totalOrders: 11, activeOrders: 11, verified: false, suspended: false, banned: false },
  { id: 'green-valley-farm', name: 'Green Valley Farm', email: 'greenvalley@farm.com', role: 'seller', phone: '+234 803 456 7890', location: 'Epe, Lagos', joined: 'Dec 10, 2025', totalOrders: 187, activeOrders: 187, verified: true, suspended: false, banned: false },
  { id: 'harvest-fields', name: 'Harvest Fields', email: 'harvest.fields@farm.ng', role: 'seller', phone: '+234 804 567 8901', location: 'Kano, Nigeria', joined: 'Nov 5, 2025', totalOrders: 143, activeOrders: 187, verified: false, suspended: false, banned: false },
  { id: 'emeka-johnson', name: 'Emeka Johnson', email: 'emeka.j@drivers.com', role: 'rider', phone: '+234 805 678 9012', location: 'Surulere, Lagos', joined: 'Jan 22, 2026', totalOrders: 312, activeOrders: 187, verified: true, suspended: false, banned: false },
  { id: 'tunde-adeola', name: 'Tunde Adeola', email: 'tunde.a@drivers.com', role: 'rider', phone: '+234 808 901 2345', location: 'Yaba, Lagos', joined: 'Feb 14, 2026', totalOrders: 178, activeOrders: 178, verified: false, suspended: false, banned: false },
  { id: 'happy-hens-farm', name: 'Happy Hens Farm', email: 'happy.hens@farm.ng', role: 'seller', phone: '+234 810 123 4567', location: 'Ibadan, Nigeria', joined: 'Dec 28, 2025', totalOrders: 312, activeOrders: 312, verified: false, suspended: false, banned: false },
]

export const seedConversations: Conversation[] = [
  {
    id: 'c-amaka',
    userId: 'amaka-osei',
    orderId: 'ORD-0389',
    orderAmount: 16_500,
    lastActive: '10:22 AM',
    unread: 2,
    closed: false,
    messages: [
      { id: 'm1', from: 'user', text: 'Hello! I received the wrong items for ORD-0389. I ordered 2kg of Roma tomatoes and basil but got onions and peppers.', time: '10:01 AM' },
      { id: 'm2', from: 'admin', text: "Sorry about that! We've opened dispute D-001 and the seller has been asked to respond.", time: '10:03 AM' },
      { id: 'm3', from: 'user', text: 'Thanks. My dispute is still open, any update?', time: '10:22 AM' },
    ],
  },
  {
    id: 'c-emeka',
    userId: 'emeka-johnson',
    orderId: 'ORD-0388',
    orderAmount: 7_400,
    lastActive: '9:48 AM',
    unread: 0,
    closed: false,
    messages: [
      { id: 'm1', from: 'user', text: 'The buyer at Lekki Phase 1 is not picking up. What should I do?', time: '9:40 AM' },
      { id: 'm2', from: 'admin', text: 'Please wait 10 more minutes. We are reaching out to the buyer now.', time: '9:48 AM' },
    ],
  },
  {
    id: 'c-harvest',
    userId: 'harvest-fields',
    orderId: 'ORD-0365',
    orderAmount: 16_500,
    lastActive: 'Yesterday',
    unread: 1,
    closed: false,
    messages: [
      { id: 'm1', from: 'user', text: 'We have uploaded our response to dispute D-003. Please review when you can.', time: '4:15 PM' },
    ],
  },
]

export const roleLabel: Record<UserRole, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  rider: 'Driver',
}
