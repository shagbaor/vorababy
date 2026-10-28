import { requireCaller } from '@/lib/server/auth'
import { registerRider, riderInput } from '@/lib/server/accounts'
import { ok, readJson, route } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

// A rider adds their vehicle. They can't go online until an admin verifies them.
export const POST = route(async (request) => {
  const caller = await requireCaller(request, 'rider')
  const input = await readJson(request, riderInput)
  return ok(await registerRider(caller.uid, input), 201)
})
