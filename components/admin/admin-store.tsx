'use client'

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import {
  seedConversations,
  seedDisputes,
  seedOrders,
  seedUsers,
  type AdminUser,
  type Conversation,
  type Dispute,
  type DisputeResolution,
  type Order,
} from '@/lib/admin/mock-data'

// Client-side stand-in for a backend: seeded from mock data and kept in
// localStorage so admin actions survive a reload. Replace the reducer's side
// with API calls once the database exists.

type State = {
  orders: Order[]
  disputes: Dispute[]
  users: AdminUser[]
  conversations: Conversation[]
}

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'order/release'; id: string }
  | { type: 'order/refund'; id: string }
  | { type: 'order/toggleFlag'; id: string }
  | { type: 'dispute/review'; id: string }
  | { type: 'dispute/resolve'; id: string; resolution: DisputeResolution }
  | { type: 'user/toggleVerified'; id: string }
  | { type: 'user/toggleSuspended'; id: string }
  | { type: 'user/toggleBanned'; id: string }
  | { type: 'conversation/read'; id: string }
  | { type: 'conversation/send'; id: string; text: string; time: string }
  | { type: 'conversation/close'; id: string }

const STORAGE_KEY = 'vorapicks-admin-state-v1'

const initialState: State = {
  orders: seedOrders,
  disputes: seedDisputes,
  users: seedUsers,
  conversations: seedConversations,
}

function updateById<T extends { id: string }>(items: T[], id: string, update: (item: T) => T) {
  return items.map((item) => (item.id === id ? update(item) : item))
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'order/release':
      return { ...state, orders: updateById(state.orders, action.id, (o) => ({ ...o, status: 'released', flagged: false })) }
    case 'order/refund':
      return { ...state, orders: updateById(state.orders, action.id, (o) => ({ ...o, status: 'refunded', flagged: false })) }
    case 'order/toggleFlag':
      return { ...state, orders: updateById(state.orders, action.id, (o) => ({ ...o, flagged: !o.flagged })) }
    case 'dispute/review':
      return {
        ...state,
        disputes: updateById(state.disputes, action.id, (d) => (d.status === 'open' ? { ...d, status: 'in_review' } : d)),
      }
    case 'dispute/resolve':
      return {
        ...state,
        disputes: updateById(state.disputes, action.id, (d) => ({ ...d, status: 'resolved', resolution: action.resolution })),
      }
    case 'user/toggleVerified':
      return { ...state, users: updateById(state.users, action.id, (u) => ({ ...u, verified: !u.verified })) }
    case 'user/toggleSuspended':
      return { ...state, users: updateById(state.users, action.id, (u) => ({ ...u, suspended: !u.suspended, banned: false })) }
    case 'user/toggleBanned':
      return { ...state, users: updateById(state.users, action.id, (u) => ({ ...u, banned: !u.banned, suspended: false })) }
    case 'conversation/read':
      return { ...state, conversations: updateById(state.conversations, action.id, (c) => ({ ...c, unread: 0 })) }
    case 'conversation/send':
      return {
        ...state,
        conversations: updateById(state.conversations, action.id, (c) => ({
          ...c,
          lastActive: action.time,
          messages: [...c.messages, { id: `m${c.messages.length + 1}-${Date.now()}`, from: 'admin', text: action.text, time: action.time }],
        })),
      }
    case 'conversation/close':
      return { ...state, conversations: updateById(state.conversations, action.id, (c) => ({ ...c, closed: true, unread: 0 })) }
  }
}

type AdminStore = State & { dispatch: (action: Action) => void }

const AdminStoreContext = createContext<AdminStore | null>(null)

export function AdminStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Only persist once the saved state has been loaded, so the seed data never overwrites it.
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) dispatch({ type: 'hydrate', state: { ...initialState, ...JSON.parse(saved) } })
    } catch {
      // Storage unavailable or corrupt: keep the seed data.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage unavailable: changes last for this visit only.
    }
  }, [state, hydrated])

  const value = useMemo(() => ({ ...state, dispatch }), [state])

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>
}

export function useAdminStore() {
  const store = useContext(AdminStoreContext)
  if (!store) throw new Error('useAdminStore must be used inside AdminStoreProvider')
  return store
}

export function useUser(id: string) {
  const { users } = useAdminStore()
  return users.find((user) => user.id === id)
}
