import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { presentMe } from '@/lib/server/accounts'
import { submitForReview } from '@/lib/server/verification'

export const dynamic = 'force-dynamic'

// Sends the rider's details for review by the Vorapicks team.
export const POST = handle(async (request) => {
  const { auto, autoApproveMinutes } = await submitForReview(await requireProfile(request, { roles: ['rider'] }))
  const message = auto
    ? `Your details are verified. Your account will be approved within ${autoApproveMinutes} minutes.`
    : 'Submitted for review. We will notify you within 24–48 hours.'
  return ok(await presentMe(await requireUser(request)), message)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
