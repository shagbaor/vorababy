import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Public: the Categories row and Filter → Categories. Admins manage
// categories/{id} ({ name, icon, mode, position }) in Firestore.
export const GET = handle(async (request) => {
  const mode = new URL(request.url).searchParams.get('mode')
  const snapshot = await db().collection('categories').orderBy('position').get()
  const items = snapshot.docs
    .map((d) => ({ id: d.id, name: d.get('name'), icon: d.get('icon') ?? null, mode: d.get('mode') }))
    .filter((c) => !mode || mode === 'all' || c.mode === mode)
  return ok({ items }, 'Categories loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
