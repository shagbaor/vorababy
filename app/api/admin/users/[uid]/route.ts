import { z } from 'zod'
import { requireAdmin } from '@/lib/server/auth'
import { applyAdminAction } from '@/lib/server/accounts'
import { ok, readJson, route } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

const input = z.object({
  action: z.enum(['verify', 'unverify', 'suspend', 'unsuspend', 'ban', 'unban']),
})

export const PATCH = route<{ params: Promise<{ uid: string }> }>(async (request, { params }) => {
  const admin = await requireAdmin(request)
  const { uid } = await params
  const { action } = await readJson(request, input)
  return ok(await applyAdminAction({ uid: admin.uid, email: admin.email }, uid, action))
})
