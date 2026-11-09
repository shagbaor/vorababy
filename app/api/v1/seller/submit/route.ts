import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { requireUser } from '@/lib/api/auth'
import { presentMe } from '@/lib/server/accounts'
import { submitForReview } from '@/lib/server/verification'

export const dynamic = 'force-dynamic'

// "You're all set!": sends the business for review by the Vorapicks team.
export const POST = handle(async (request) => {
  await submitForReview(await requireProfile(request, { roles: ['seller'] }))
  return ok(await presentMe(await requireUser(request)), 'Submitted for review. We will notify you within 24–48 hours.')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
