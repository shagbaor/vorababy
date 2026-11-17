import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { getHomeBanner } from '@/lib/server/home-banner'

export const dynamic = 'force-dynamic'

// Public: the banner at the top of the buyer home screen, set by super
// admins on /admin/banner. { enabled, kind: image|text, title, subtitle,
// imageUrl, color, endsAt, link }
export const GET = handle(async () => {
  return ok(await getHomeBanner(), 'Banner loaded')
})

export { methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
