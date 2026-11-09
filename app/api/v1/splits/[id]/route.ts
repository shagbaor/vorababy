import { requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentSplit, type SplitDoc } from '@/lib/server/splits'

export const dynamic = 'force-dynamic'

// Split the bill page. Live updates: listen to Firestore splits/{id}.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const snapshot = await db().collection('splits').doc((await params).id).get()
  const split = snapshot.data() as SplitDoc | undefined
  if (!split || !split.participantIds.includes(user.uid)) throw new ApiError('not_found', 'Split not found')
  return ok(presentSplit(snapshot.id, split, user.uid), 'Split loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
