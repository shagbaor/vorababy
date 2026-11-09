// Shared admin auth constants and validation, safe for client and server.
// Sign-in, sign-up and sessions live in app/admin/actions.ts and lib/admin/session.ts.

export const SESSION_COOKIE = 'vp_admin_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

// Shown on the verify screen while there is no SMS provider.
export const DEMO_OTP = '2314'

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_RULES = [
  { label: 'one Uppercase', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'one number', test: (value: string) => /\d/.test(value) },
  { label: 'one symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

export function passwordValid(value: string) {
  return value.length >= 8 && PASSWORD_RULES.every((rule) => rule.test(value))
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `+234 *** *** ${digits.slice(-4)}`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'A'
}
