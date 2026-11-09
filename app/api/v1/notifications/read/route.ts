import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// { "ids": [...] } or { "all": true }
const schema = z.union([z.object({ ids: z.array(z.string().max(100)).min(1).max(200) }), z.object({ all: z.literal(true) })])

export const POST = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const body = await parseBody(request, schema)
  const docs = 'all' in body ? (await ref.collection('notifications').where('read', '==', false).get()).docs.map((d) => d.ref) : body.ids.map((id) => ref.collection('notifications').doc(id))
  const batch = db().batch()
  docs.slice(0, 450).forEach((d) => batch.set(d, { read: true }, { merge: true }))
  await batch.commit()
  return ok({ marked: docs.length }, 'Marked as read')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
