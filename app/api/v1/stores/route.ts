import { requireCaller } from '@/lib/server/auth'
import { registerStore, storeInput } from '@/lib/server/accounts'
import { ok, readJson, route } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

// A seller registers their store. It stays hidden from buyers until an admin verifies it.
export const POST = route(async (request) => {
  const caller = await requireCaller(request, 'seller')
  const input = await readJson(request, storeInput)
  return ok(await registerStore(caller.uid, input), 201)
})
