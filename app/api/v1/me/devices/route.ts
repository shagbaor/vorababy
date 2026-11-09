import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { handle, methodNotAllowed, ok } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

// Push notification tokens (Firebase Cloud Messaging), one per device.
// Registering the same token again just refreshes it.
const schema = z.object({ token: z.string().min(20).max(4096), platform: z.enum(['android', 'ios']) })

export const POST = handle(async (request) => {
  const { ref } = await requireProfile(request)
  const body = await parseBody(request, schema)
  const id = createHash('sha256').update(body.token).digest('hex').slice(0, 32)
  await ref.collection('devices').doc(id).set({ ...body, updatedAt: FieldValue.serverTimestamp() })
  return ok({ id }, 'Device registered')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
