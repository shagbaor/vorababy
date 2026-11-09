import { z } from 'zod'
import { parse, requireProfile } from '@/lib/api/guard'
import { ApiError, handle, methodNotAllowed, ok, readJson } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { notify } from '@/lib/server/notify'
import { paystackEmail, startPayment } from '@/lib/server/payments'
import { applySplitPayment, closeSplit, declineShare, presentSplit, type SplitDoc } from '@/lib/server/splits'

export const dynamic = 'force-dynamic'

// accept | decline (invitees) · pay (anyone with a share owing) · cancel (organiser)
export const POST = handle<{ params: Promise<{ id: string; action: string }> }>(async (request, { params }) => {
  const { user, profile } = await requireProfile(request, { roles: ['buyer'] })
  const { id, action } = await params
  const ref = db().collection('splits').doc(id)
  const split = (await ref.get()).data() as SplitDoc | undefined
  const me = split?.participants.find((p) => p.uid === user.uid)
  if (!split || !me) throw new ApiError('not_found', 'Split not found')
  const fresh = async () => presentSplit(id, (await ref.get()).data() as SplitDoc, user.uid)

  if (action === 'accept') {
    if (split.status !== 'collecting') throw new ApiError('conflict', `This split is ${split.status}`)
    if (me.status === 'pending') {
      await ref.update({ participants: split.participants.map((p) => (p.uid === user.uid ? { ...p, status: 'accepted' } : p)) })
      await notify(split.organiserId, 'split_update', 'Split accepted', `${profile.name} joined your split.`, { splitId: id })
    }
    return ok(await fresh(), 'You joined the split. Pay your share to continue.')
  }

  if (action === 'decline') {
    await declineShare(id, user.uid)
    return ok(await fresh(), 'You declined the split')
  }

  if (action === 'cancel') {
    if (split.organiserId !== user.uid) throw new ApiError('forbidden', 'Only the organiser can cancel the split')
    await closeSplit(id, 'cancelled', `${profile.name} cancelled the split.`)
    return ok(await fresh(), 'Split cancelled. Paid shares were refunded to wallets.')
  }

  if (action === 'pay') {
    const body = parse(z.object({ paymentMethod: z.enum(['wallet', 'card', 'bank_transfer']), savedCardId: z.string().max(200).optional() }), await readJson(request))
    if (split.status !== 'collecting') throw new ApiError('conflict', `This split is ${split.status}`)
    const owedKobo = me.amountKobo - me.paidKobo
    if (owedKobo <= 0) throw new ApiError('conflict', 'Your share is already paid')

    if (body.paymentMethod === 'wallet') {
      let after: (() => Promise<unknown>) | null = null
      const result = await db().runTransaction(async (t) => {
        const out = await applySplitPayment(t, id, user.uid, owedKobo, null, true)
        after = out.after
        return out
      })
      if (after) await (after as () => Promise<unknown>)()
      return ok({ status: 'success', orderIds: result.orderIds, split: await fresh() }, result.orderIds.length ? 'Everyone has paid. Order placed!' : 'Your share is paid')
    }
    const payment = await startPayment({
      uid: user.uid,
      email: paystackEmail(user.uid, profile.email || user.email),
      purpose: 'split_share',
      amountKobo: owedKobo,
      method: body.paymentMethod,
      savedCardId: body.savedCardId,
      splitId: id,
    })
    return ok(payment, 'Complete the payment')
  }

  throw new ApiError('not_found', 'No such endpoint')
})

export { methodNotAllowed as GET, methodNotAllowed as PUT, methodNotAllowed as PATCH, methodNotAllowed as DELETE }
