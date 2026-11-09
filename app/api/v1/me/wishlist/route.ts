import { requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentProductCard, visibleStores } from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Wishlist screen ("4 Items saved"). Products that disappeared are skipped.
export const GET = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const saved = await ref.collection('wishlist').orderBy('createdAt', 'desc').get()
  const stores = await visibleStores()
  const products = saved.empty ? [] : await db().getAll(...saved.docs.map((d) => db().collection('products').doc(d.id)))
  const items = products
    .filter((p) => p.exists && p.get('status') === 'published' && stores.has(p.get('storeId')))
    .map((p) => ({ ...presentProductCard({ ...p.data()!, id: p.id }, stores.get(p.get('storeId'))), isWishlisted: true }))
  return ok({ total: items.length, items, nextCursor: null }, `${items.length} item${items.length === 1 ? '' : 's'} saved`)
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
