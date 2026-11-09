'use client'

import { useState } from 'react'
import { useAdminStore } from '@/components/admin/admin-store'
import { Avatar, BottomSheet, EmptyState, FilterTabs, Pill, ScreenHeader, SheetButton, useToast } from '@/components/admin/ui'
import type { AdminAccount } from '@/lib/admin/mock-data'

type Filter = 'pending' | 'active' | 'removed'

const isRemoved = (a: AdminAccount) => a.status === 'rejected' || a.status === 'revoked'

// People who signed up on /admin/signup, and the admins they become once approved.
export default function TeamPage() {
  const { admins, profile, dispatch } = useAdminStore()
  const pending = admins.filter((a) => a.status === 'pending')
  const [filter, setFilter] = useState<Filter>(pending.length > 0 ? 'pending' : 'active')
  const [removing, setRemoving] = useState<AdminAccount | null>(null)
  const { toast, showToast } = useToast()

  const tabs = [
    { value: 'pending' as const, label: 'Requests', count: pending.length },
    { value: 'active' as const, label: 'Admins', count: admins.filter((a) => a.status === 'active').length },
    { value: 'removed' as const, label: 'Removed', count: admins.filter(isRemoved).length },
  ]
  const visible = admins.filter((a) => (filter === 'removed' ? isRemoved(a) : a.status === filter))

  function decide(admin: AdminAccount, type: 'admin/approve' | 'admin/reject' | 'admin/revoke', message: string) {
    dispatch({ type, id: admin.id })
    showToast(message)
  }

  return (
    <main className="px-[22px]">
      {toast}
      <ScreenHeader title="Admin Team" backHref="/admin" />

      <div className="mt-6 flex flex-col gap-5">
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} activeClassName="bg-[#2e8b57]" />

        {visible.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visible.map((admin) => {
              const isSelf = admin.id === profile.uid
              return (
                <li key={admin.id} className="flex flex-col gap-3 rounded-2xl border border-[#f3f4f6] bg-white px-4 py-[15px]">
                  <div className="flex items-center gap-3">
                    <Avatar name={admin.fullName} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[14px] font-medium text-[#1e1e1e]">{admin.fullName}</p>
                        {isSelf && (
                          <Pill tone="green" className="px-1.5 py-0 text-[10px]">
                            You
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

                  {admin.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decide(admin, 'admin/reject', `${admin.fullName}'s request was rejected.`)}
                        className="h-9 flex-1 rounded-xl border border-[#fecaca] text-xs font-medium text-[#dc2626] transition-colors hover:bg-[#fef2f2]"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(admin, 'admin/approve', `${admin.fullName} can now sign in.`)}
                        className="h-9 flex-1 rounded-xl bg-[#0f3d2e] text-xs font-medium text-white transition-colors hover:bg-[#0b2f23]"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                  {admin.status === 'active' && !isSelf && (
                    <button
                      type="button"
                      onClick={() => setRemoving(admin)}
                      className="h-9 rounded-xl border border-[#e5e7eb] text-xs font-medium text-[#4b5563] transition-colors hover:bg-gray-50"
                    >
                      Remove access
                    </button>
                  )}
                  {isRemoved(admin) && (
                    <button
                      type="button"
                      onClick={() => decide(admin, 'admin/approve', `${admin.fullName} can sign in again.`)}
                      className="h-9 rounded-xl border border-[#e5e7eb] text-xs font-medium text-[#4b5563] transition-colors hover:bg-gray-50"
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

      <BottomSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.fullName ?? ''}?`}
        subtitle="They are signed out at once and can no longer open the admin app. You can restore access later."
      >
        <SheetButton
          variant="danger"
          onClick={() => {
            if (removing) decide(removing, 'admin/revoke', `${removing.fullName} no longer has access.`)
            setRemoving(null)
          }}
        >
          Remove access
        </SheetButton>
        <SheetButton variant="outline" onClick={() => setRemoving(null)}>
          Cancel
        </SheetButton>
      </BottomSheet>
    </main>
  )
}
