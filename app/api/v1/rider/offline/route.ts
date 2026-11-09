import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// "You're offline": no more job offers. An active delivery continues.
export const POST = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['rider'] })
  await db().collection('riders').doc(user.uid).update({ isOnline: false })
  return ok({ isOnline: false }, "You're offline")
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
