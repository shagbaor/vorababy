import { z } from 'zod'
import { parseQuery } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { getPromoSlides } from '@/lib/server/promo-slides'

export const dynamic = 'force-dynamic'

// Public: the home screen's promo slides for one marketplace (slides without
// a picture are left out).
export const GET = handle(async (request) => {
  const { mode } = parseQuery(request, z.object({ mode: z.enum(['farm', 'restaurants']).default('farm') }))
  const slides = (await getPromoSlides())[mode].filter((s) => s.imageUrl)
  return ok({ items: slides }, 'Slides loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
