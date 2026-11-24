'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Image01Icon, Logout03Icon, UserGroupIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { adminSections, isSectionActive } from '@/components/admin/admin-nav'
import { useAdminStore } from '@/components/admin/admin-store'
import { signOut } from '@/app/admin/actions'

// Desktop (lg and up): a fixed sidebar replaces the phone's bottom tab bar.
export default function SideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, admins } = useAdminStore()
  const pending = profile.superAdmin ? admins.filter((a) => a.status === 'pending').length : 0

  const extra = [
    { label: 'Admin team', href: '/admin/team', icon: UserGroupIcon, badge: pending },
    ...(profile.superAdmin ? [{ label: 'Home banner', href: '/admin/banner', icon: Image01Icon, badge: 0 }] : []),
  ]

  async function handleSignOut() {
    await signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  const item = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      active ? 'bg-[#2e8b57]/10 text-[#2e8b57]' : 'text-[#4b5563] hover:bg-gray-100 hover:text-[#1e1e1e]',
    )

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#f3f4f6] bg-white px-4 py-6 lg:flex">
      <Link href="/admin" className="flex items-center gap-2 px-2">
        <Image src="/vorapicks-logo.png" alt="Vorapicks" width={32} height={32} className="rounded-lg" />
        <span className="text-base font-semibold text-[#1e1e1e]">Vorapicks Admin</span>
      </Link>

      <nav aria-label="Admin" className="mt-8 flex flex-1 flex-col gap-1">
        {adminSections.map(({ label, href, navIcon }) => {
          const active = isSectionActive(href, pathname)
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={item(active)}>
              <HugeiconsIcon icon={navIcon} size={20} strokeWidth={1.5} />
              {label === 'Order' ? 'Orders' : label === 'Dispute' ? 'Disputes' : label}
            </Link>
          )
        })}
        <div className="my-3 h-px bg-[#f3f4f6]" />
        {extra.map(({ label, href, icon, badge }) => {
          const active = isSectionActive(href, pathname)
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={item(active)}>
              <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-[#ff3b3b] text-[11px] font-bold text-white">{badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-[#f3f4f6] px-2 pt-4">
        <div aria-hidden className="flex size-9 items-center justify-center rounded-full bg-[#2e8b57] text-xs font-semibold text-white">
          {profile.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#1e1e1e]">{profile.name}</p>
          <p className="text-[11px] text-[#989997]">{profile.superAdmin ? 'Super admin' : 'Admin'}</p>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={handleSignOut}
          className="rounded-full p-1.5 text-[#6b7280] transition-colors hover:bg-gray-100"
        >
          <HugeiconsIcon icon={Logout03Icon} size={20} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  )
}
