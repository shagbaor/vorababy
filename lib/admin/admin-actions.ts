import type { AdminUser, Conversation, Dispute, DisputeResolution, Order } from '@/lib/admin/mock-data'

// Every change an admin can make. The client store applies an action to its
// state immediately and the server applies the same function to the Firestore
// document inside a transaction, so both sides stay in step.

export type AdminAction =
  | { type: 'order/release'; id: string }
  | { type: 'order/refund'; id: string }
  | { type: 'order/toggleFlag'; id: string }
  | { type: 'dispute/review'; id: string }
  | { type: 'dispute/resolve'; id: string; resolution: DisputeResolution }
  | { type: 'user/toggleVerified'; id: string }
  | { type: 'user/toggleSuspended'; id: string }
  | { type: 'user/toggleBanned'; id: string }
  | { type: 'conversation/read'; id: string }
  | { type: 'conversation/send'; id: string; messageId: string; text: string; time: string }
  | { type: 'conversation/close'; id: string }

export type AdminState = {
  orders: Order[]
  disputes: Dispute[]
  users: AdminUser[]
  conversations: Conversation[]
}

export const MAX_MESSAGE_LENGTH = 2000

export function collectionFor(action: AdminAction): keyof AdminState {
  switch (action.type.split('/')[0]) {
    case 'order':
      return 'orders'
    case 'dispute':
      return 'disputes'
    case 'user':
      return 'users'
    default:
      return 'conversations'
  }
}

function applyToOrder(o: Order, action: AdminAction): Order {
  switch (action.type) {
    case 'order/release':
      return { ...o, status: 'released', flagged: false }
    case 'order/refund':
      return { ...o, status: 'refunded', flagged: false }
    case 'order/toggleFlag':
      return { ...o, flagged: !o.flagged }
    default:
      return o
  }
}

function applyToDispute(d: Dispute, action: AdminAction): Dispute {
  switch (action.type) {
    case 'dispute/review':
      return d.status === 'open' ? { ...d, status: 'in_review' } : d
    case 'dispute/resolve':
      return { ...d, status: 'resolved', resolution: action.resolution }
    default:
      return d
  }
}

function applyToUser(u: AdminUser, action: AdminAction): AdminUser {
  switch (action.type) {
    case 'user/toggleVerified':
      return { ...u, verified: !u.verified }
    case 'user/toggleSuspended':
      return { ...u, suspended: !u.suspended, banned: false }
    case 'user/toggleBanned':
      return { ...u, banned: !u.banned, suspended: false }
    default:
      return u
  }
}

function applyToConversation(c: Conversation, action: AdminAction): Conversation {
  switch (action.type) {
    case 'conversation/read':
      return { ...c, unread: 0 }
    case 'conversation/send':
      return {
        ...c,
        lastActive: action.time,
        messages: [...c.messages, { id: action.messageId, from: 'admin', text: action.text, time: action.time }],
      }
    case 'conversation/close':
      return { ...c, closed: true, unread: 0 }
    default:
      return c
  }
}

export function applyAction<T extends { id: string }>(item: T, action: AdminAction): T {
  const apply = {
    orders: applyToOrder,
    disputes: applyToDispute,
    users: applyToUser,
    conversations: applyToConversation,
  }[collectionFor(action)] as unknown as (item: T, action: AdminAction) => T
  return apply(item, action)
}

export function reduceAdminState(state: AdminState, action: AdminAction): AdminState {
  const key = collectionFor(action)
  const items = state[key] as { id: string }[]
  return { ...state, [key]: items.map((item) => (item.id === action.id ? applyAction(item, action) : item)) }
}
