import { requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { acceptJob, declineJob } from '@/lib/server/riders'

export const dynamic = 'force-dynamic'

// Accept Job / Decline. The first rider to accept gets it (409 for the rest).
export const POST = handle<{ params: Promise<{ orderId: string; action: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['rider'], approved: true })
  const { orderId, action } = await params
  if (action === 'accept') {
    await acceptJob(user.uid, orderId)
    return ok({ orderId }, 'Job accepted. Head to the pickup.')
  }
  if (action === 'decline') {
    await declineJob(user.uid, orderId)
    return ok({ orderId }, 'Job declined')
  }
  throw new ApiError('not_found', 'No such endpoint')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
