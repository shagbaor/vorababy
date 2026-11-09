import { z } from 'zod'
import { parse, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { checkBusiness, checkIdentity, checkLicence, COMPANY_TYPES } from '@/lib/server/kyc'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const testMode = process.env.DOJAH_FAKE === '1' && !process.env.VERCEL

// A selfie: JPEG or PNG as base64 (a "data:image/jpeg;base64," prefix is fine), up to about 2 MB.
const selfie = z
  .string()
  .max(2_800_000, 'Use a smaller photo (up to 2 MB)')
  .transform((s) => s.replace(/^data:image\/\w+;base64,/, ''))
  .refine((s) => s.length > 1000 || (testMode && /^(match|nomatch|spoof|down)/.test(s)), 'Take the selfie again')

const schemas = {
  identity: z.object({ nin: z.string().regex(/^\d{11}$/, 'A NIN is 11 digits'), selfieImage: selfie.optional() }),
  business: z.object({ rcNumber: z.string().trim().regex(/^(rc|bn)?\s*\d{4,8}$/i, 'Enter the RC or BN number, e.g. RC1234567'), companyType: z.enum(COMPANY_TYPES) }),
  'drivers-licence': z.object({ licenceNumber: z.string().trim().min(6).max(20).regex(/^[A-Za-z0-9\s-]+$/, 'Enter the licence number as printed') }),
}

// POST /me/verification/identity | business | drivers-licence → the check's
// result straight away: verified, or failed with a reason and attempts left.
export const POST = handle<{ params: Promise<{ check: string }> }>(async (request, { params }) => {
  const caller = await requireProfile(request, { roles: ['seller', 'rider'] })
  const check = (await params).check as keyof typeof schemas
  if (!(check in schemas)) throw new ApiError('not_found', 'No such check')
  const body = await readJson(request)
  const result =
    check === 'identity'
      ? await checkIdentity(caller, parse(schemas.identity, body))
      : check === 'business'
        ? await checkBusiness(caller, parse(schemas.business, body))
        : await checkLicence(caller, parse(schemas['drivers-licence'], body))
  const message = result.status === 'verified' ? 'Verified' : (result.message ?? 'Check finished')
  return ok(result, message)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
