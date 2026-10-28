import { requireAdmin } from '@/lib/server/auth'
import { inviteAdmin, inviteInput } from '@/lib/server/accounts'
import { ok, readJson, route } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export const POST = route(async (request) => {
  const admin = await requireAdmin(request)
  const input = await readJson(request, inviteInput)
  const signInUrl = new URL('/admin/login', request.url).toString()
  return ok(await inviteAdmin({ uid: admin.uid, email: admin.email }, input, signInUrl), 201)
})
