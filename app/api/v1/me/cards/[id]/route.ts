import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }

// Set Default.
export const PATCH = handle<Context>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  const { id } = await params
  await parseBody(request, z.object({ isDefault: z.literal(true) }))
  const cards = await ref.collection('cards').get()
  if (!cards.docs.some((d) => d.id === id)) throw new ApiError('not_found', 'Card not found')
  const batch = db().batch()
  cards.docs.forEach((d) => batch.update(d.ref, { isDefault: d.id === id }))
  await batch.commit()
  return ok({ id, isDefault: true }, 'Default card updated')
})

// Remove.
export const DELETE = handle<Context>(async (request, { params }) => {
  const { ref } = await requireProfile(request)
  const card = ref.collection('cards').doc((await params).id)
  const snapshot = await card.get()
  if (!snapshot.exists) throw new ApiError('not_found', 'Card not found')
  await card.delete()
  if (snapshot.get('isDefault')) {
    const next = await ref.collection('cards').limit(1).get()
    if (!next.empty) await next.docs[0].ref.update({ isDefault: true })
  }
  return ok(null, 'Card removed')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PUT }
