import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { verificationStatus } from '@/lib/server/accounts'
import { presentVerification } from '@/lib/server/kyc'

export const dynamic = 'force-dynamic'

// Identity checks for sellers and riders: which are needed, and each one's
// state (not_started, verified, failed + reason + attemptsLeft, pending, review).
export const GET = handle(async (request) => {
  const { profile } = await requireProfile(request, { roles: ['seller', 'rider'] })
  return ok({ verificationStatus: verificationStatus(profile), ...(await presentVerification(profile))! }, 'Verification loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
