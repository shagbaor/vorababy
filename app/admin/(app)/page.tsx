'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Briefcase03Icon,
  Coins01Icon,
  CustomerService01Icon,
  Invoice01Icon,
  Logout03Icon,
  Motorbike02Icon,
  Notification01Icon,
  Store01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-nav'
import { useAdminStore } from '@/components/admin/admin-store'
import { DisputeCard } from '@/components/admin/dispute-card'
import { EmptyState } from '@/components/admin/ui'
import { signOut } from '@/lib/admin/auth'
import { formatNaira, formatNairaCompact } from '@/lib/admin/format'
import { adminProfile, platformRevenue, platformStats, todaysOverview } from '@/lib/admin/mock-data'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { disputes } = useAdminStore()
  const activeDisputes = disputes.filter((d) => d.status !== 'resolved')
  const resolvedDisputes = disputes.length - activeDisputes.length

  const stats = [
    { label: 'Active Sellers', value: platformStats.activeSellers, icon: Store01Icon },
    { label: 'Active Riders', value: platformStats.activeRiders, icon: Motorbike02Icon },
    { label: 'Resolved Disputes', value: resolvedDisputes, icon: Briefcase03Icon },
  ]

  const overview = [
    { label: 'Orders Today', change: todaysOverview.ordersToday.change, icon: Invoice01Icon, display: String(todaysOverview.ordersToday.value) },
    { label: 'Active Disputes', change: todaysOverview.activeDisputes.change, icon: CustomerService01Icon, display: String(activeDisputes.length) },
    { label: 'Fees Held', change: todaysOverview.feesHeld.change, icon: Coins01Icon, display: formatNairaCompact(todaysOverview.feesHeld.value) },
    { label: 'Total Users', change: todaysOverview.totalUsers.change, icon: UserIcon, display: todaysOverview.totalUsers.value.toLocaleString() },
  ]

  const quickActions = adminSections.filter((section) => section.actionIcon)

  function handleSignOut() {
    signOut()
    router.replace('/admin/login')
  }

  return (
    <main className="px-[22px] pt-8">
      {/* Greeting */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="flex size-[41px] items-center justify-center rounded-full bg-[#2e8b57] text-sm font-semibold text-white"
          >
            {adminProfile.initials}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[11px] text-[#989997]">Welcome back,</p>
            <h1 className="text-base font-medium text-[#1e1e1e]">{adminProfile.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-full p-1.5 text-[#1e1e1e] transition-colors hover:bg-gray-100"
          >
            <HugeiconsIcon icon={Notification01Icon} size={24} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={handleSignOut}
            className="rounded-full p-1.5 text-[#6b7280] transition-colors hover:bg-gray-100"
          >
            <HugeiconsIcon icon={Logout03Icon} size={22} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-[13px]">
        {/* Revenue */}
        <section className="rounded-3xl bg-[#2e8b57] p-[21px]">
          <p className="text-xs font-medium leading-4 text-[#f3f4f6]">Total Platform Revenue</p>
          <p className="mt-0.5 text-[32px] font-bold leading-9 text-white">{formatNaira(platformRevenue)}</p>
        </section>

        {/* Platform stats */}
        <section className="grid grid-cols-3 rounded-3xl border border-[#f3f4f6] bg-white p-[17px]">
          {stats.map(({ label, value, icon }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="flex size-8 items-center justify-center rounded-xl bg-[#f9fafb] text-[#4b5563]">
                <HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-semibold leading-5 tracking-[0.065px] text-[#202020]">{value}</p>
              <p className="text-center text-[10px] leading-[11.25px] tracking-[0.027px] text-[#9ca3af]">{label}</p>
            </div>
          ))}
        </section>

        {/* Quick actions */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold leading-5 text-[#202020]">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map(({ label, href, actionIcon }, index) => {
              const primary = index === 0
              return (
                <Link key={label} href={href} className="group flex flex-col items-center gap-2">
                  <span
                    className={cn(
                      'flex size-14 items-center justify-center rounded-2xl transition-colors',
                      primary ? 'bg-[#16a34a] text-white group-hover:bg-[#15803d]' : 'bg-[#f9fafb] text-[#4b5563] group-hover:bg-gray-100',
                    )}
                  >
                    <HugeiconsIcon icon={actionIcon!} size={24} strokeWidth={1.5} />
                  </span>
                  <span className="text-[11px] font-medium text-[#4b5563]">{label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Today's overview */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold leading-6 text-[#1e1e1e]">Today&apos;s Overview</h2>
          <div className="grid grid-cols-2 gap-x-[13px] gap-y-2">
            {overview.map(({ label, display, change, icon }) => (
              <div key={label} className="flex h-[150px] flex-col rounded-xl border border-[#e5e7eb] bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-[#7ed953]/10 text-[#4caf50]">
                    <HugeiconsIcon icon={icon} size={24} strokeWidth={1.5} />
                  </div>
                  <span className="rounded-full bg-[#10b981]/10 px-2 py-1 text-xs leading-4 text-[#10b981]">
                    {change > 0 ? '+' : ''}
                    {change}%
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold leading-8 text-[#1e1e1e]">{display}</p>
                <p className="mt-1 truncate text-sm leading-5 text-[#1e1e1e]/60">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live order feed */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold leading-6 text-[#1e1e1e]">Live Order Feed</h2>
            <Link href="/admin/disputes" className="text-xs font-medium text-[#2e8b57] hover:underline">
              View all
            </Link>
          </div>
          {activeDisputes.length > 0 ? (
            <ul className="flex flex-col gap-[9px]">
              {activeDisputes.map((dispute) => (
                <li key={dispute.id}>
                  <DisputeCard dispute={dispute} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No open disputes right now.</EmptyState>
          )}
        </section>
      </div>
    </main>
  )
}
