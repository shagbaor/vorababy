import { requireUser } from '@/lib/api/auth'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// Who the bearer token belongs to. Lets the app check its integration before
// the marketplace endpoints exist.
export const GET = handle(async (request) => {
  const user = await requireUser(request)
  return ok({ uid: user.uid, email: user.email, phone: user.phone }, 'Signed in')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
