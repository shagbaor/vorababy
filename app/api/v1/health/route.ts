import { handle, methodNotAllowed, ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export const GET = handle(async () => ok({ status: 'up', version: 'v1', time: new Date().toISOString() }, 'API is running'))

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
