import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentStore } from '@/lib/server/accounts'
import { useFile } from '@/lib/server/storage'
import { assertEditable } from '@/lib/server/verification'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Onboarding steps 2–3: CAC certificate and NIN (upload first via POST /uploads
// with purpose "kyc_document").
const schema = z
  .object({ cacFileId: z.string().max(100).optional(), ninFileId: z.string().max(100).optional() })
  .refine((v) => v.cacFileId || v.ninFileId, { message: 'Send cacFileId and/or ninFileId', path: ['body'] })

export const PUT = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['seller'] })
  assertEditable(caller, 'documents')
  const body = await parseBody(request, schema)
  const ref = db().collection('stores').doc(caller.user.uid)
  if (!(await ref.get()).exists) throw new ApiError('conflict', 'Add your business details first')

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (body.cacFileId) update['documents.cacFileId'] = (await useFile(caller.user.uid, body.cacFileId, ['kyc_document'])).fileId
  if (body.ninFileId) update['documents.ninFileId'] = (await useFile(caller.user.uid, body.ninFileId, ['kyc_document'])).fileId
  await ref.update(update)
  const store = await ref.get()
  return ok(presentStore(store.id, store.data()!), 'Documents saved')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
