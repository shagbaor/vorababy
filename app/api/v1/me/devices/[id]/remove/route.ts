import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// Called on sign-out so the device stops getting this person's notifications.
export const POST = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  await ref.collection('devices').doc((await params).id).delete()
  return ok(null, 'Device removed')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
