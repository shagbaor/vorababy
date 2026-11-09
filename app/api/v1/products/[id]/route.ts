import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { optionalUid, presentProduct, visibleStores, wishlistIds, type ProductDoc } from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: product detail page.
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const { id } = await params
  const [snapshot, stores] = await Promise.all([db().collection('products').doc(id).get(), visibleStores()])
  const product = snapshot.exists ? ({ ...snapshot.data()!, id } as ProductDoc) : null
  const store = product && stores.get(product.storeId)
  if (!product || !store || product.status !== 'published') throw new ApiError('not_found', 'Product not found')
  return ok(presentProduct(product, store, await wishlistIds(await optionalUid(request))), 'Product loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
