import { z } from 'zod'
import { parseBody, parseQuery, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { listMessages, sendMessage } from '@/lib/server/chat'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

// Newest first. Pass `cursor` (the nextCursor of the previous page) to load older messages.
export const GET = handle<Context>(async (request, { params }) => {
  const { user } = await requireProfile(request)
  const query = parseQuery(request, z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), cursor: z.string().max(100).optional() }))
  return ok(await listMessages(user.uid, (await params).id, query.limit, query.cursor), 'Messages loaded')
})

const schema = z.object({
  text: z.string().trim().max(2000, 'Use 2000 characters or fewer').optional(),
  attachmentFileId: z.string().max(100).optional(),
  clientId: z.string().trim().min(1).max(64),
})

export const POST = handle<Context>(async (request, { params }) => {
  const caller = await requireProfile(request)
  const body = await parseBody(request, schema)
  if (!body.text && !body.attachmentFileId) throw new ApiError('validation_failed', 'Type a message', { text: 'Type a message' })
  const result = await sendMessage(caller, (await params).id, body)
  return ok(result, result.duplicate ? 'Already sent' : 'Message sent', result.duplicate ? 200 : 201)
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
