'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AuthHeading, FieldHint, PrimaryButton, TextField } from '@/components/admin/auth-fields'
import { requestPasswordReset } from '@/app/admin/actions'
import { EMAIL_PATTERN } from '@/lib/admin/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setSending(true)
    const result = await requestPasswordReset(email).catch(() => ({ ok: false as const, message: 'Something went wrong. Try again.' }))
    setSending(false)
    if (result.ok) setSentTo(email.trim())
    else setError(result.message)
  }

  if (sentTo) {
    return (
      <main>
        <AuthHeading title="Check your email" subtitle="Reset link sent" backHref="/admin/login" />
        <div className="mt-[27px] flex flex-col gap-4 text-[14px] text-[#1b1f26]/72">
          <p>
            If <span className="font-medium text-[#1e1e1e]">{sentTo}</span> has a Vorapicks admin account, we&apos;ve sent it a link to
            choose a new password. The link expires in one hour.
          </p>
          <p className="text-[12px] text-black/50">Nothing arrived? Check your spam folder, or wait a minute and try again.</p>
          <Link href="/admin/login" className="mt-2 text-center font-medium text-[#0f3d2e] hover:underline">
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main>
      <AuthHeading title="Forgot password?" subtitle="We'll email you a link to choose a new one" backHref="/admin/login" />

      <form onSubmit={handleSubmit} className="mt-[27px] flex flex-col gap-3" noValidate>
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="johndoe@gmail.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(null)
          }}
          state={error ? 'error' : 'default'}
          hint={error && <FieldHint tone="error">{error}</FieldHint>}
        />
        <div className="mt-1">
          <PrimaryButton type="submit" disabled={!email.trim() || sending}>
            {sending ? 'Sending…' : 'Send reset link'}
          </PrimaryButton>
        </div>
        <p className="text-center text-[12px] text-black/50">Signed up with Google? Use “Continue with Google” on the sign-in page instead.</p>
      </form>
    </main>
  )
}
