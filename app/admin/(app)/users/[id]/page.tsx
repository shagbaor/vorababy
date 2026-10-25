'use client'

import { useParams } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar02Icon, Call02Icon, Invoice01Icon, Location06Icon, Mail02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { useAdminStore, useUser } from '@/components/admin/admin-store'
import { Avatar, EmptyState, Pill, ScreenHeader, useToast } from '@/components/admin/ui'
import { roleLabel } from '@/lib/admin/mock-data'

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { dispatch } = useAdminStore()
  const user = useUser(id)
  const { toast, showToast } = useToast()

  if (!user) {
    return (
      <main className="px-[22px]">
        <ScreenHeader title="User Profile" backHref="/admin/users" />
        <div className="mt-6">
          <EmptyState>We couldn&apos;t find this user.</EmptyState>
        </div>
      </main>
    )
  }

  const details = [
    { label: 'Email', value: user.email, icon: Mail02Icon },
    { label: 'Phone', value: user.phone, icon: Call02Icon },
    { label: 'Location', value: user.location, icon: Location06Icon },
    { label: 'Joined', value: user.joined, icon: Calendar02Icon },
    { label: 'Total Orders', value: `${user.totalOrders} orders`, icon: Invoice01Icon },
  ]

  const actions = [
    {
      label: user.verified ? 'Remove Verification' : 'Verify User',
      active: user.verified,
      activeClass: 'border-[#16a34a] bg-[#16a34a] text-white',
      onClick: () => {
        dispatch({ type: 'user/toggleVerified', id: user.id })
        showToast(user.verified ? `${user.name} is no longer verified.` : `${user.name} is now verified.`)
      },
    },
    {
      label: user.suspended ? 'Lift Suspension' : 'Suspend User',
      active: user.suspended,
      activeClass: 'border-[#ff3b3b] bg-[#ff3b3b] text-white',
      onClick: () => {
        dispatch({ type: 'user/toggleSuspended', id: user.id })
        showToast(user.suspended ? `${user.name}'s suspension was lifted.` : `${user.name} has been suspended.`)
      },
    },
    {
      label: user.banned ? 'Unban User' : 'Ban User',
      active: user.banned,
      activeClass: 'border-[#ff3b3b] bg-[#ff3b3b] text-white',
      onClick: () => {
        dispatch({ type: 'user/toggleBanned', id: user.id })
        showToast(user.banned ? `${user.name} has been unbanned.` : `${user.name} has been banned.`)
      },
    },
  ]

  return (
    <main className="px-[19px]">
      {toast}
      <ScreenHeader title="User Profile" backHref="/admin/users" />

      <div className="mt-[30px] flex flex-col gap-6">
        <section className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={user.name} size={64} online={user.verified} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold leading-[22.4px] tracking-[0.042px] text-[#1e1e1e]">{user.name}</h2>
                <span className="shrink-0 rounded bg-[#f3f4f6] px-1.5 py-px text-[9px] text-[#4b5563]">{roleLabel[user.role]}</span>
              </div>
              <p className="truncate text-xs leading-[18px] tracking-[0.12px] text-[#9ca3af]">{user.email}</p>
              {(user.suspended || user.banned) && (
                <Pill tone={user.banned ? 'red' : 'orange'} className="mt-0.5 px-1.5 py-0 text-[9px]">
                  {user.banned ? 'Banned' : 'Suspended'}
                </Pill>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Edit user"
            onClick={() => showToast('Editing user details will be available once the database is connected.')}
            className="rounded-lg p-1 text-[#9ca3af] transition-colors hover:bg-gray-100 hover:text-[#4b5563]"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={24} strokeWidth={1.5} />
          </button>
        </section>

        <dl className="flex flex-col gap-1">
          {details.map(({ label, value, icon }) => (
            <div key={label} className="flex h-[60px] items-center gap-3 rounded-2xl border border-[#f0f0f0]/60 bg-white px-[15px]">
              <HugeiconsIcon icon={icon} size={24} strokeWidth={1.5} className="shrink-0 text-[#9ca3af]" />
              <div className="min-w-0">
                <dt className="text-xs leading-[18px] tracking-[0.12px] text-[#9ca3af]">{label}</dt>
                <dd className="truncate text-sm font-medium leading-[18px] tracking-[-0.3px] text-[#202020]">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold leading-6 tracking-[-0.24px] text-[#202020]">Admin Actions</h2>
          <div className="flex flex-col gap-1">
            {actions.map(({ label, active, activeClass, onClick }) => (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={onClick}
                className={cn(
                  'flex h-[55px] items-center justify-center rounded-2xl border text-base font-medium tracking-[0.08px] transition-colors',
                  active ? activeClass : 'border-[#e5e7eb] text-[#4b5563] hover:bg-gray-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
