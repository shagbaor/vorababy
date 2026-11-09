import { z } from 'zod'
import { parseQuery } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { visibleProducts, visibleStores } from '@/lib/server/catalog'

export const dynamic = 'force-dynamic'

// Public: "Result Suggestions" while typing: matching product and store names.
export const GET = handle(async (request) => {
  const { q } = parseQuery(request, z.object({ q: z.string().trim().min(1).max(80) }))
  const term = q.toLowerCase()
  const stores = await visibleStores()
  const products = await visibleProducts(stores)
  const names = new Map<string, { text: string; type: 'product' | 'store'; id: string }>()
  for (const p of products) {
    const name = String(p.name)
    if (name.toLowerCase().includes(term) && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), { text: name, type: 'product', id: p.id })
  }
  for (const s of stores.values()) {
    if (String(s.name).toLowerCase().includes(term)) names.set(`store:${s.id}`, { text: s.name, type: 'store', id: s.id })
  }
  const items = [...names.values()]
    .sort((a, b) => Number(b.text.toLowerCase().startsWith(term)) - Number(a.text.toLowerCase().startsWith(term)) || a.text.length - b.text.length)
    .slice(0, 8)
  return ok({ items }, 'Suggestions loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
