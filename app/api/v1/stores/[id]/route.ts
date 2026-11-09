import { z } from 'zod'
import { parseQuery } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { fromQuery, locationQuery, presentStoreCard, visibleStores } from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: a restaurant or farm page.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params
  const query = parseQuery(request, z.object(locationQuery))
  const store = (await visibleStores()).get(id)
  if (!store) throw new ApiError('not_found', 'Store not found')
  const sections = await db().collection('stores').doc(id).collection('menuSections').orderBy('position').get()
  return ok(
    {
      ...presentStoreCard(store, fromQuery(query)),
      description: store.description ?? null,
      address: store.address,
      location: store.location,
      openingHours: store.openingHours ?? null,
      isOnline: Boolean(store.lastSeenAt && Date.now() - store.lastSeenAt.toDate().getTime() < 10 * 60 * 1000),
      menuSections: sections.docs.map((d) => ({ id: d.id, name: d.get('name') })),
    },
    'Store loaded',
  )
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
