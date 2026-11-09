'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { applyAdminAction } from '@/app/admin/actions'
import { reduceAdminState, type AdminAction, type AdminState } from '@/lib/admin/admin-actions'
import type { DashboardMetrics } from '@/lib/admin/data'
import type { AdminSession } from '@/lib/admin/session'

// Admin data loaded from Firestore by the (app) layout. Actions update this
// state straight away and are saved by the applyAdminAction server action; if
// saving settles (or fails) the page reloads its data from the server. Data is also
// reloaded on every navigation and when the tab regains focus, so new sign-ups
// and changes by other admins show up without a full reload.

type SendAction = Extract<AdminAction, { type: 'conversation/send' }>
export type StoreAction = Exclude<AdminAction, SendAction> | Omit<SendAction, 'messageId'>

type InternalAction = AdminAction | { type: 'hydrate'; state: AdminState }

function reducer(state: AdminState, action: InternalAction): AdminState {
  return action.type === 'hydrate' ? action.state : reduceAdminState(state, action)
}

type AdminStore = AdminState & {
  profile: Pick<AdminSession, 'uid' | 'name' | 'initials'>
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
  profile: Pick<AdminSession, 'uid' | 'name' | 'initials'>
  dashboard: DashboardMetrics
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, localDispatch] = useReducer(reducer, initialState)

  // Actions sent to the server but not yet confirmed. Fresh server data may
  // have been read before they were saved, so they are re-applied on top.
  const pending = useRef<AdminAction[]>([])

  // A router.refresh() brings fresh server data; adopt it.
  useEffect(() => {
    localDispatch({ type: 'hydrate', state: pending.current.reduce(reduceAdminState, initialState) })
  }, [initialState])

  // The layout that loads the data does not re-render on client navigation,
  // so ask for fresh data on every navigation after the first render.
  const navigated = useRef(false)
  useEffect(() => {
    if (navigated.current) router.refresh()
    navigated.current = true
  }, [pathname, router])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && router.refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])

  const dispatch = useCallback(
    (storeAction: StoreAction) => {
      const action: AdminAction =
        storeAction.type === 'conversation/send'
          ? { ...storeAction, messageId: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
          : storeAction
      pending.current.push(action)
      localDispatch(action)
      applyAdminAction(action)
        .then((result) => {
          if (!result.ok) console.error(`Admin action ${action.type} failed: ${result.error}`)
        })
        .catch((error) => console.error(error))
        .finally(() => {
          pending.current = pending.current.filter((a) => a !== action)
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
