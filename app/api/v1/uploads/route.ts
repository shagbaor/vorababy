import { z } from 'zod'
import { parseBody, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { allowAttempt } from '@/lib/admin/rate-limit'
import { createUpload, UPLOAD_PURPOSES, type UploadPurpose } from '@/lib/server/storage'

export const dynamic = 'force-dynamic'

// Step 1 of an upload: returns a signed URL the app PUTs the file to.
const schema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES as [UploadPurpose, ...UploadPurpose[]]),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
})

export const POST = handle(async (request) => {
  const { user } = await requireProfile(request)
  const body = await parseBody(request, schema)
  if (!(await allowAttempt(`upload:${user.uid}`, 100, 60))) throw new ApiError('rate_limited', 'Too many uploads. Try again later.')
  return ok(await createUpload(user.uid, body.purpose, body.contentType, body.sizeBytes), 'Upload ready', 201)
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
