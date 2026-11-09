import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentMe } from '@/lib/server/accounts'

export const dynamic = 'force-dynamic'

// "What are you shopping for today?" and the notification toggles in Settings.
const schema = z.object({
  shoppingMode: z.enum(['restaurants', 'farm', 'all']).optional(),
  notifications: z
    .object({ orderUpdates: z.boolean(), promotions: z.boolean(), news: z.boolean(), sms: z.boolean() })
    .partial()
    .optional(),
})

export const PATCH = handle(async (request) => {
  const { user, ref, profile } = await requireProfile(request)
  const body = await parseBody(request, schema)
  await ref.update({
    ...(body.shoppingMode && { shoppingMode: body.shoppingMode }),
    ...(body.notifications && { notifications: { ...(profile.notifications as object | undefined), ...body.notifications } }),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ok(await presentMe(user), 'Preferences saved')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PUT, methodNotAllowed as DELETE }
