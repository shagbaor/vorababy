import { z } from 'zod'
import { latLng, parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { updateLocation } from '@/lib/server/riders'

export const dynamic = 'force-dynamic'

// Every 10 s while online, every 5 s during a delivery. Moves the pin on the
// buyer's tracking map.
const schema = latLng.extend({ heading: z.number().min(0).max(360).optional(), speed: z.number().min(0).max(100).optional() })

export const POST = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['rider'], approved: true })
  const body = await parseBody(request, schema)
  return ok({ tracking: await updateLocation(user.uid, body) }, 'Location updated')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
