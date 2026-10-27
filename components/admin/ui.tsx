'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon, Search01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/admin/format'

export function ScreenHeader({
  title,
  backHref,
  trailing,
}: {
  title: React.ReactNode
  backHref: string
  trailing?: React.ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-3 pt-8">
      <div className="flex min-w-0 items-center gap-[13px]">
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#f9fafb] text-[#1e1e1e] transition-colors hover:bg-gray-100"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={18} strokeWidth={1.8} />
        </Link>
        <h1 className="truncate text-base font-medium leading-[20.3px] tracking-[-0.3px] text-black">{title}</h1>
      </div>
      {trailing}
    </header>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-2xl border border-[#f0f0f0]/30 bg-[#fbfbfb] px-4 focus-within:border-[#2e8b57]/40">
      <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={1.5} className="shrink-0 text-[#9ca3af]" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-xs tracking-[0.07px] text-[#111827] outline-none placeholder:text-[#9ca3af]"
      />
    </label>
  )
}

export type FilterTab<T extends string> = { value: T; label: string; count: number }

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  activeClassName = 'bg-[#16a34a]',
}: {
  tabs: FilterTab<T>[]
  value: T
  onChange: (value: T) => void
  activeClassName?: string
}) {
  return (
    <div role="tablist" className="-mx-[22px] flex gap-2 overflow-x-auto px-[22px] [scrollbar-width:none]">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium leading-4 transition-colors',
              active ? cn(activeClassName, 'text-white') : 'bg-[#f9fafb] text-[#a3a4a6] hover:bg-gray-100',
            )}
          >
            {tab.label}
            <span
              className={cn(
                'flex size-4 items-center justify-center rounded-full text-[11px] font-bold',
                active ? 'bg-white/25 text-white' : 'bg-white text-[#a3a4a6]',
              )}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const pillTones = {
  orange: 'bg-[#ffedd5] text-[#c2410c]',
  red: 'bg-[#fee2e2] text-[#dc2626]',
  green: 'bg-[#b8ddc9] text-[#0f3d2e]',
  blue: 'bg-[#dbeafe] text-[#1d4ed8]',
  grey: 'bg-[#f3f4f6] text-[#4b5563]',
}

export function Pill({ tone, children, className }: { tone: keyof typeof pillTones; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-[15.5px] tracking-[0.08px]',
        pillTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const avatarColors = ['#2e8b57', '#c2410c', '#1d4ed8', '#7c3aed', '#0f766e', '#b45309', '#be185d']

export function Avatar({
  name,
  size = 36,
  shape = 'rounded',
  online,
}: {
  name: string
  size?: number
  shape?: 'circle' | 'rounded'
  online?: boolean
}) {
  const color = avatarColors[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length]

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className={cn(
          'flex size-full items-center justify-center font-semibold text-white',
          shape === 'circle' ? 'rounded-full' : 'rounded-[30%]',
        )}
        style={{ backgroundColor: color, fontSize: Math.round(size * 0.36) }}
      >
        {initials(name)}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -left-0.5 size-3 rounded-full border-2 border-white bg-[#16a34a]" />
      )}
    </span>
  )
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="absolute bottom-0 w-full max-w-[390px] rounded-t-3xl bg-white px-[23px] pt-5 pb-[max(32px,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e5e7eb]" />
        <div className="mt-4">
          <h2 className="text-base font-semibold leading-6 tracking-[-0.24px] text-[#202020]">{title}</h2>
          {subtitle && <p className="text-xs leading-4 tracking-[0.08px] text-[#a3a4a6]">{subtitle}</p>}
        </div>
        <div className="mt-[31px] flex flex-col gap-1">{children}</div>
      </div>
    </div>
  )
}

export function SheetButton({
  variant,
  onClick,
  children,
}: {
  variant: 'primary' | 'danger' | 'outline'
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[53px] w-full items-center justify-center rounded-2xl text-base tracking-[0.08px] transition-opacity hover:opacity-90',
        variant === 'primary' && 'bg-[#0f3d2e] font-bold text-white',
        variant === 'danger' && 'bg-[#ff3b3b] font-bold text-white',
        variant === 'outline' && 'border border-[#e5e7eb] font-semibold text-[#4b5563]',
      )}
    >
      {children}
    </button>
  )
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  const toast = message ? (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <p className="rounded-full bg-[#e5f5ec] px-3 py-1.5 text-[12px] font-medium text-[#1e1e1e] shadow-sm animate-in fade-in slide-in-from-top-2">
        {message}
      </p>
    </div>
  ) : null

  return { toast, showToast: setMessage }
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-[#f3f4f6] p-6 text-center text-sm text-[#6b7280]">{children}</p>
}
