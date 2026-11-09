import { requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { availableJobs, presentJob } from '@/lib/server/riders'

export const dynamic = 'force-dynamic'

// Available Jobs near the rider. Poll every 15 s while online; new jobs also
// arrive as "job_offer" pushes.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['rider'], approved: true })
  const rider = await db().collection('riders').doc(user.uid).get()
  if (!rider.get('isOnline')) throw new ApiError('conflict', "You're offline. Go online to see jobs.")
  const jobs = await availableJobs(user.uid)
  return ok({ total: jobs.length, items: jobs.map((j) => presentJob(j.doc, j.toStoreKm)), nextCursor: null }, `${jobs.length} job${jobs.length === 1 ? '' : 's'} available`)
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
