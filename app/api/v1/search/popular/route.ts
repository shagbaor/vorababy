import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Public: "Popular Searches". Recent searches are kept on the device.
export const GET = handle(async () => {
  const stats = await db().collection('meta').doc('searchStats').get()
  const terms = (stats.get('terms') as Record<string, number> | undefined) ?? {}
  const items = Object.entries(terms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term]) => term)
  return ok({ items: items.length ? items : ['Tomatoes', 'Rice', 'Jollof Rice', 'Eggs', 'Pepper', 'Plantain'] }, 'Popular searches loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
