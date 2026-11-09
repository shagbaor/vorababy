import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile, text } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Restaurant menu tabs ("Rice Dishes", "Soups & Swallows"…): stores/{uid}/menuSections.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const snapshot = await db().collection('stores').doc(user.uid).collection('menuSections').orderBy('position').get()
  return ok({ items: snapshot.docs.map((d) => ({ id: d.id, name: d.get('name'), position: d.get('position') })) }, 'Menu sections loaded')
})

export const POST = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const body = await parseBody(request, z.object({ name: text(40) }))
  const store = db().collection('stores').doc(user.uid)
  if (!(await store.get()).exists) throw new ApiError('conflict', 'Add your business details first')
  const existing = await store.collection('menuSections').get()
  if (existing.size >= 30) throw new ApiError('conflict', 'You can have up to 30 menu sections')
  const ref = await store.collection('menuSections').add({ name: body.name, position: existing.size, createdAt: FieldValue.serverTimestamp() })
  return ok({ id: ref.id, name: body.name, position: existing.size }, 'Menu section added', 201)
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
