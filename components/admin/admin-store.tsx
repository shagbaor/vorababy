'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import { applyAdminAction } from '@/app/admin/actions'
import { reduceAdminState, type AdminAction, type AdminState } from '@/lib/admin/admin-actions'
import type { DashboardMetrics } from '@/lib/admin/data'
import type { AdminSession } from '@/lib/admin/session'

// Admin data loaded from Firestore by the (app) layout. Actions update this
// state straight away and are saved by the applyAdminAction server action; if
// saving fails the page reloads its data from the server.

type SendAction = Extract<AdminAction, { type: 'conversation/send' }>
export type StoreAction = Exclude<AdminAction, SendAction> | Omit<SendAction, 'messageId'>

type InternalAction = AdminAction | { type: 'hydrate'; state: AdminState }

function reducer(state: AdminState, action: InternalAction): AdminState {
  return action.type === 'hydrate' ? action.state : reduceAdminState(state, action)
}

type AdminStore = AdminState & {
  profile: Pick<AdminSession, 'name' | 'initials'>
  dashboard: DashboardMetrics
  dispatch: (action: StoreAction) => void
}

const AdminStoreContext = createContext<AdminStore | null>(null)

export function AdminStoreProvider({
  initialState,
  profile,
  dashboard,
  children,
}: {
  initialState: AdminState
  profile: Pick<AdminSession, 'name' | 'initials'>
  dashboard: DashboardMetrics
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, localDispatch] = useReducer(reducer, initialState)

  // A router.refresh() brings fresh server data; adopt it.
  useEffect(() => {
    localDispatch({ type: 'hydrate', state: initialState })
  }, [initialState])

  const dispatch = useCallback(
    (storeAction: StoreAction) => {
      const action: AdminAction =
        storeAction.type === 'conversation/send'
          ? { ...storeAction, messageId: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
          : storeAction
      localDispatch(action)
      applyAdminAction(action)
        .then((result) => {
          if (!result.ok) {
            console.error(`Admin action ${action.type} failed: ${result.error}`)
            router.refresh()
          }
        })
        .catch((error) => {
          console.error(error)
          router.refresh()
        })
    },
    [router],
  )

  const value = useMemo(() => ({ ...state, profile, dashboard, dispatch }), [state, profile, dashboard, dispatch])

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
