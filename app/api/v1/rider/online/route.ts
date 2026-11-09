import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { latLng, parse, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Go online (optionally with the current position) to receive job offers.
export const POST = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['rider'], approved: true })
  const body = parse(z.object({ location: latLng.optional() }), await readJson(request).catch(() => ({})))
  await db().collection('riders').doc(user.uid).update({
    isOnline: true,
    onlineSince: FieldValue.serverTimestamp(),
    ...(body.location && { location: body.location, locationAt: FieldValue.serverTimestamp() }),
  })
  return ok({ isOnline: true }, "You're online")
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
