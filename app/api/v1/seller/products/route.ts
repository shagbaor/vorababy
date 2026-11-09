import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { pageQuery, paginate, parseBody, parseQuery, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { presentSellerProduct, productSchema } from '@/lib/server/seller-products'
import { useFile } from '@/lib/server/storage'

export const dynamic = 'force-dynamic'

// My Products: the seller's own listings, drafts included.
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['seller'] })
  const query = parseQuery(request, pageQuery.extend({ status: z.enum(['all', 'published', 'draft', 'low_stock']).default('all'), q: z.string().max(80).optional() }))
  const snapshot = await db().collection('products').where('storeId', '==', user.uid).get()
  const all = snapshot.docs.map((d) => presentSellerProduct(d.id, d.data())).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const q = query.q?.toLowerCase()
  const items = all.filter(
    (p) =>
      (query.status === 'all' || (query.status === 'low_stock' ? p.isLowStock : p.status === query.status)) &&
      (!q || p.name.toLowerCase().includes(q)),
  )
  return ok(
    {
      counts: {
        all: all.length,
        published: all.filter((p) => p.status === 'published').length,
        draft: all.filter((p) => p.status === 'draft').length,
        lowStock: all.filter((p) => p.isLowStock).length,
      },
      ...paginate(items, query),
    },
    `${all.length} product${all.length === 1 ? '' : 's'} total`,
  )
})

// Add New Product. Publishing needs an approved store; drafts can be prepared while the review is pending.
export const POST = handle(async (request) => {
  const { user, profile } = await requireProfile(request, { roles: ['seller'] })
  const body = await parseBody(request, productSchema)
  const store = await db().collection('stores').doc(user.uid).get()
  if (!store.exists) throw new ApiError('conflict', 'Add your business details first')
  if (body.status === 'published' && profile.verificationStatus !== 'approved') {
    throw new ApiError('forbidden', 'You can publish once your store is approved. Save it as a draft for now.')
  }
  if (!(await db().collection('categories').doc(body.categoryId).get()).exists) {
    throw new ApiError('validation_failed', 'Choose a category', { categoryId: 'Choose a category' })
  }
  if (body.menuSectionId && !(await store.ref.collection('menuSections').doc(body.menuSectionId).get()).exists) {
    throw new ApiError('validation_failed', 'Menu section not found', { menuSectionId: 'Choose a menu section' })
  }

  const { photoFileIds, ...fields } = body
  const photos = await Promise.all((photoFileIds ?? []).map((id) => useFile(user.uid, id, ['product_photo'])))
  const ref = db().collection('products').doc()
  await ref.set({
    ...fields,
    lowStockThreshold: fields.lowStockThreshold ?? 3,
    nameLower: fields.name.toLowerCase(),
    photos: photos.map((p) => ({ fileId: p.fileId, url: p.url })),
    storeId: user.uid,
    storeName: store.get('name'),
    storeType: store.get('type'),
    soldCount: 0,
    rating: null,
    ratingCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ok(presentSellerProduct(ref.id, (await ref.get()).data()!), body.status === 'published' ? 'Product published' : 'Draft saved', 201)
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
