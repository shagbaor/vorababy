import { z } from 'zod'
import { parseQuery } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { fromQuery, locationQuery, presentStoreCard, visibleStores } from '@/lib/server/catalog'
import { lagosNow } from '@/lib/server/geo'
import { topReview } from '@/lib/server/reviews'
import { deliveryFeeKobo, getSettings } from '@/lib/server/settings'

export const dynamic = 'force-dynamic'

// Public: a restaurant or farm page.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params
  const query = parseQuery(request, z.object(locationQuery))
  const store = (await visibleStores()).get(id)
  if (!store) throw new ApiError('not_found', 'Store not found')
  const from = fromQuery(query)
  const [sections, settings, review] = await Promise.all([
    db().collection('stores').doc(id).collection('menuSections').orderBy('position').get(),
    getSettings(),
    topReview(id),
  ])
  const card = presentStoreCard(store, from)
  const today = store.openingHours?.[lagosNow().weekday] ?? null
  return ok(
    {
      ...card,
      // Only approved stores are listed.
      verified: true,
      deliveryFeeKobo: deliveryFeeKobo(settings, card.distanceKm ?? 0),
      deliveryFeeIsEstimate: card.distanceKm === null,
      prepMinutes: store.type === 'restaurant' ? (store.prepMinutes ?? 20) : null,
      deliveryMinutes: store.deliveryMinutes ?? null,
      todayHours: today,
      topReview: review,
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
