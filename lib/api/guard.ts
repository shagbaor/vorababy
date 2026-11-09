import 'server-only'
import type { DocumentReference } from 'firebase-admin/firestore'
import { z } from 'zod'
import { requireUser, type ApiUser } from '@/lib/api/auth'
import { ApiError, readJson } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import type { UserRole } from '@/lib/admin/mock-data'

// Shared checks for /api/v1 handlers: who is calling, which role they have,
// whether they are allowed to trade, and request body validation.

export type ProfileDoc = {
  name: string
  email: string
  phone: string
  role: UserRole
  location: string
  verified: boolean
  suspended: boolean
  banned: boolean
  verificationStatus?: 'not_required' | 'incomplete' | 'pending' | 'approved' | 'rejected'
  verificationNote?: string
  walletBalanceKobo?: number
  [key: string]: unknown
}

export type Caller = { user: ApiUser; profile: ProfileDoc; ref: DocumentReference }

type Options = {
  // Only these roles may call.
  roles?: UserRole[]
  // Sellers and riders must have been approved by an admin.
  approved?: boolean
}

export async function requireProfile(request: Request, options: Options = {}): Promise<Caller> {
  const user = await requireUser(request)
  const ref = db().collection('users').doc(user.uid)
  const snapshot = await ref.get()
  if (!snapshot.exists) throw new ApiError('forbidden', 'Finish signing up first (POST /api/v1/me)')
  const profile = snapshot.data() as ProfileDoc
  if (profile.banned || profile.suspended) throw new ApiError('account_disabled', 'This account has been suspended. Contact Vorapicks support.')
  if (options.roles && !options.roles.includes(profile.role)) {
    throw new ApiError('forbidden', `Only ${options.roles.join(' or ')} accounts can do this`)
  }
  // "Online now" on the store page: the seller used the app in the last few minutes.
  if (profile.role === 'seller') void db().collection('stores').doc(user.uid).update({ lastSeenAt: new Date() }).catch(() => null)
  if (options.approved && profile.role !== 'buyer' && profile.verificationStatus !== 'approved') {
    throw new ApiError('forbidden', 'Your account is waiting for verification by Vorapicks')
  }
  return { user, profile, ref }
}

// Parses the JSON body against a zod schema; failures become 422 with a
// message per field.
export async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  return parse(schema, await readJson(request))
}

export function parseQuery<T extends z.ZodTypeAny>(request: Request, schema: T): z.infer<T> {
  return parse(schema, Object.fromEntries(new URL(request.url).searchParams))
}

export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const details: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'body'
    details[key] ??= issue.message
  }
  throw new ApiError('validation_failed', 'Some details need fixing', details)
}

// Common field schemas.
export const text = (max: number, min = 1) => z.string().trim().min(min, `Enter at least ${min} character${min === 1 ? '' : 's'}`).max(max, `Use ${max} characters or fewer`)
export const optionalText = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer`).optional()
export const kobo = z.number({ invalid_type_error: 'Enter an amount in kobo' }).int('Use whole kobo').nonnegative()
export const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
export const addressFields = z.object({ line: text(200), area: optionalText(100), city: text(80), state: optionalText(80) })
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
})

// Offset-based cursors: simple, and fine at this scale.
export function paginate<T>(items: T[], { limit, cursor }: { limit: number; cursor?: string }) {
  const start = Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0)
  const page = items.slice(start, start + limit)
  return { items: page, nextCursor: start + limit < items.length ? String(start + limit) : null }
}

export function toIso(value: unknown): string | null {
  const date = (value as { toDate?: () => Date } | undefined)?.toDate?.()
  return date ? date.toISOString() : null
}
