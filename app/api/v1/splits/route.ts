import { z } from 'zod'
import { kobo, parseBody, parseQuery, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { deliverySchema, quoteCheckout } from '@/lib/server/checkout'
import { createSplit, findBuyer, presentSplit, type SplitDoc } from '@/lib/server/splits'
import { normalizePhone } from '@/lib/users'

export const dynamic = 'force-dynamic'

// Split the Bill: GET lists the splits you organise or were invited to
// (Group Orders, Split History, "2 Split Requests Pending").
export const GET = handle(async (request) => {
  const { user } = await requireProfile(request, { roles: ['buyer'] })
  const query = parseQuery(request, z.object({ role: z.enum(['organiser', 'invited', 'all']).default('all'), status: z.enum(['active', 'done', 'all']).default('all') }))
  const snapshot = await db().collection('splits').where('participantIds', 'array-contains', user.uid).get()
  const items = snapshot.docs
    .map((d) => presentSplit(d.id, d.data() as SplitDoc, user.uid))
    .filter((s) => query.role === 'all' || (query.role === 'organiser') === s.isOrganiser)
    .filter((s) => query.status === 'all' || (query.status === 'active') === (s.status === 'collecting'))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const pendingRequests = items.filter((s) => s.status === 'collecting' && !s.isOrganiser && s.myShare && s.myShare.owedKobo > 0).length
  return ok({ pendingRequests, total: items.length, items, nextCursor: null }, 'Splits loaded')
})

// Start a split from the current cart.
const participant = z
  .object({
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(20).optional(),
    amountKobo: kobo.optional(),
    percent: z.number().positive().max(99).optional(),
  })
  .refine((p) => p.email || p.phone, { message: 'Enter an email or phone number' })

const schema = deliverySchema.extend({
  method: z.enum(['equal', 'custom', 'percent']),
  participants: z.array(participant).min(1, 'Add at least one person to split with').max(9),
})

export const POST = handle(async (request) => {
  const caller = await requireProfile(request, { roles: ['buyer'] })
  const body = await parseBody(request, schema)
  const quote = await quoteCheckout(caller, body)

  const invitees: { uid: string; name: string; contact: string; amountKobo?: number; percent?: number }[] = []
  const errors: Record<string, string> = {}
  for (const [i, p] of body.participants.entries()) {
    const phone = p.phone ? normalizePhone(p.phone) ?? undefined : undefined
    const found = await findBuyer({ email: p.email?.toLowerCase(), phone })
    if (!found) errors[`participants.${i}`] = `${p.email ?? p.phone} is not a Vorapicks buyer yet`
    else if (found.uid === caller.user.uid) errors[`participants.${i}`] = "You're already in the split"
    else if (invitees.some((x) => x.uid === found.uid)) errors[`participants.${i}`] = 'Added twice'
    else invitees.push({ ...found, contact: (p.email ?? p.phone)!, amountKobo: p.amountKobo, percent: p.percent })
  }
  if (Object.keys(errors).length) throw new ApiError('validation_failed', 'Some people could not be added', errors)

  const { id, doc } = await createSplit(caller, body.method, invitees, {
    drafts: quote.drafts,
    totalKobo: quote.totals.totalKobo,
    ctx: {
      buyer: { uid: caller.user.uid, name: caller.profile.name, phone: caller.profile.phone || caller.user.phone || '' },
      address: quote.address,
      deliverySlot: body.deliverySlot,
      note: body.note ?? null,
      promoCode: quote.promo.code,
    },
  })
  return ok(presentSplit(id, doc, caller.user.uid), 'Split created. Pay your share to continue.', 201)
})

export { methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
