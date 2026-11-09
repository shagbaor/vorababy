import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { listBanks } from '@/lib/server/banks'

export const dynamic = 'force-dynamic'

// Public: the bank picker on "Set up your payout account".
export const GET = handle(async () => ok({ items: await listBanks() }, 'Banks loaded'))

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
