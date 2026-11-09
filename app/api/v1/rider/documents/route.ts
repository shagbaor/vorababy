import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { presentRider } from '@/lib/server/accounts'
import { useFile } from '@/lib/server/storage'
import { assertEditable } from '@/lib/server/verification'
import { db } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

// Rider onboarding steps 2–3: driver's licence and NIN.
const schema = z
  .object({ driversLicenceFileId: z.string().max(100).optional(), ninFileId: z.string().max(100).optional() })
  .refine((v) => v.driversLicenceFileId || v.ninFileId, { message: 'Send driversLicenceFileId and/or ninFileId', path: ['body'] })

export const PUT = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['rider'] })
  assertEditable(caller, 'documents')
  const body = await parseBody(request, schema)
  const ref = db().collection('riders').doc(caller.user.uid)
  if (!(await ref.get()).exists) throw new ApiError('conflict', 'Add your personal details first')

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (body.driversLicenceFileId) update['documents.driversLicenceFileId'] = (await useFile(caller.user.uid, body.driversLicenceFileId, ['kyc_document'])).fileId
  if (body.ninFileId) update['documents.ninFileId'] = (await useFile(caller.user.uid, body.ninFileId, ['kyc_document'])).fileId
  await ref.update(update)
  return ok(presentRider((await ref.get()).data()!), 'Documents saved')
})

export { methodNotAllowed as GET, methodNotAllowed as POST, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
