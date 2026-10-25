'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthHeading, FieldHint, PasswordField, PrimaryButton, SocialSignIn, TextField } from '@/components/admin/auth-fields'
import { DEMO_ACCOUNT, signIn } from '@/lib/admin/auth'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ field: 'email' | 'password'; message: string } | null>(null)

  const canSubmit = email.trim() !== '' && password !== ''

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = signIn(email, password)
    if (!result.ok) {
      setError({ field: result.field, message: result.message })
      return
    }
    const next = new URLSearchParams(window.location.search).get('next')
    router.replace(next?.startsWith('/admin') ? next : '/admin')
    router.refresh()
  }

  return (
    <main>
      <AuthHeading title="Welcome Back" subtitle="Sign in to your account" />

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
          state={error?.field === 'email' ? 'error' : 'default'}
          hint={error?.field === 'email' && <FieldHint tone="error">{error.message}</FieldHint>}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setError(null)
          }}
          state={error?.field === 'password' ? 'error' : 'default'}
          hint={error?.field === 'password' && <FieldHint tone="error">{error.message}</FieldHint>}
        />
        <button
          type="button"
          onClick={() => setError({ field: 'email', message: 'Password reset is not available yet. Contact a super admin.' })}
          className="self-end text-[13px] font-medium text-[#1b1f26]/72 hover:text-[#0f3d2e]"
        >
          Forgot password?
        </button>

        <div className="mt-1 flex flex-col items-center gap-[13px]">
          <PrimaryButton type="submit" disabled={!canSubmit}>
            Sign In
          </PrimaryButton>
          <p className="text-center text-[13px] font-medium">
            <span className="text-[#1b1f26]/72">New to Vorapicks?</span>{' '}
            <Link href="/admin/signup" className="text-[#0f3d2e] hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </form>

      <div className="mt-3">
        <SocialSignIn />
      </div>

      <p className="mt-8 rounded-xl bg-[#f5f6f3] px-3 py-2.5 text-center text-[11px] leading-4 text-black/50">
        Demo login: <span className="font-medium text-black/70">{DEMO_ACCOUNT.email}</span> /{' '}
        <span className="font-medium text-black/70">{DEMO_ACCOUNT.password}</span>
      </p>
    </main>
  )
}
