'use client'

import { useState } from 'react'
import { useAdminStore } from '@/components/admin/admin-store'
import { Avatar, BottomSheet, EmptyState, FilterTabs, Pill, ScreenHeader, SheetButton, useToast } from '@/components/admin/ui'
import type { AdminAccount } from '@/lib/admin/mock-data'

type Filter = 'pending' | 'active' | 'removed'
type Confirm = { admin: AdminAccount; kind: 'revoke' | 'promote' | 'demote' }

const isRemoved = (a: AdminAccount) => a.status === 'rejected' || a.status === 'revoked'

const outlineButton = 'h-9 flex-1 rounded-xl border border-[#e5e7eb] text-xs font-medium text-[#4b5563] transition-colors hover:bg-gray-50'

// People who signed up on /admin/signup, and the admins they become once
// approved. Super admins manage the team; everyone else sees it read-only.
export default function TeamPage() {
  const { admins, profile, dispatch } = useAdminStore()
  const canManage = profile.superAdmin
  const pending = admins.filter((a) => a.status === 'pending')
  const [filter, setFilter] = useState<Filter>(canManage && pending.length > 0 ? 'pending' : 'active')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const { toast, showToast } = useToast()

  const tabs = [
    { value: 'pending' as const, label: 'Requests', count: pending.length },
    { value: 'active' as const, label: 'Admins', count: admins.filter((a) => a.status === 'active').length },
    { value: 'removed' as const, label: 'Removed', count: admins.filter(isRemoved).length },
  ]
  const visible = admins.filter((a) => (filter === 'removed' ? isRemoved(a) : a.status === filter))

  function confirmAction() {
    if (!confirm) return
    const { admin, kind } = confirm
    if (kind === 'revoke') {
      dispatch({ type: 'admin/revoke', id: admin.id })
      showToast(`${admin.fullName} no longer has access.`)
    } else {
      dispatch({ type: 'admin/setSuper', id: admin.id, superAdmin: kind === 'promote' })
      showToast(kind === 'promote' ? `${admin.fullName} is now a super admin.` : `${admin.fullName} is now a regular admin.`)
    }
    setConfirm(null)
  }

  const sheet = confirm && {
    revoke: {
      title: `Remove ${confirm.admin.fullName}?`,
      subtitle: 'They are signed out at once and can no longer open the admin app. You can restore access later.',
      button: 'Remove access',
    },
    promote: {
      title: `Make ${confirm.admin.fullName} a super admin?`,
      subtitle: 'Super admins can approve and remove admins, and make other admins super admins.',
      button: 'Make super admin',
    },
    demote: {
      title: `Make ${confirm.admin.fullName} a regular admin?`,
      subtitle: 'They keep access to orders, disputes, users and support, but can no longer manage the admin team.',
      button: 'Remove super admin',
    },
  }[confirm.kind]

  return (
    <main className="px-[22px]">
      {toast}
      <ScreenHeader title="Admin Team" backHref="/admin" />

      <div className="mt-6 flex flex-col gap-5">
        {!canManage && (
          <p className="rounded-2xl bg-[#f9fafb] px-4 py-3 text-[12px] text-[#6b7280]">
            Only super admins can approve, remove or promote admins.
          </p>
        )}
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} activeClassName="bg-[#2e8b57]" />

        {visible.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visible.map((admin) => {
              const isSelf = admin.id === profile.uid
              const isSuper = admin.role === 'super'
              return (
                <li key={admin.id} className="flex flex-col gap-3 rounded-2xl border border-[#f3f4f6] bg-white px-4 py-[15px]">
                  <div className="flex items-center gap-3">
                    <Avatar name={admin.fullName} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[14px] font-medium text-[#1e1e1e]">{admin.fullName}</p>
                        {isSelf && (
                          <Pill tone="green" className="px-1.5 py-0 text-[10px]">
                            You
                          </Pill>
                        )}
                        {isSuper && admin.status === 'active' && (
                          <Pill tone="blue" className="px-1.5 py-0 text-[10px]">
                            Super admin
                          </Pill>
                        )}
                        {admin.status === 'rejected' && (
                          <Pill tone="red" className="px-1.5 py-0 text-[10px]">
                            Rejected
                          </Pill>
                        )}
                        {admin.status === 'revoked' && (
                          <Pill tone="orange" className="px-1.5 py-0 text-[10px]">
                            Access removed
                          </Pill>
                        )}
                      </div>
                      <p className="truncate text-xs text-[#9ca3af]">{admin.email}</p>
                      <p className="truncate text-[11px] text-[#9ca3af]">
                        {[admin.phone, admin.requested && `Signed up ${admin.requested}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  {canManage && admin.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'admin/reject', id: admin.id })
                          showToast(`${admin.fullName}'s request was rejected.`)
                        }}
                        className="h-9 flex-1 rounded-xl border border-[#fecaca] text-xs font-medium text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'admin/approve', id: admin.id })
                          showToast(`${admin.fullName} can now sign in.`)
                        }}
                        className="h-9 flex-1 rounded-xl bg-[#0f3d2e] text-xs font-medium text-white transition-colors hover:bg-[#0b2f23]"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                  {canManage && admin.status === 'active' && !isSelf && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirm({ admin, kind: isSuper ? 'demote' : 'promote' })} className={outlineButton}>
                        {isSuper ? 'Remove super admin' : 'Make super admin'}
                      </button>
                      <button type="button" onClick={() => setConfirm({ admin, kind: 'revoke' })} className={outlineButton}>
                        Remove access
                      </button>
                    </div>
                  )}
                  {canManage && isRemoved(admin) && (
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'admin/approve', id: admin.id })
                        showToast(`${admin.fullName} can sign in again.`)
                      }}
                      className={outlineButton}
                    >
                      {admin.status === 'rejected' ? 'Approve after all' : 'Restore access'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState>
            {filter === 'pending'
              ? 'No sign-up requests waiting. New admins sign up at /admin/signup.'
              : filter === 'active'
                ? 'No admins yet.'
                : 'Nobody has been removed.'}
          </EmptyState>
        )}
      </div>

      <BottomSheet open={confirm !== null} onClose={() => setConfirm(null)} title={sheet?.title ?? ''} subtitle={sheet?.subtitle}>
        <SheetButton variant={confirm?.kind === 'promote' ? 'primary' : 'danger'} onClick={confirmAction}>
          {sheet?.button}
        </SheetButton>
        <SheetButton variant="outline" onClick={() => setConfirm(null)}>
          Cancel
        </SheetButton>
      </BottomSheet>
    </main>
  )
}
