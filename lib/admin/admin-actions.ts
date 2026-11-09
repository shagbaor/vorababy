import type { AdminAccount, AdminUser, Conversation, Dispute, DisputeResolution, Order } from '@/lib/admin/mock-data'

// Every change an admin can make. The client store applies an action to its
// state immediately and the server applies the same function to the Firestore
// document inside a transaction, so both sides stay in step. Actions set
// values rather than toggle them, so applying one twice is harmless: the store
// re-applies unconfirmed actions on top of freshly loaded data.

export type AdminAction =
  | { type: 'order/release'; id: string }
  | { type: 'order/refund'; id: string }
  | { type: 'order/setFlagged'; id: string; flagged: boolean }
  | { type: 'dispute/review'; id: string }
  | { type: 'dispute/resolve'; id: string; resolution: DisputeResolution }
  | { type: 'user/setVerified'; id: string; verified: boolean }
  | { type: 'user/setSuspended'; id: string; suspended: boolean }
  | { type: 'user/setBanned'; id: string; banned: boolean }
  | { type: 'user/update'; id: string; name: string; phone: string; location: string }
  | { type: 'conversation/read'; id: string }
  | { type: 'conversation/send'; id: string; messageId: string; text: string; time: string }
  | { type: 'conversation/close'; id: string }
  | { type: 'admin/approve'; id: string }
  | { type: 'admin/reject'; id: string }
  | { type: 'admin/revoke'; id: string }
  | { type: 'admin/setSuper'; id: string; superAdmin: boolean }

export type AdminState = {
  orders: Order[]
  disputes: Dispute[]
  users: AdminUser[]
  conversations: Conversation[]
  admins: AdminAccount[]
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
    case 'admin':
      return 'admins'
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
    case 'order/setFlagged':
      return { ...o, flagged: action.flagged }
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
    case 'user/setVerified':
      return { ...u, verified: action.verified }
    case 'user/setSuspended':
      return { ...u, suspended: action.suspended, banned: action.suspended ? false : u.banned }
    case 'user/setBanned':
      return { ...u, banned: action.banned, suspended: action.banned ? false : u.suspended }
    case 'user/update':
      return { ...u, name: action.name, phone: action.phone, location: action.location }
    default:
      return u
  }
}

function applyToConversation(c: Conversation, action: AdminAction): Conversation {
  switch (action.type) {
    case 'conversation/read':
      return { ...c, unread: 0 }
    case 'conversation/send':
      if (c.messages.some((m) => m.id === action.messageId)) return c
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

function applyToAdmin(a: AdminAccount, action: AdminAction): AdminAccount {
  switch (action.type) {
    case 'admin/approve':
      return { ...a, status: 'active' }
    case 'admin/reject':
      return a.status === 'pending' ? { ...a, status: 'rejected' } : a
    case 'admin/revoke':
      return a.status === 'active' ? { ...a, status: 'revoked', role: 'admin' } : a
    case 'admin/setSuper':
      return a.status === 'active' ? { ...a, role: action.superAdmin ? 'super' : 'admin' } : a
    default:
      return a
  }
}

export function applyAction<T extends { id: string }>(item: T, action: AdminAction): T {
  const apply = {
    orders: applyToOrder,
    disputes: applyToDispute,
    users: applyToUser,
    conversations: applyToConversation,
    admins: applyToAdmin,
  }[collectionFor(action)] as unknown as (item: T, action: AdminAction) => T
  return apply(item, action)
}

export function reduceAdminState(state: AdminState, action: AdminAction): AdminState {
  const key = collectionFor(action)
  const items = state[key] as { id: string }[]
  return { ...state, [key]: items.map((item) => (item.id === action.id ? applyAction(item, action) : item)) }
}
