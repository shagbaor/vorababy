import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentRider, verificationStatus } from '@/lib/server/accounts'
import { assertEditable, riderProfileSchema } from '@/lib/server/verification'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Rider onboarding step 1: personal details (riders/{uid}).
export const PUT = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['rider'] })
  assertEditable(caller, 'details')
  const body = await parseBody(request, riderProfileSchema)
  const ref = db().collection('riders').doc(caller.user.uid)
  const existing = await ref.get()
  await ref.set(
    {
      ...body,
      userId: caller.user.uid,
      verificationStatus: verificationStatus(caller.profile),
      ...(!existing.exists && { isOnline: false, rating: null, ratingCount: 0, tripCount: 0, createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await caller.ref.update({ location: `${body.address.city}${body.address.state ? `, ${body.address.state}` : ''}` })
  return ok(presentRider((await ref.get()).data()!), 'Personal details saved')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
