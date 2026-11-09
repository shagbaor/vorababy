import type { UserRole } from '@/lib/admin/mock-data'

// Marketplace user profiles (Firestore users/{uid}, keyed by Firebase Auth
// uid). Validation shared by the admin app and the mobile API.

export const USER_ROLES: UserRole[] = ['buyer', 'seller', 'rider']

export type ProfileInput = { name?: unknown; phone?: unknown; location?: unknown }
export type ProfileFields = { name: string; phone: string; location: string }
export type ProfileErrors = Partial<Record<keyof ProfileFields, string>>

// Accepts "+234 801 234 5678", "08012345678" or "8012345678" and returns E.164.
export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, '')
  if (/^\+\d{8,15}$/.test(compact)) return compact
  if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`
  if (/^[789]\d{9}$/.test(compact)) return `+234${compact}`
  return null
}

export function validateProfile(input: ProfileInput): { ok: true; value: ProfileFields } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const location = typeof input.location === 'string' ? input.location.trim() : ''

  if (name.length < 2 || name.length > 100) errors.name = 'Enter a name between 2 and 100 characters'
  const phone = rawPhone ? normalizePhone(rawPhone) : ''
  if (phone === null) errors.phone = 'Enter a valid phone number'
  if (location.length > 120) errors.location = 'Location must be 120 characters or fewer'

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, phone: phone ?? '', location } }
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Lagos' })
}
