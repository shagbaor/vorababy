import 'server-only'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { ApiError } from '@/lib/api/response'
import { toIso, type Caller } from '@/lib/api/guard'
import { db } from '@/lib/firebase/admin'
import type { Address } from '@/lib/server/addresses'
import { visibleStores } from '@/lib/server/catalog'
import { distanceKm, type LatLng } from '@/lib/server/geo'
import { notify } from '@/lib/server/notify'
import { getSettings } from '@/lib/server/settings'

// Personal shopping: a buyer describes what they need; nearby sellers answer
// with suggestions (offers/{sellerId}); the buyer accepts one seller's
// suggestions and they go into the cart. Suggestions that are not already in
// the seller's catalogue become products with status "custom" that only that
// buyer can buy (never shown in the catalogue).

export type Suggestion = { id: string; name: string; priceKobo: number; unit: string; note: string | null; productId: string | null; photoUrl: string | null }

export type RequestDoc = {
  buyerId: string
  buyerName: string
  description: string
  budgetKobo: number | null
  neededBy: Timestamp
  address: Omit<Address, 'isDefault'> & { label?: string | null }
  sellerIds: string[]
  status: 'open' | 'suggestions_received' | 'accepted' | 'closed'
  offersSent: number
  acceptedSellerId: string | null
  createdAt: Timestamp
}

export type OfferDoc = {
  storeId: string
  storeName: string
  storeLogoUrl: string | null
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  suggestions: Suggestion[]
  sentAt: Timestamp | null
  updatedAt: Timestamp
}

const MAX_SELLERS = 30
const requests = () => db().collection('shoppingRequests')

export async function createRequest(caller: Caller, input: { description: string; budgetKobo?: number; neededBy: Date; address: RequestDoc['address'] }) {
  if (input.neededBy.getTime() < Date.now() + 30 * 60_000) {
    throw new ApiError('validation_failed', 'Choose a time at least 30 minutes from now', { neededBy: 'Choose a later time' })
  }
  const { maxDeliveryKm } = await getSettings()
  const to = input.address.location as LatLng
  const nearby = [...(await visibleStores()).values()]
    .filter((s) => s.location && s.id !== caller.user.uid)
    .map((s) => ({ id: s.id, km: distanceKm(to, s.location) }))
    .filter((s) => s.km <= maxDeliveryKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, MAX_SELLERS)
  if (!nearby.length) throw new ApiError('conflict', 'No sellers deliver to this address yet')

  const ref = requests().doc()
  const doc: RequestDoc = {
    buyerId: caller.user.uid,
    buyerName: caller.profile.name,
    description: input.description,
    budgetKobo: input.budgetKobo ?? null,
    neededBy: Timestamp.fromDate(input.neededBy),
    address: input.address,
    sellerIds: nearby.map((s) => s.id),
    status: 'open',
    offersSent: 0,
    acceptedSellerId: null,
    createdAt: Timestamp.now(),
  }
  await ref.set(doc)
  await Promise.all(
    doc.sellerIds.map((uid) => notify(uid, 'shopping_request', 'New shopping request', `${caller.profile.name}: ${input.description.slice(0, 100)}`, { requestId: ref.id })),
  )
  return { id: ref.id, doc }
}

const presentSuggestion = (s: Suggestion) => ({ id: s.id, name: s.name, priceKobo: s.priceKobo, unit: s.unit, note: s.note, productId: s.productId, photoUrl: s.photoUrl })

export function presentOffer(o: OfferDoc) {
  return {
    seller: { id: o.storeId, name: o.storeName, logoUrl: o.storeLogoUrl },
    status: o.status,
    suggestions: o.suggestions.map(presentSuggestion),
    totalKobo: o.suggestions.reduce((sum, s) => sum + s.priceKobo, 0),
    sentAt: toIso(o.sentAt),
  }
}

const isPast = (r: RequestDoc) => r.neededBy.toMillis() < Date.now()

export function presentRequest(id: string, r: RequestDoc, offers?: OfferDoc[]) {
  // Open requests whose time has passed read as closed even before the cron closes them.
  const status = (r.status === 'open' || r.status === 'suggestions_received') && isPast(r) ? 'closed' : r.status
  return {
    id,
    description: r.description,
    budgetKobo: r.budgetKobo,
    neededBy: toIso(r.neededBy),
    address: r.address,
    status,
    offersCount: r.offersSent,
    acceptedSellerId: r.acceptedSellerId,
    createdAt: toIso(r.createdAt),
    ...(offers ? { offers: offers.filter((o) => o.status !== 'draft').map(presentOffer) } : {}),
  }
}

export async function loadBuyerRequest(uid: string, id: string) {
  const snapshot = await requests().doc(id).get()
  const r = snapshot.data() as RequestDoc | undefined
  if (!r || r.buyerId !== uid) throw new ApiError('not_found', 'Request not found')
  const offers = await snapshot.ref.collection('offers').get()
  return { ref: snapshot.ref, r, offers: offers.docs.map((d) => d.data() as OfferDoc) }
}

// Seller side ---------------------------------------------------------------

export function sellerStatus(r: RequestDoc, offer: OfferDoc | null): 'pending' | 'sent' | 'approved' | 'not_selected' | 'closed' {
  if (offer?.status === 'accepted') return 'approved'
  if (offer?.status === 'declined' || (r.status === 'accepted' && r.acceptedSellerId)) return 'not_selected'
  if (offer?.status === 'sent') return 'sent'
  if (r.status === 'closed' || isPast(r)) return 'closed'
  return 'pending'
}

export function presentSellerRequest(id: string, r: RequestDoc, offer: OfferDoc | null) {
  return {
    id,
    buyer: { name: r.buyerName },
    description: r.description,
    budgetKobo: r.budgetKobo,
    neededBy: toIso(r.neededBy),
    area: r.address.area ?? r.address.city ?? null,
    status: sellerStatus(r, offer),
    suggestions: (offer?.suggestions ?? []).map(presentSuggestion),
    totalKobo: (offer?.suggestions ?? []).reduce((sum, s) => sum + s.priceKobo, 0),
    sentAt: toIso(offer?.sentAt),
    createdAt: toIso(r.createdAt),
  }
}

export async function loadSellerRequest(uid: string, id: string) {
  const ref = requests().doc(id)
  const [snapshot, offer] = await Promise.all([ref.get(), ref.collection('offers').doc(uid).get()])
  const r = snapshot.data() as RequestDoc | undefined
  if (!r || !r.sellerIds.includes(uid)) throw new ApiError('not_found', 'Request not found')
  return { ref, r, offerRef: offer.ref, offer: offer.exists ? (offer.data() as OfferDoc) : null }
}

function requireEditable(r: RequestDoc, offer: OfferDoc | null) {
  if (r.status === 'accepted' || r.status === 'closed' || isPast(r)) throw new ApiError('conflict', 'This request is closed')
  if (offer && offer.status !== 'draft') throw new ApiError('conflict', 'You already sent your suggestions')
}

export async function addSuggestion(caller: Caller, id: string, input: { name: string; priceKobo: number; unit: string; note?: string; productId?: string }) {
  const uid = caller.user.uid
  const { r, offerRef, offer } = await loadSellerRequest(uid, id)
  requireEditable(r, offer)
  if ((offer?.suggestions.length ?? 0) >= 30) throw new ApiError('conflict', 'You can suggest up to 30 items')
  let photoUrl: string | null = null
  if (input.productId) {
    const product = await db().collection('products').doc(input.productId).get()
    if (!product.exists || product.get('storeId') !== uid || product.get('status') !== 'published') {
      throw new ApiError('validation_failed', 'Product not found', { productId: 'Choose one of your published products' })
    }
    photoUrl = (product.get('photos') as { url: string }[] | undefined)?.[0]?.url ?? null
  }
  const suggestion: Suggestion = { id: randomUUID().slice(0, 8), name: input.name, priceKobo: input.priceKobo, unit: input.unit, note: input.note ?? null, productId: input.productId ?? null, photoUrl }
  const store = offer ? null : await db().collection('stores').doc(uid).get()
  await offerRef.set(
    offer
      ? { suggestions: FieldValue.arrayUnion(suggestion), updatedAt: Timestamp.now() }
      : {
          storeId: uid,
          storeName: (store?.get('name') as string) ?? caller.profile.name,
          storeLogoUrl: (store?.get('logoUrl') as string) ?? null,
          status: 'draft',
          suggestions: [suggestion],
          sentAt: null,
          updatedAt: Timestamp.now(),
        },
    { merge: true },
  )
  return suggestion
}

export async function removeSuggestion(uid: string, id: string, suggestionId: string) {
  const { r, offerRef, offer } = await loadSellerRequest(uid, id)
  requireEditable(r, offer)
  const left = (offer?.suggestions ?? []).filter((s) => s.id !== suggestionId)
  if (!offer || left.length === offer.suggestions.length) throw new ApiError('not_found', 'Suggestion not found')
  await offerRef.update({ suggestions: left, updatedAt: Timestamp.now() })
}

export async function sendOffer(uid: string, id: string) {
  const { ref, r, offerRef, offer } = await loadSellerRequest(uid, id)
  requireEditable(r, offer)
  if (!offer?.suggestions.length) throw new ApiError('validation_failed', 'Add at least one suggestion first', { suggestions: 'Add a suggestion' })
  await db().runTransaction(async (t) => {
    const current = (await t.get(ref)).data() as RequestDoc
    if (current.status === 'accepted' || current.status === 'closed') throw new ApiError('conflict', 'This request is closed')
    t.update(offerRef, { status: 'sent', sentAt: FieldValue.serverTimestamp() })
    t.update(ref, { status: 'suggestions_received', offersSent: FieldValue.increment(1) })
  })
  await notify(r.buyerId, 'shopping_suggestions', 'New suggestions', `${offer.storeName} sent ${offer.suggestions.length} suggestion${offer.suggestions.length === 1 ? '' : 's'} for your shopping request.`, { requestId: id })
}

// Buyer accepts some of one seller's suggestions: they go into the cart.
export async function acceptOffer(caller: Caller, id: string, sellerId: string, picks: { suggestionId: string; quantity: number }[]) {
  const uid = caller.user.uid
  const { ref, r } = await loadBuyerRequest(uid, id)
  if (r.status === 'accepted') throw new ApiError('conflict', 'You already accepted suggestions for this request')
  if (r.status === 'closed') throw new ApiError('conflict', 'This request is closed')
  const offerRef = ref.collection('offers').doc(sellerId)

  const cartItems = await db().runTransaction(async (t) => {
    const [request, offerSnap, others] = await Promise.all([t.get(ref), t.get(offerRef), t.get(ref.collection('offers').where('status', '==', 'sent'))])
    const offer = offerSnap.data() as OfferDoc | undefined
    if ((request.get('status') as string) === 'accepted') throw new ApiError('conflict', 'You already accepted suggestions for this request')
    if (!offer || offer.status !== 'sent') throw new ApiError('not_found', 'This seller has not sent suggestions')
    const chosen = picks.map((p) => {
      const s = offer.suggestions.find((x) => x.id === p.suggestionId)
      if (!s) throw new ApiError('validation_failed', 'Suggestion not found', { suggestionIds: `Unknown suggestion ${p.suggestionId}` })
      return { s, quantity: p.quantity }
    })
    const items: Record<string, number> = {}
    for (const { s, quantity } of chosen) {
      if (s.productId) {
        items[s.productId] = (items[s.productId] ?? 0) + quantity
        continue
      }
      // A one-off product only this buyer can buy.
      const product = db().collection('products').doc()
      t.create(product, {
        storeId: sellerId,
        name: s.name,
        description: s.note ?? '',
        priceKobo: s.priceKobo,
        unit: s.unit,
        photos: [],
        stock: 99,
        status: 'custom',
        customForBuyerId: uid,
        shoppingRequestId: id,
        categoryId: null,
        soldCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      items[product.id] = quantity
    }
    t.update(offerRef, { status: 'accepted' })
    for (const o of others.docs) if (o.id !== sellerId) t.update(o.ref, { status: 'declined' })
    t.update(ref, { status: 'accepted', acceptedSellerId: sellerId, acceptedAt: FieldValue.serverTimestamp() })
    t.set(db().collection('carts').doc(uid), { items, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return { items, otherSellers: others.docs.map((o) => o.id).filter((s) => s !== sellerId) }
  })
  await notify(sellerId, 'shopping_request', 'Suggestions accepted', `${caller.profile.name} accepted your suggestions. The order arrives once they check out.`, { requestId: id })
  await Promise.all(cartItems.otherSellers.map((s) => notify(s, 'shopping_request', 'Request closed', `${caller.profile.name} chose another seller for their shopping request.`, { requestId: id })))
  return cartItems.items
}

export async function closeRequest(uid: string, id: string) {
  const { ref, r } = await loadBuyerRequest(uid, id)
  if (r.status === 'accepted' || r.status === 'closed') throw new ApiError('conflict', `This request is already ${r.status}`)
  await ref.update({ status: 'closed', closedAt: FieldValue.serverTimestamp() })
}
