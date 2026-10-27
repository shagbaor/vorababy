'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { adminSections, isSectionActive } from '@/components/admin/admin-nav'

// Detail screens with their own bottom action bar hide the tab bar, as in the design.
const HIDDEN_ON = [/^\/admin\/disputes\/[^/]+$/, /^\/admin\/support\/[^/]+$/]

export default function BottomNav() {
  const pathname = usePathname()

  if (HIDDEN_ON.some((pattern) => pattern.test(pathname))) return null

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-[#f3f4f6] bg-white px-2 pt-[9px] pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      <ul className="flex items-center justify-between px-[7px]">
        {adminSections.map(({ label, href, navIcon }) => {
          const active = isSectionActive(href, pathname)

          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-[54px] min-w-[55px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors',
                  active ? 'text-[#2e8b57]' : 'text-[#a3a4a6] hover:text-[#6b7280]',
                )}
              >
                <HugeiconsIcon icon={navIcon} size={24} strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-4 tracking-[0.14px]">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
