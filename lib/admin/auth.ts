// Mock admin authentication. Accounts live in this browser's localStorage and
// the session is a plain cookie the route guard (proxy.ts) checks for. This is
// a stand-in for a real auth backend and provides no actual security.

export const SESSION_COOKIE = 'vp_admin_session'

const ACCOUNTS_KEY = 'vorapicks-admin-accounts'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export const DEMO_ACCOUNT = {
  fullName: 'Vorapicks HQ',
  email: 'admin@vorapicks.com',
  phone: '+234 912 451 9504',
  password: 'Vorapicks2026!',
}

// Shown on the verify screen while there is no SMS provider.
export const DEMO_OTP = '2314'

export type AdminAccount = typeof DEMO_ACCOUNT

function readAccounts(): AdminAccount[] {
  try {
    const saved = window.localStorage.getItem(ACCOUNTS_KEY)
    return saved ? (JSON.parse(saved) as AdminAccount[]) : []
  } catch {
    return []
  }
}

function findAccount(email: string) {
  const normalized = email.trim().toLowerCase()
  return [DEMO_ACCOUNT, ...readAccounts()].find((account) => account.email.toLowerCase() === normalized)
}

export function emailTaken(email: string) {
  return Boolean(findAccount(email))
}

export function createAccount(account: AdminAccount) {
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...readAccounts(), { ...account, email: account.email.trim() }]))
  } catch {
    // Storage unavailable: the account only lasts until reload.
  }
}

export type SignInResult = { ok: true } | { ok: false; field: 'email' | 'password'; message: string }

export function signIn(email: string, password: string): SignInResult {
  const account = findAccount(email)
  if (!account) return { ok: false, field: 'email', message: 'Incorrect email address' }
  if (account.password !== password) return { ok: false, field: 'password', message: 'Password is incorrect' }

  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(account.email)}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`
  return { ok: true }
}

export function signOut() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

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
