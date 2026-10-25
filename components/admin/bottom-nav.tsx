'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { adminSections } from '@/components/admin/admin-nav'

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[390px] border-t border-[#f3f4f6] bg-white px-2 pt-[9px] pb-[max(8px,env(safe-area-inset-bottom))]"
    >
      <ul className="flex items-center justify-between px-[7px]">
        {adminSections.map(({ label, href, navIcon }) => {
          const active = href === pathname
          const content = (
            <>
              <HugeiconsIcon icon={navIcon} size={24} strokeWidth={1.5} />
              <span className="text-[10px] font-medium leading-4 tracking-[0.14px]">{label}</span>
            </>
          )
          const itemClass = cn(
            'flex h-[54px] min-w-[55px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5',
            active ? 'text-[#2e8b57]' : 'text-[#a3a4a6]',
          )

          return (
            <li key={label}>
              {href ? (
                <Link href={href} className={itemClass} aria-current={active ? 'page' : undefined}>
                  {content}
                </Link>
              ) : (
                <span className={cn(itemClass, 'cursor-not-allowed')} aria-disabled="true" title="Coming soon">
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
