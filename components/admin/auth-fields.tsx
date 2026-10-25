'use client'

import Link from 'next/link'
import { Outfit } from 'next/font/google'
import { useId, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { AppleIcon, ArrowDown01Icon, ArrowLeft02Icon, LockIcon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const outfit = Outfit({ subsets: ['latin'], weight: ['500'] })

export type FieldState = 'default' | 'error' | 'success'

const fieldStateClass: Record<FieldState, string> = {
  default: 'border-transparent bg-[#f5f6f3] focus-within:border-[#0f3d2e]/40',
  error: 'border-[#e62b2b] bg-[#ff3030]/10',
  success: 'border-[#2a8d36] bg-[#2f9d3c]/10',
}

export function AuthTitle({ title, subtitle, centered }: { title: string; subtitle?: React.ReactNode; centered?: boolean }) {
  return (
    <div className={cn('flex flex-col', centered ? 'items-center gap-[13px] text-center' : 'gap-1')}>
      <h1 className={cn(outfit.className, 'font-medium text-[#1e1e1e]', centered ? 'text-[25px]' : 'text-xl')}>{title}</h1>
      {subtitle && <p className={cn(centered ? 'text-[13px] text-black/40' : 'text-[10px] text-[#989997]')}>{subtitle}</p>}
    </div>
  )
}

export function AuthHeading({ title, subtitle, backHref }: { title: string; subtitle?: React.ReactNode; backHref?: string }) {
  return (
    <div className="flex flex-col gap-[27px] pt-[47px]">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className="-m-1 w-fit rounded-full p-1 text-[#292929] hover:bg-gray-100">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} strokeWidth={1.5} />
        </Link>
      ) : (
        <span className="h-6" />
      )}
      <AuthTitle title={title} subtitle={subtitle} />
    </div>
  )
}

export function TextField({
  label,
  state = 'default',
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; state?: FieldState; hint?: React.ReactNode }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-[7px]', className)}>
      <label htmlFor={id} className="text-xs leading-4 text-black/87">
        {label}
      </label>
      <div className={cn('flex h-[45px] items-center gap-2.5 rounded-[5px] border px-2.5 transition-colors', fieldStateClass[state])}>
        <input
          id={id}
          aria-invalid={state === 'error' || undefined}
          className={cn(
            'w-full bg-transparent text-xs tracking-[0.5px] outline-none placeholder:text-black/38',
            state === 'error' ? 'text-[#e62b2b]' : 'text-black/87',
          )}
          {...input}
        />
      </div>
      {hint}
    </div>
  )
}

export function PasswordField({
  label,
  state = 'default',
  hint,
  ...input
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; state?: FieldState; hint?: React.ReactNode }) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-xs leading-4 text-black/87">
        {label}
      </label>
      <div className={cn('flex h-[45px] items-center gap-2.5 rounded-[5px] border px-2.5 transition-colors', fieldStateClass[state])}>
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            state === 'error' ? 'bg-[#e62b2b]/15 text-[#e62b2b]' : 'bg-[#0f3d2e]/10 text-[#0f3d2e]',
          )}
        >
          <HugeiconsIcon icon={LockIcon} size={12} strokeWidth={2} />
        </span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={state === 'error' || undefined}
          className={cn(
            'w-full bg-transparent text-[13px] outline-none placeholder:text-black/38',
            state === 'error' ? 'text-[#e62b2b]' : 'text-black/87',
          )}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="shrink-0 text-black/40 hover:text-black/70"
        >
          <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} size={18} strokeWidth={1.5} />
        </button>
      </div>
      {hint}
    </div>
  )
}

export function PhoneField({
  label,
  value,
  onChange,
  state = 'default',
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  state?: FieldState
  hint?: React.ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-xs leading-4 text-black/87">
        {label}
      </label>
      <div className={cn('flex h-[45px] items-center gap-2.5 rounded-[5px] border px-2.5 transition-colors', fieldStateClass[state])}>
        <span className="flex shrink-0 items-center gap-1" title="Nigeria (+234)">
          <span aria-hidden className="flex h-4 w-6 overflow-hidden rounded-[2px]">
            <span className="flex-1 bg-[#008751]" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-[#008751]" />
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={18} strokeWidth={1.5} className="text-[#9f9f9f]" />
        </span>
        <span aria-hidden className="h-9 w-px bg-[#2761ff]" />
        <span className={cn('text-[13px] font-medium', state === 'error' ? 'text-[#e62b2b]' : 'text-black/87')}>+234</span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="912 451 9504"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d ]/g, ''))}
          aria-invalid={state === 'error' || undefined}
          className={cn(
            'w-full bg-transparent text-[13px] font-medium outline-none placeholder:font-normal placeholder:text-black/38',
            state === 'error' ? 'text-[#e62b2b]' : 'text-black/87',
          )}
        />
      </div>
      {hint}
    </div>
  )
}

export function FieldHint({ tone = 'muted', children }: { tone?: 'muted' | 'error'; children: React.ReactNode }) {
  return <p className={cn('text-[10px]', tone === 'error' ? 'text-[#e62b2b]' : 'text-black/40')}>{children}</p>
}

export function PrimaryButton({ disabled, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'flex h-[45px] w-full items-center justify-center rounded-2xl px-4 text-sm transition-colors',
        disabled ? 'cursor-not-allowed bg-[#2b2b2b]/10 text-black/40' : 'bg-[#0f3d2e] text-white hover:bg-[#0b2f23]',
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function GoogleLogo() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function SocialSignIn() {
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-[15px]">
      <div className="flex items-center gap-2.5 text-sm text-[#999]" aria-hidden>
        <span className="h-px flex-1 bg-[#e5e5e5]" />
        Or
        <span className="h-px flex-1 bg-[#e5e5e5]" />
      </div>
      {[
        { label: 'Continue with Google', icon: <GoogleLogo /> },
        { label: 'Continue with Apple', icon: <HugeiconsIcon icon={AppleIcon} size={22} strokeWidth={1.5} className="text-black" /> },
      ].map(({ label, icon }) => (
        <button
          key={label}
          type="button"
          onClick={() => setNotice(`${label.replace('Continue with ', '')} sign-in isn't connected yet.`)}
          className="flex h-[45px] items-center justify-center gap-4 rounded-[20px] bg-[#f4f4f4] text-[13px] text-black transition-colors hover:bg-[#ececec]"
        >
          {icon}
          {label}
        </button>
      ))}
      {notice && (
        <p role="status" className="text-center text-[11px] text-black/50">
          {notice}
        </p>
      )}
    </div>
  )
}
