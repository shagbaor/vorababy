'use client'

import Link from 'next/link'
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkBadge01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import {
  AuthHeading,
  FieldHint,
  PasswordField,
  PhoneField,
  PrimaryButton,
  SocialSignIn,
  TextField,
  type FieldState,
} from '@/components/admin/auth-fields'
import { signUp, type SignUpResult } from '@/app/admin/actions'
import { EMAIL_PATTERN, PASSWORD_RULES, passwordValid } from '@/lib/admin/auth'

export default function AdminSignupPage() {
  const [requested, setRequested] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })

  if (requested) {
    return (
      <main className="flex min-h-dvh flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24 text-center">
          <HugeiconsIcon icon={CheckmarkBadge01Icon} size={56} strokeWidth={1.5} className="text-[#2a8d36]" />
          <p className="text-xl font-medium text-[#1e1e1e]">Request sent</p>
          <p className="max-w-[280px] text-[13px] text-black/50">
            A Vorapicks super admin will review your account. Once it&apos;s approved, sign in with {form.email.trim()}.
          </p>
          <Link href="/admin/login" className="mt-4 text-[14px] font-medium text-[#0f3d2e] hover:underline">
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return <DetailsStep form={form} setForm={setForm} onCreated={() => setRequested(true)} />
}

function DetailsStep({
  form,
  setForm,
  onCreated,
}: {
  form: { fullName: string; email: string; phone: string; password: string; confirm: string }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  onCreated: () => void
}) {
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({})
  const [serverError, setServerError] = useState<Extract<SignUpResult, { ok: false }> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const phoneDigits = form.phone.replace(/\D/g, '')
  const emailFormatOk = EMAIL_PATTERN.test(form.email.trim())
  const checks = {
    fullName: form.fullName.trim().length >= 2,
    email: emailFormatOk,
    phone: phoneDigits.length === 10,
    password: passwordValid(form.password),
    confirm: form.confirm !== '' && form.confirm === form.password,
  }
  const allValid = Object.values(checks).every(Boolean)

  function fieldState(field: keyof typeof form): FieldState {
    if (serverError?.field === field) return 'error'
    if (!touched[field] || form[field] === '') return 'default'
    return checks[field] ? (field === 'password' || field === 'phone' ? 'success' : 'default') : 'error'
  }

  function update(field: keyof typeof form) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      if (serverError?.field === field) setServerError(null)
      setTouched((prev) => ({ ...prev, [field]: true }))
    }
  }

  return (
    <main>
      <AuthHeading title="Create Account" subtitle="Join the team keeping Vorapicks running" backHref="/admin/login" />

      <form
        noValidate
        className="mt-[27px] flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!allValid) {
            setTouched({ fullName: true, email: true, phone: true, password: true, confirm: true })
            return
          }
          if (submitting) return
          setSubmitting(true)
          const result = await signUp({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password }).catch(
            () => ({ ok: false as const, field: 'email' as const, message: 'Something went wrong. Try again.' }),
          )
          setSubmitting(false)
          if (result.ok) onCreated()
          else setServerError(result)
        }}
      >
        <TextField
          label="Full Name"
          autoComplete="name"
          placeholder="Enter full name"
          value={form.fullName}
          onChange={(event) => update('fullName')(event.target.value)}
          state={fieldState('fullName')}
          hint={
            fieldState('fullName') === 'error' && (
              <FieldHint tone="error">{serverError?.field === 'fullName' ? serverError.message : 'Enter your full name'}</FieldHint>
            )
          }
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
              <FieldHint tone="error">{serverError?.field === 'email' ? serverError.message : 'Enter a valid email address'}</FieldHint>
            )
          }
        />
        <PhoneField
          label="Phone Number"
          value={form.phone}
          onChange={update('phone')}
          state={fieldState('phone')}
          hint={
            fieldState('phone') === 'error' && (
              <FieldHint tone="error">{serverError?.field === 'phone' ? serverError.message : 'Enter a valid phone number'}</FieldHint>
            )
          }
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
          <PrimaryButton type="submit" disabled={!allValid || submitting || serverError !== null}>
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
