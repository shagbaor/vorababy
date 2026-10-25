'use client'

import Link from 'next/link'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { useAdminStore } from '@/components/admin/admin-store'
import { Avatar, EmptyState, FilterTabs, Pill, ScreenHeader, SearchField } from '@/components/admin/ui'
import { roleLabel, type AdminUser, type UserRole } from '@/lib/admin/mock-data'

type Filter = 'all' | UserRole

export default function UsersPage() {
  const { users } = useAdminStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const count = (role: UserRole) => users.filter((u) => u.role === role).length
  const tabs = [
    { value: 'all' as const, label: 'All', count: users.length },
    { value: 'buyer' as const, label: 'Buyers', count: count('buyer') },
    { value: 'seller' as const, label: 'Sellers', count: count('seller') },
    { value: 'rider' as const, label: 'Riders', count: count('rider') },
  ]

  const q = query.trim().toLowerCase()
  const visible = users
    .filter((u) => filter === 'all' || u.role === filter)
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))

  return (
    <main className="px-[22px]">
      <ScreenHeader title="User Management" backHref="/admin" />

      <div className="mt-6 flex flex-col gap-5">
        <SearchField value={query} onChange={setQuery} placeholder="Search by name or email..." />
        <FilterTabs tabs={tabs} value={filter} onChange={setFilter} activeClassName="bg-[#2e8b57]" />

        {visible.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visible.map((user) => (
              <li key={user.id}>
                <UserRow user={user} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{q ? `No users match “${query}”.` : 'No users in this group yet.'}</EmptyState>
        )}
      </div>
    </main>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  return (
    <Link
      href={`/admin/users/${user.id}`}
      className="flex items-center gap-3 rounded-2xl border border-[#f3f4f6] bg-white px-4 py-[15px] transition-colors hover:border-[#e5e7eb] hover:bg-[#fcfcfc]"
    >
      <Avatar name={user.name} size={40} online={user.verified} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-medium text-[#1e1e1e]">{user.name}</p>
          <span className="shrink-0 rounded bg-[#f3f4f6] px-1.5 py-px text-[9px] text-[#4b5563]">{roleLabel[user.role]}</span>
        </div>
        <p className="truncate text-xs text-[#9ca3af]">{user.email}</p>
        {user.banned ? (
          <Pill tone="red" className="mt-0.5 px-1.5 py-0 text-[9px]">
            Banned
          </Pill>
        ) : user.suspended ? (
          <Pill tone="orange" className="mt-0.5 px-1.5 py-0 text-[9px]">
            Suspended
          </Pill>
        ) : (
          <p className="text-[10px] text-[#16a34a]">Active {user.activeOrders} orders</p>
        )}
      </div>
      <HugeiconsIcon icon={ArrowRight01Icon} size={20} strokeWidth={1.5} className="shrink-0 text-[#9ca3af]" />
    </Link>
  )
}
