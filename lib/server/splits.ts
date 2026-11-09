import 'server-only'
import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { toIso, type Caller } from '@/lib/api/guard'
import { adminAuth, db } from '@/lib/firebase/admin'
import type { OrderDraft } from '@/lib/server/cart'
import { notify } from '@/lib/server/notify'
import { notifyNewOrders, readForPlacement, writeOrders, type PlacementContext } from '@/lib/server/orders'
import { getSettings } from '@/lib/server/settings'
import { loadWallets } from '@/lib/server/wallet'

// Split the bill (splits/{id}). The organiser's cart is priced once; each
// participant pays their share (wallet, card or bank transfer). When every
// share is paid the orders are placed for the organiser. Declined shares move
// to the organiser. Cancelled or expired splits refund paid shares to wallets.

export type Participant = {
  uid: string
  name: string
  contact: string
  amountKobo: number
  paidKobo: number
  status: 'pending' | 'accepted' | 'declined' | 'paid'
  isOrganiser: boolean
}

export type SplitDoc = {
  organiserId: string
  organiserName: string
  method: 'equal' | 'custom' | 'percent'
  totalKobo: number
  paidKobo: number
  participants: Participant[]
  participantIds: string[]
  checkout: { drafts: OrderDraft[]; ctx: Omit<PlacementContext, 'paymentMethod' | 'paymentRef'> }
  status: 'collecting' | 'placed' | 'cancelled' | 'expired' | 'failed'
  orderIds: string[]
  expiresAt: Timestamp
  createdAt: Timestamp
}

const owed = (p: Participant) => Math.max(0, p.amountKobo - p.paidKobo)

export async function findBuyer(contact: { email?: string; phone?: string }) {
  let uid: string | null = null
  if (contact.email) uid = await adminAuth().getUserByEmail(contact.email).then((u) => u.uid, () => null)
  if (!uid && contact.phone) {
    const byPhone = await db().collection('users').where('phone', '==', contact.phone).limit(1).get()
    uid = byPhone.empty ? null : byPhone.docs[0].id
  }
  const profile = uid ? await db().collection('users').doc(uid).get() : null
  if (!profile?.exists || profile.get('role') !== 'buyer') return null
  return { uid: profile.id, name: profile.get('name') as string }
}

export function shares(method: SplitDoc['method'], total: number, others: { amountKobo?: number; percent?: number }[]) {
  const n = others.length + 1
  if (method === 'equal') {
    const each = Math.floor(total / n)
    return { organiser: total - each * others.length, others: others.map(() => each) }
  }
  const amounts = others.map((o) => (method === 'custom' ? (o.amountKobo ?? 0) : Math.round(((o.percent ?? 0) * total) / 100)))
  const organiser = total - amounts.reduce((a, b) => a + b, 0)
  if (amounts.some((a) => a <= 0) || organiser <= 0) {
    throw new ApiError('validation_failed', 'Shares must leave something for everyone, including you', { participants: 'Check the amounts' })
  }
  return { organiser, others: amounts }
}

export function presentSplit(id: string, s: SplitDoc, viewer: string) {
  const me = s.participants.find((p) => p.uid === viewer)
  return {
    id,
    status: s.status,
    method: s.method,
    organiser: { uid: s.organiserId, name: s.organiserName },
    isOrganiser: s.organiserId === viewer,
    totalKobo: s.totalKobo,
    paidKobo: s.paidKobo,
    joinedCount: s.participants.filter((p) => p.status !== 'pending' && p.status !== 'declined').length,
    participantCount: s.participants.length,
    myShare: me ? { amountKobo: me.amountKobo, paidKobo: me.paidKobo, owedKobo: owed(me), status: me.status } : null,
    participants: s.participants.map((p) => ({ uid: p.uid, name: p.name, isOrganiser: p.isOrganiser, amountKobo: p.amountKobo, paidKobo: p.paidKobo, status: p.status })),
    stores: s.checkout.drafts.map((d) => ({ id: d.storeId, name: d.storeName, itemCount: d.itemCount })),
    orderIds: s.orderIds,
    expiresAt: toIso(s.expiresAt),
    createdAt: toIso(s.createdAt),
  }
}

export async function createSplit(caller: Caller, method: SplitDoc['method'], invitees: { uid: string; name: string; contact: string; amountKobo?: number; percent?: number }[], quote: { drafts: OrderDraft[]; totalKobo: number; ctx: SplitDoc['checkout']['ctx'] }) {
  const split = shares(method, quote.totalKobo, invitees)
  const { splitExpiryHours } = await getSettings()
  const participants: Participant[] = [
    { uid: caller.user.uid, name: caller.profile.name, contact: caller.profile.email || caller.profile.phone, amountKobo: split.organiser, paidKobo: 0, status: 'accepted', isOrganiser: true },
    ...invitees.map((p, i) => ({ uid: p.uid, name: p.name, contact: p.contact, amountKobo: split.others[i], paidKobo: 0, status: 'pending' as const, isOrganiser: false })),
  ]
  const ref = db().collection('splits').doc()
  const doc: SplitDoc = {
    organiserId: caller.user.uid,
    organiserName: caller.profile.name,
    method,
    totalKobo: quote.totalKobo,
    paidKobo: 0,
    participants,
    participantIds: participants.map((p) => p.uid),
    checkout: { drafts: quote.drafts, ctx: quote.ctx },
    status: 'collecting',
    orderIds: [],
    expiresAt: Timestamp.fromMillis(Date.now() + splitExpiryHours * 3600_000),
    createdAt: Timestamp.now(),
  }
  await ref.set(doc)
  await Promise.all(
    invitees.map((p, i) =>
      notify(p.uid, 'split_invite', 'Split the bill', `${caller.profile.name} invited you to split an order. Your share: ₦${(split.others[i] / 100).toLocaleString()}.`, { splitId: ref.id }),
    ),
  )
  return { id: ref.id, doc }
}

// Records a payment towards `uid`'s share inside a transaction; places the
// orders when the split is fully paid. All reads happen before writes.
export async function applySplitPayment(t: Transaction, splitId: string, uid: string, amountKobo: number, reference: string | null, fromWallet: boolean) {
  const ref = db().collection('splits').doc(splitId)
  const snapshot = await t.get(ref)
  if (!snapshot.exists) throw new ApiError('not_found', 'Split not found')
  const s = snapshot.data() as SplitDoc
  const participant = s.participants.find((p) => p.uid === uid)
  if (!participant) throw new ApiError('not_found', 'Split not found')

  // Money arriving after the split closed goes to the payer's wallet.
  if (s.status !== 'collecting') {
    if (fromWallet) throw new ApiError('conflict', `This split is ${s.status}`)
    const wallets = await loadWallets(t, [uid])
    wallets.apply([{ uid, amountKobo, kind: 'refund', description: 'Split closed before your payment arrived', reference: reference ?? undefined }])
    return { orderIds: [] as string[], after: null }
  }

  const participants = s.participants.map((p) => (p.uid === uid ? { ...p, paidKobo: p.paidKobo + amountKobo, status: p.paidKobo + amountKobo >= p.amountKobo ? ('paid' as const) : p.status } : p))
  const paidKobo = s.paidKobo + amountKobo
  const complete = participants.every((p) => p.status === 'declined' ? p.amountKobo === 0 : p.paidKobo >= p.amountKobo)

  const prepared = complete ? await readForPlacement(t, s.checkout.drafts) : null
  const wallets = await loadWallets(t, [...participants.map((p) => p.uid)])
  if (fromWallet) wallets.apply([{ uid, amountKobo: -amountKobo, kind: 'split_share', description: `Your share of ${s.organiserName}'s split order` }])

  if (!complete) {
    t.update(ref, { participants, paidKobo })
    return { orderIds: [] as string[], after: () => notify(s.organiserId, 'split_update', 'Split update', `${participant.name} paid their share.`, { splitId }) }
  }
  if (prepared!.shortages.length) {
    wallets.apply(participants.filter((p) => p.paidKobo > 0).map((p) => ({ uid: p.uid, amountKobo: p.paidKobo, kind: 'refund' as const, description: `Split refund: ${prepared!.shortages.join(', ')} sold out` })))
    t.update(ref, { participants, paidKobo, status: 'failed', failureReason: 'sold_out' })
    return { orderIds: [] as string[], after: () => Promise.all(participants.map((p) => notify(p.uid, 'split_update', 'Split order not placed', `${prepared!.shortages.join(', ')} sold out. Your share is in your wallet.`, { splitId }))).then(() => undefined) }
  }
  const ids = writeOrders(t, prepared!, s.checkout.drafts, { ...s.checkout.ctx, paymentMethod: 'split', paymentRef: reference, splitId })
  t.update(ref, { participants, paidKobo, status: 'placed', orderIds: ids, placedAt: FieldValue.serverTimestamp() })
  return {
    orderIds: ids,
    after: async () => {
      await notifyNewOrders(ids)
      await Promise.all(participants.filter((p) => !p.isOrganiser).map((p) => notify(p.uid, 'split_update', 'Split order placed', `Everyone paid. ${s.organiserName}'s order is on its way.`, { splitId })))
    },
  }
}

// Called from finalizePayment for card / bank transfer shares.
export async function settleSplitShare(t: Transaction, payment: FirebaseFirestore.DocumentData, reference: string) {
  return applySplitPayment(t, payment.splitId, payment.uid, payment.amountKobo, reference, false)
}

export async function closeSplit(splitId: string, status: 'cancelled' | 'expired', reason: string) {
  const ref = db().collection('splits').doc(splitId)
  const s = await db().runTransaction(async (t) => {
    const snapshot = await t.get(ref)
    const split = snapshot.data() as SplitDoc | undefined
    if (!split || split.status !== 'collecting') throw new ApiError('conflict', 'This split is already closed')
    const wallets = await loadWallets(t, split.participants.map((p) => p.uid))
    wallets.apply(split.participants.filter((p) => p.paidKobo > 0).map((p) => ({ uid: p.uid, amountKobo: p.paidKobo, kind: 'refund' as const, description: `Split ${status}: share refunded` })))
    t.update(ref, { status, closedAt: FieldValue.serverTimestamp() })
    return split
  })
  await Promise.all(s.participants.map((p) => notify(p.uid, 'split_update', `Split ${status}`, `${reason}${p.paidKobo > 0 ? ` ₦${(p.paidKobo / 100).toLocaleString()} is back in your wallet.` : ''}`, { splitId })))
}

export async function declineShare(splitId: string, uid: string) {
  const ref = db().collection('splits').doc(splitId)
  const s = await db().runTransaction(async (t) => {
    const split = (await t.get(ref)).data() as SplitDoc | undefined
    const me = split?.participants.find((p) => p.uid === uid)
    if (!split || !me || me.isOrganiser) throw new ApiError('not_found', 'Split not found')
    if (split.status !== 'collecting') throw new ApiError('conflict', `This split is ${split.status}`)
    if (me.paidKobo > 0) throw new ApiError('conflict', 'You have already paid your share')
    const moved = me.amountKobo
    const participants = split.participants.map((p) =>
      p.uid === uid ? { ...p, amountKobo: 0, status: 'declined' as const } : p.isOrganiser ? { ...p, amountKobo: p.amountKobo + moved, status: 'accepted' as const } : p,
    )
    t.update(ref, { participants })
    return { split, moved, name: me.name }
  })
  await notify(s.split.organiserId, 'split_update', 'Split declined', `${s.name} declined. Their ₦${(s.moved / 100).toLocaleString()} share moved to you.`, { splitId })
}
