import { requireCaller } from '@/lib/server/auth'
import { completeSignup, signupInput } from '@/lib/server/accounts'
import { ok, readJson, route } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

// Called once, right after phone verification, with the account type picked
// on "Choose Your Role". The app must refresh its ID token afterwards
// (getIdToken(true)) to pick up the new role.
export const POST = route(async (request) => {
  const caller = await requireCaller(request)
  const input = await readJson(request, signupInput)
  return ok(await completeSignup(caller.uid, input), 201)
})
