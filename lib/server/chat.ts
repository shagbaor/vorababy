import 'server-only'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { toIso, type Caller } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'
import { notify } from '@/lib/server/notify'
import { useFile, privateFileUrl } from '@/lib/server/storage'

// Messages screen. Two kinds of conversation share one API:
// - Order chats (chats/{orderId}_{kind}, messages in a subcollection) between
//   the buyer, the seller and the rider of one order.
// - Support (conversations/support-{uid}), the shape the admin Support pages
//   read: messages embedded in the document, `unread` counts the user's
//   messages the admins have not read, `userUnread` the admins' replies the
//   user has not read.
// users/{uid}/inbox/summary holds { unread } for the Messages tab badge.

export type ChatKind = 'buyer_seller' | 'buyer_rider' | 'seller_rider'
type Role = 'buyer' | 'seller' | 'rider'
type Member = { name: string; role: Role; photoUrl: string | null }

export type ChatDoc = {
  kind: ChatKind
  orderId: string
  participantIds: string[]
  members: Record<string, Member>
  lastMessage: { text: string; senderId: string } | null
  lastMessageAt: Timestamp | null
  unread: Record<string, number>
  createdAt: Timestamp
}

type SupportMessage = { id: string; from: 'user' | 'admin'; text: string; time: string; at?: string; attachment?: { fileId: string } | null }

const SUPPORT_PREFIX = 'support-'
export const supportId = (uid: string) => `${SUPPORT_PREFIX}${uid}`
export const isSupport = (id: string) => id.startsWith(SUPPORT_PREFIX)

// "10:22 AM" in Lagos, as the admin pages show it.
export function clockTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(date)
}

const inbox = (uid: string) => db().collection('users').doc(uid).collection('inbox').doc('summary')

// Who is on each side of an order chat.
const SIDES: Record<ChatKind, [Role, Role]> = {
  buyer_seller: ['buyer', 'seller'],
  buyer_rider: ['buyer', 'rider'],
  seller_rider: ['seller', 'rider'],
}

function kindFor(me: Role, other: Role): ChatKind {
  const kind = (Object.keys(SIDES) as ChatKind[]).find((k) => SIDES[k].includes(me) && SIDES[k].includes(other) && me !== other)
  if (!kind) throw new ApiError('validation_failed', 'You cannot message this person about the order', { with: 'Choose seller, rider or buyer' })
  return kind
}

// Opens (or returns) the order chat between the caller and `withRole`.
export async function openOrderChat(caller: Caller, orderId: string, withRole: Role) {
  const role = caller.profile.role as Role
  const order = await db().collection('orders').doc(orderId).get()
  const o = order.data()
  const uidOf = { buyer: o?.buyerId as string | undefined, seller: o?.storeId as string | undefined, rider: (o?.riderId as string | null | undefined) ?? undefined }
  if (!o || uidOf[role] !== caller.user.uid) throw new ApiError('not_found', 'Order not found')
  const kind = kindFor(role, withRole)
  const otherUid = uidOf[withRole]
  if (!otherUid) throw new ApiError('conflict', 'No rider has been assigned to this order yet')

  const id = `${orderId}_${kind}`
  const ref = db().collection('chats').doc(id)
  const existing = await ref.get()
  if (existing.exists) return { id, doc: existing.data() as ChatDoc }

  const [users, store] = await Promise.all([
    db().getAll(db().collection('users').doc(caller.user.uid), db().collection('users').doc(otherUid)),
    db().collection('stores').doc(o.storeId).get(),
  ])
  const member = (uid: string, r: Role): Member => {
    const u = users.find((x) => x.id === uid)
    if (r === 'seller') return { name: (store.get('name') as string) ?? o.storeName, role: r, photoUrl: (store.get('logoUrl') as string) ?? null }
    return { name: (u?.get('name') as string) ?? (r === 'rider' ? o.riderName : o.buyerName), role: r, photoUrl: (u?.get('avatarUrl') as string) ?? null }
  }
  const doc: ChatDoc = {
    kind,
    orderId,
    participantIds: [caller.user.uid, otherUid],
    members: { [caller.user.uid]: member(caller.user.uid, role), [otherUid]: member(otherUid, withRole) },
    lastMessage: null,
    lastMessageAt: null,
    unread: { [caller.user.uid]: 0, [otherUid]: 0 },
    createdAt: Timestamp.now(),
  }
  // create() fails if the other side opened it at the same moment; read theirs.
  await ref.create(doc).catch(() => null)
  return { id, doc: ((await ref.get()).data() as ChatDoc) ?? doc }
}

// Opens (or returns) the caller's support thread.
export async function openSupport(caller: Caller, orderId?: string) {
  const ref = db().collection('conversations').doc(supportId(caller.user.uid))
  let order: FirebaseFirestore.DocumentSnapshot | null = null
  if (orderId) {
    order = await db().collection('orders').doc(orderId).get()
    const mine = order.exists && [order.get('buyerId'), order.get('storeId'), order.get('riderId')].includes(caller.user.uid)
    if (!mine) throw new ApiError('not_found', 'Order not found')
  }
  const about = order ? { orderId: order.id, orderAmount: (order.get('totalKobo') as number) / 100 } : {}
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    await ref.set({
      userId: caller.user.uid,
      orderId: '',
      orderAmount: 0,
      ...about,
      lastActive: clockTime(),
      unread: 0,
      userUnread: 0,
      closed: false,
      messages: [],
      rank: -Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } else if (order) {
    await ref.update(about)
  }
  return ref.id
}

export function presentChat(id: string, c: ChatDoc, viewer: string) {
  const other = c.participantIds.find((u) => u !== viewer) ?? viewer
  const counterpart = c.members[other]
  return {
    id,
    type: counterpart.role,
    orderId: c.orderId,
    orderNumber: c.orderId,
    counterpart: { uid: other, ...counterpart },
    lastMessage: c.lastMessage ? { text: c.lastMessage.text, mine: c.lastMessage.senderId === viewer } : null,
    lastMessageAt: toIso(c.lastMessageAt),
    unreadCount: c.unread?.[viewer] ?? 0,
    closed: false,
  }
}

export function presentSupport(id: string, s: FirebaseFirestore.DocumentData) {
  const messages = (s.messages ?? []) as SupportMessage[]
  const last = messages.at(-1)
  return {
    id,
    type: 'support' as const,
    orderId: s.orderId || null,
    orderNumber: s.orderId || null,
    counterpart: { uid: null, name: 'Vorapicks Support', role: 'support' as const, photoUrl: null },
    lastMessage: last ? { text: last.text, mine: last.from === 'user' } : null,
    lastMessageAt: last?.at ?? toIso(s.updatedAt),
    unreadCount: (s.userUnread as number | undefined) ?? 0,
    closed: Boolean(s.closed),
  }
}

// Loads a conversation the caller belongs to.
export async function loadConversation(uid: string, id: string) {
  if (isSupport(id)) {
    if (id !== supportId(uid)) throw new ApiError('not_found', 'Conversation not found')
    const snapshot = await db().collection('conversations').doc(id).get()
    if (!snapshot.exists) throw new ApiError('not_found', 'Conversation not found')
    return { support: true as const, ref: snapshot.ref, data: snapshot.data()! }
  }
  const snapshot = await db().collection('chats').doc(id).get()
  const chat = snapshot.data() as ChatDoc | undefined
  if (!chat || !chat.participantIds.includes(uid)) throw new ApiError('not_found', 'Conversation not found')
  return { support: false as const, ref: snapshot.ref, data: chat }
}

async function attachmentUrl(fileId: string | undefined | null) {
  return fileId ? privateFileUrl(fileId).catch(() => null) : null
}

// Newest first; `before` is the createdAt of the oldest message already shown.
export async function listMessages(uid: string, id: string, limit: number, before?: string) {
  const convo = await loadConversation(uid, id)
  if (convo.support) {
    const all = ((convo.data.messages ?? []) as SupportMessage[]).map((m, i) => ({ m, i }))
    const end = before ? Math.max(0, all.findIndex(({ m }) => m.id === before)) : all.length
    const slice = all.slice(Math.max(0, end - limit), end).reverse()
    const items = await Promise.all(
      slice.map(async ({ m }) => ({
        id: m.id,
        senderId: m.from === 'user' ? uid : null,
        senderRole: m.from === 'user' ? (null as string | null) : 'support',
        mine: m.from === 'user',
        text: m.text,
        attachmentUrl: await attachmentUrl(m.attachment?.fileId),
        createdAt: m.at ?? null,
        time: m.time,
      })),
    )
    return { items, nextCursor: end - limit > 0 ? slice.at(-1)!.m.id : null }
  }
  let query = convo.ref.collection('messages').orderBy('createdAt', 'desc').limit(limit + 1)
  if (before) {
    const anchor = await convo.ref.collection('messages').doc(before).get()
    if (anchor.exists) query = query.startAfter(anchor)
  }
  const snapshot = await query.get()
  const docs = snapshot.docs.slice(0, limit)
  const items = await Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      senderId: d.get('senderId') as string,
      senderRole: convo.data.members[d.get('senderId')]?.role ?? null,
      mine: d.get('senderId') === uid,
      text: d.get('text') as string,
      attachmentUrl: await attachmentUrl(d.get('attachmentFileId')),
      createdAt: toIso(d.get('createdAt')),
      time: clockTime((d.get('createdAt') as Timestamp).toDate()),
    })),
  )
  return { items, nextCursor: snapshot.docs.length > limit ? docs.at(-1)!.id : null }
}

// Sends a message. `clientId` makes retries safe: the same id is stored once.
export async function sendMessage(caller: Caller, id: string, input: { text?: string; attachmentFileId?: string; clientId: string }) {
  const uid = caller.user.uid
  const convo = await loadConversation(uid, id)
  const text = (input.text ?? '').trim()
  if (input.attachmentFileId) await useFile(uid, input.attachmentFileId, ['chat_attachment'])
  const messageId = `${uid.slice(0, 8)}-${input.clientId}`.replace(/[^\w-]/g, '').slice(0, 64)
  const preview = text || '📎 Attachment'

  if (convo.support) {
    const sent = await db().runTransaction(async (t) => {
      const s = (await t.get(convo.ref)).data()!
      const messages = (s.messages ?? []) as SupportMessage[]
      if (messages.some((m) => m.id === messageId)) return false
      const time = clockTime()
      const message: SupportMessage = { id: messageId, from: 'user', text: preview, time, at: new Date().toISOString(), attachment: input.attachmentFileId ? { fileId: input.attachmentFileId } : null }
      // Newest activity first in the admin list; a new message reopens a closed thread.
      t.update(convo.ref, { messages: [...messages.slice(-499), message], unread: FieldValue.increment(1), lastActive: time, closed: false, rank: -Date.now(), updatedAt: FieldValue.serverTimestamp() })
      return true
    })
    return { messageId, duplicate: !sent }
  }

  const chat = convo.data as ChatDoc
  const others = chat.participantIds.filter((u) => u !== uid)
  const messageRef = convo.ref.collection('messages').doc(messageId)
  const sent = await db().runTransaction(async (t) => {
    if ((await t.get(messageRef)).exists) return false
    t.create(messageRef, { senderId: uid, text, attachmentFileId: input.attachmentFileId ?? null, createdAt: FieldValue.serverTimestamp() })
    t.update(convo.ref, {
      lastMessage: { text: preview.slice(0, 200), senderId: uid },
      lastMessageAt: FieldValue.serverTimestamp(),
      ...Object.fromEntries(others.map((o) => [`unread.${o}`, FieldValue.increment(1)])),
    })
    for (const o of others) t.set(inbox(o), { unread: FieldValue.increment(1) }, { merge: true })
    return true
  })
  if (sent) {
    const name = chat.members[uid]?.name ?? caller.profile.name
    await Promise.all(others.map((o) => notify(o, 'message', name, preview.slice(0, 120), { conversationId: id, orderId: chat.orderId })))
  }
  return { messageId, duplicate: !sent }
}

export async function markRead(uid: string, id: string) {
  const convo = await loadConversation(uid, id)
  if (convo.support) {
    await db().runTransaction(async (t) => {
      const [s, summary] = await Promise.all([t.get(convo.ref), t.get(inbox(uid))])
      const count = (s.get('userUnread') as number | undefined) ?? 0
      if (count <= 0) return
      t.update(convo.ref, { userUnread: 0 })
      t.set(inbox(uid), { unread: Math.max(0, ((summary.get('unread') as number | undefined) ?? 0) - count) }, { merge: true })
    })
    return
  }
  await db().runTransaction(async (t) => {
    const chat = (await t.get(convo.ref)).data() as ChatDoc
    const count = chat.unread?.[uid] ?? 0
    if (count <= 0) return
    const summary = await t.get(inbox(uid))
    t.update(convo.ref, { [`unread.${uid}`]: 0 })
    t.set(inbox(uid), { unread: Math.max(0, ((summary.get('unread') as number | undefined) ?? 0) - count) }, { merge: true })
  })
}

// Called by the admin app after an admin replies in Support.
export async function supportReplied(conversationId: string, text: string) {
  if (!isSupport(conversationId)) return
  const ref = db().collection('conversations').doc(conversationId)
  const snapshot = await ref.get()
  const userId = snapshot.get('userId') as string | undefined
  if (!userId) return
  await ref.update({ userUnread: FieldValue.increment(1), rank: -Date.now() })
  await inbox(userId).set({ unread: FieldValue.increment(1) }, { merge: true })
  await notify(userId, 'message', 'Vorapicks Support', text.slice(0, 120), { conversationId })
}
