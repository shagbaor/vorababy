import { FieldValue } from 'firebase-admin/firestore'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentRider } from '@/lib/server/accounts'
import { assertEditable, vehicleSchema } from '@/lib/server/verification'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Rider onboarding step 4: vehicle buyers and sellers will recognise.
export const PUT = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['rider'] })
  assertEditable(caller, 'details')
  const body = await parseBody(request, vehicleSchema)
  const ref = db().collection('riders').doc(caller.user.uid)
  if (!(await ref.get()).exists) throw new ApiError('conflict', 'Add your personal details first')
  await ref.update({ vehicle: { ...body, plateNumber: body.plateNumber?.toUpperCase() ?? null }, updatedAt: FieldValue.serverTimestamp() })
  return ok(presentRider((await ref.get()).data()!), 'Vehicle saved')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
