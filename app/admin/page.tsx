import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Briefcase03Icon,
  Coins01Icon,
  CustomerService01Icon,
  Invoice01Icon,
  Motorbike02Icon,
  Notification01Icon,
  Store01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-nav'
import { formatNaira, formatNairaCompact, formatNairaExact } from '@/lib/admin/format'
import {
  adminProfile,
  liveOrderFeed,
  platformRevenue,
  platformStats,
  todaysOverview,
  type FeedItem,
} from '@/lib/admin/mock-data'

export default function AdminDashboardPage() {
  const stats = [
    { label: 'Active Sellers', value: platformStats.activeSellers, icon: Store01Icon },
    { label: 'Active Riders', value: platformStats.activeRiders, icon: Motorbike02Icon },
    { label: 'Resolved Disputes', value: platformStats.resolvedDisputes, icon: Briefcase03Icon },
  ]

  const overview = [
    { label: 'Orders Today', ...todaysOverview.ordersToday, icon: Invoice01Icon, display: String(todaysOverview.ordersToday.value) },
    { label: 'Active Disputes', ...todaysOverview.activeDisputes, icon: CustomerService01Icon, display: String(todaysOverview.activeDisputes.value) },
    { label: 'Fees Held', ...todaysOverview.feesHeld, icon: Coins01Icon, display: formatNairaCompact(todaysOverview.feesHeld.value) },
    { label: 'Total Users', ...todaysOverview.totalUsers, icon: UserIcon, display: todaysOverview.totalUsers.value.toLocaleString() },
  ]

  const quickActions = adminSections.filter((section) => section.actionIcon)

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
            <p className="text-[10px] text-[#989997]">Welcome back,</p>
            <h1 className="text-base font-medium text-[#1e1e1e]">{adminProfile.name}</h1>
          </div>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-full p-1 text-[#1e1e1e] transition-colors hover:bg-gray-100"
        >
          <HugeiconsIcon icon={Notification01Icon} size={24} strokeWidth={1.5} />
        </button>
      </header>

      <div className="mt-6 flex flex-col gap-[13px]">
        {/* Revenue */}
        <section className="rounded-3xl bg-[#2e8b57] p-[21px]">
          <p className="text-xs font-medium leading-4 text-[#f3f4f6]">Total Platform Revenue</p>
          <p className="mt-0.5 text-[30px] font-bold leading-9 text-white">{formatNaira(platformRevenue)}</p>
        </section>

        {/* Platform stats */}
        <section className="grid grid-cols-3 rounded-3xl border border-[#f3f4f6] bg-white p-[17px]">
          {stats.map(({ label, value, icon }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="flex size-8 items-center justify-center rounded-xl bg-[#f9fafb] text-[#4b5563]">
                <HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold leading-5 tracking-[0.065px] text-[#202020]">{value}</p>
              <p className="text-center text-[9px] leading-[11.25px] tracking-[0.027px] text-[#9ca3af]">{label}</p>
            </div>
          ))}
        </section>

        {/* Quick actions */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold leading-5 text-[#202020]">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map(({ label, href, actionIcon }, index) => {
              const primary = index === 0
              const content = (
                <>
                  <span
                    className={cn(
                      'flex size-14 items-center justify-center rounded-2xl transition-colors',
                      primary ? 'bg-[#16a34a] text-white' : 'bg-[#f9fafb] text-[#4b5563] group-hover:bg-gray-100',
                    )}
                  >
                    <HugeiconsIcon icon={actionIcon!} size={24} strokeWidth={1.5} />
                  </span>
                  <span className="text-[10px] font-medium text-[#4b5563]">{label}</span>
                </>
              )
              const itemClass = 'group flex flex-col items-center gap-2'

              return href ? (
                <Link key={label} href={href} className={itemClass}>
                  {content}
                </Link>
              ) : (
                <span key={label} className={cn(itemClass, 'cursor-not-allowed')} aria-disabled="true" title="Coming soon">
                  {content}
                </span>
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
          <h2 className="text-sm font-semibold leading-6 text-[#1e1e1e]">Live Order Feed</h2>
          {liveOrderFeed.length > 0 ? (
            <ul className="flex flex-col gap-[9px]">
              {liveOrderFeed.map((item) => (
                <li key={`${item.id}-${item.orderId}`}>
                  <FeedCard item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-[#f3f4f6] p-[17px] text-center text-sm text-[#6b7280]">
              No live orders right now.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  const open = item.status === 'open'

  return (
    <article className="rounded-2xl border border-[#f3f4f6] bg-white p-[17px] tracking-[0.08px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-4 text-[#6b7280]">{item.id}</p>
          <p className="mt-0.5 truncate text-sm font-semibold leading-5 text-[#111827]">{item.title}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-[15.5px]',
            open ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#dcfce7] text-[#16a34a]',
          )}
        >
          {open ? 'Open' : 'Resolved'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs leading-4 text-[#6b7280]">
          <span>{item.orderId}</span>
          <span aria-hidden className="text-[#9ca3af]">
            ·
          </span>
          <span>{item.timeAgo}</span>
        </div>
        <span className="text-sm font-semibold leading-5 text-[#111827]">{formatNairaExact(item.amount)}</span>
      </div>
    </article>
  )
}
