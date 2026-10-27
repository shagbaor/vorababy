'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon, CheckmarkBadge01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import {
  AuthHeading,
  AuthTitle,
  FieldHint,
  PasswordField,
  PhoneField,
  PrimaryButton,
  SocialSignIn,
  TextField,
  type FieldState,
} from '@/components/admin/auth-fields'
import { createAccount, DEMO_OTP, emailTaken, maskPhone, PASSWORD_RULES, passwordValid } from '@/lib/admin/auth'

type Step = 'details' | 'verify' | 'verified'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 45

export default function AdminSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })

  useEffect(() => {
    if (step !== 'verified') return
    const timer = window.setTimeout(() => router.replace('/admin/login'), 2500)
    return () => window.clearTimeout(timer)
  }, [step, router])

  if (step === 'verify') {
    return (
      <VerifyStep
        phone={form.phone}
        onBack={() => setStep('details')}
        onVerified={() => {
          createAccount({ fullName: form.fullName.trim(), email: form.email, phone: `+234 ${form.phone}`, password: form.password })
          setStep('verified')
        }}
      />
    )
  }

  if (step === 'verified') {
    return (
      <main className="flex min-h-dvh flex-col">
        <h1 className="pt-[71px] text-base font-medium text-[#1e1e1e]">Verify Phone</h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24 text-center">
          <HugeiconsIcon icon={CheckmarkBadge01Icon} size={56} strokeWidth={1.5} className="text-[#2a8d36]" />
          <p className="text-xl font-medium text-[#1e1e1e]">
            Your Phone number
            <br />
            have been verified
          </p>
          <p className="text-[11px] text-black/40">You will be redirected to the login page</p>
          <Link href="/admin/login" className="mt-4 text-[14px] font-medium text-[#0f3d2e] hover:underline">
            Go to sign in now
          </Link>
        </div>
      </main>
    )
  }

  return <DetailsStep form={form} setForm={setForm} onSubmit={() => setStep('verify')} />
}

function DetailsStep({
  form,
  setForm,
  onSubmit,
}: {
  form: { fullName: string; email: string; phone: string; password: string; confirm: string }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  onSubmit: () => void
}) {
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({})

  const phoneDigits = form.phone.replace(/\D/g, '')
  const emailFormatOk = EMAIL_PATTERN.test(form.email.trim())
  const emailInUse = emailFormatOk && emailTaken(form.email)
  const checks = {
    fullName: form.fullName.trim().length >= 2,
    email: emailFormatOk && !emailInUse,
    phone: phoneDigits.length === 10,
    password: passwordValid(form.password),
    confirm: form.confirm !== '' && form.confirm === form.password,
  }
  const allValid = Object.values(checks).every(Boolean)

  function fieldState(field: keyof typeof form): FieldState {
    if (!touched[field] || form[field] === '') return 'default'
    return checks[field] ? (field === 'password' || field === 'phone' ? 'success' : 'default') : 'error'
  }

  function update(field: keyof typeof form) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setTouched((prev) => ({ ...prev, [field]: true }))
    }
  }

  return (
    <main>
      <AuthHeading title="Create Account" subtitle="Join the team keeping Vorapicks running" backHref="/admin/login" />

      <form
        noValidate
        className="mt-[27px] flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (allValid) onSubmit()
          else setTouched({ fullName: true, email: true, phone: true, password: true, confirm: true })
        }}
      >
        <TextField
          label="Full Name"
          autoComplete="name"
          placeholder="Enter full name"
          value={form.fullName}
          onChange={(event) => update('fullName')(event.target.value)}
          state={fieldState('fullName')}
          hint={fieldState('fullName') === 'error' && <FieldHint tone="error">Enter your full name</FieldHint>}
        />
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="johndoe@gmail.com"
          value={form.email}
          onChange={(event) => update('email')(event.target.value)}
          state={fieldState('email')}
          hint={
            fieldState('email') === 'error' && (
              <FieldHint tone="error">{emailInUse ? 'An account with this email already exists' : 'Enter a valid email address'}</FieldHint>
            )
          }
        />
        <PhoneField
          label="Phone Number"
          value={form.phone}
          onChange={update('phone')}
          state={fieldState('phone')}
          hint={fieldState('phone') === 'error' && <FieldHint tone="error">Enter a valid phone number</FieldHint>}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.password}
          onChange={(event) => update('password')(event.target.value)}
          state={fieldState('password')}
          hint={
            <p className={cn('text-[11px]', fieldState('password') === 'error' ? 'text-[#e62b2b]' : 'text-black/40')}>
              At least 8 characters,{' '}
              {PASSWORD_RULES.map((rule, index) => (
                <span key={rule.label} className={cn(rule.test(form.password) && 'text-[#2a8d36]')}>
                  {rule.label}
                  {index < PASSWORD_RULES.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          }
        />
        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.confirm}
          onChange={(event) => update('confirm')(event.target.value)}
          state={fieldState('confirm')}
          hint={fieldState('confirm') === 'error' && <FieldHint tone="error">Passwords do not match</FieldHint>}
        />

        <div className="mt-1 flex flex-col items-center gap-[13px]">
          <PrimaryButton type="submit" disabled={!allValid}>
            Create Account
          </PrimaryButton>
          <p className="text-center text-[14px] font-medium">
            <span className="text-[#1b1f26]/72">Already have an account?</span>{' '}
            <Link href="/admin/login" className="text-[#0f3d2e] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </form>

      <div className="mt-3">
        <SocialSignIn />
      </div>
    </main>
  )
}

function VerifyStep({ phone, onBack, onVerified }: { phone: string; onBack: () => void; onVerified: () => void }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>('idle')
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft])

  const code = digits.join('')
  const complete = code.length === 4

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, '')
    setStatus('idle')
    if (clean.length > 1) {
      // Pasted code: spread it across the boxes.
      const next = clean.slice(0, 4).split('')
      setDigits([0, 1, 2, 3].map((i) => next[i] ?? ''))
      inputs.current[Math.min(next.length, 3)]?.focus()
      return
    }
    setDigits((prev) => prev.map((d, i) => (i === index ? clean : d)))
    if (clean && index < 3) inputs.current[index + 1]?.focus()
  }

  function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    if (!complete) return
    if (code === DEMO_OTP) {
      setStatus('success')
      window.setTimeout(onVerified, 600)
    } else {
      setStatus('error')
    }
  }

  return (
    <main>
      <div className="pt-[47px]">
        <button type="button" onClick={onBack} aria-label="Back" className="-m-1 rounded-full p-1 text-[#292929] hover:bg-gray-100">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} strokeWidth={1.5} />
        </button>
      </div>

      <form onSubmit={handleVerify} className="mt-[76px] flex flex-col items-center gap-[22px]">
        <div className="flex w-[275px] flex-col items-center gap-[25px]">
          <AuthTitle title="Verify Your Number" subtitle={`We sent a 4-digit code to ${maskPhone(phone)}`} centered />
          <div className="flex gap-4" role="group" aria-label="Verification code">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputs.current[index] = el
                }}
                value={digit}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' && !digit && index > 0) inputs.current[index - 1]?.focus()
                }}
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={4}
                aria-label={`Digit ${index + 1}`}
                className={cn(
                  'size-9 rounded-[3px] border text-center text-xs tracking-[0.5px] text-black/87 outline-none transition-colors',
                  status === 'success' && 'border-[#2a8d36] bg-[#2f9d3c]/10',
                  status === 'error' && 'border-[#e62b2b] bg-[#ff3030]/10 text-[#e62b2b]',
                  status === 'idle' && 'border-[#d9d9d9] bg-[#f5f6f3] focus:border-[#0f3d2e]',
                )}
              />
            ))}
          </div>
          {status === 'error' && <FieldHint tone="error">That code is incorrect. Try again.</FieldHint>}
        </div>

        <PrimaryButton type="submit" disabled={!complete || status === 'success'}>
          Verify
        </PrimaryButton>

        <div className="flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={() => {
              setSecondsLeft(RESEND_SECONDS)
              setDigits(['', '', '', ''])
              setStatus('idle')
              inputs.current[0]?.focus()
            }}
            className="text-[14px] font-medium text-[#1b1f26]/72 enabled:hover:text-[#0f3d2e] disabled:cursor-default"
          >
            Didn&apos;t receive it? <span className={cn(secondsLeft === 0 && 'text-[#0f3d2e]')}>Resend code</span>
          </button>
          {secondsLeft > 0 && (
            <p className="text-[11px] text-black/40">Resend available in 00:{String(secondsLeft).padStart(2, '0')}</p>
          )}
          <p className="mt-4 rounded-xl bg-[#f5f6f3] px-3 py-2 text-[12px] text-black/50">
            Demo code: <span className="font-medium tracking-widest text-black/70">{DEMO_OTP}</span>
          </p>
        </div>
      </form>
    </main>
  )
}
