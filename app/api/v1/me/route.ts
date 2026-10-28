import { requireCaller } from '@/lib/server/auth'
import { getProfile } from '@/lib/server/accounts'
import { ok, route } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

// The signed-in person's profile, plus their store (sellers) or rider record.
// `user` is null until they finish sign-up.
export const GET = route(async (request) => {
  const caller = await requireCaller(request)
  return ok(await getProfile(caller.uid))
})
