import 'server-only'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'
import { distanceKm, travelMinutes, type LatLng } from '@/lib/server/geo'
import { notify } from '@/lib/server/notify'
import { getSettings } from '@/lib/server/settings'

// Dispatch: when a seller marks an order ready, online riders nearby are
// offered the job; the first to accept gets it. riders/{uid} holds isOnline,
// location and activeOrderId (one delivery at a time).

export async function onlineRidersNear(point: LatLng, radiusKm: number) {
  const snapshot = await db().collection('riders').where('isOnline', '==', true).get()
  return snapshot.docs.filter((r) => r.get('verificationStatus') === 'approved' && !r.get('activeOrderId') && r.get('location') && distanceKm(r.get('location'), point) <= radiusKm)
}

export async function offerJob(orderId: string) {
  const order = await db().collection('orders').doc(orderId).get()
  if (!order.exists || order.get('riderId')) return
  const { riderJobRadiusKm } = await getSettings()
  const riders = await onlineRidersNear(order.get('storeLocation'), riderJobRadiusKm)
  await order.ref.update({ offeredAt: FieldValue.serverTimestamp(), offeredTo: riders.map((r) => r.id) })
  const pay = (order.get('riderPayKobo') + (order.get('riderBonusKobo') ?? 0)) / 100
  await Promise.all(
    riders.map((r) =>
      notify(r.id, 'job_offer', 'New delivery job', `${order.get('storeName')} → ${order.get('address')?.area ?? order.get('address')?.city}. Earn ₦${pay.toLocaleString()}.`, { orderId }),
    ),
  )
}

export async function availableJobs(riderUid: string) {
  const [rider, settings] = await Promise.all([db().collection('riders').doc(riderUid).get(), getSettings()])
  const location = rider.get('location') as LatLng | undefined
  const snapshot = await db().collection('orders').where('riderId', '==', null).get()
  return snapshot.docs
    .filter((o) => o.get('status') === 'ready_for_pickup' && !((o.get('declinedBy') as string[] | undefined) ?? []).includes(riderUid))
    .map((o) => ({ doc: o, toStoreKm: location ? distanceKm(location, o.get('storeLocation')) : null }))
    .filter((j) => j.toStoreKm === null || j.toStoreKm <= settings.riderJobRadiusKm)
    .sort((a, b) => (a.toStoreKm ?? 0) - (b.toStoreKm ?? 0))
}

export function presentJob(o: FirebaseFirestore.DocumentSnapshot, toStoreKm: number | null) {
  const address = o.get('address') ?? {}
  return {
    orderId: o.id,
    orderNumber: o.get('orderNumber') ?? o.id,
    pickup: { storeName: o.get('storeName'), address: o.get('storeAddress'), location: o.get('storeLocation') },
    dropOff: { buyerName: String(o.get('buyerName') ?? '').split(' ')[0], area: [address.area, address.city].filter(Boolean).join(', '), location: address.location },
    distanceKm: o.get('distanceKm'),
    toPickupKm: toStoreKm,
    itemCount: o.get('itemCount'),
    payKobo: o.get('riderPayKobo'),
    bonusKobo: o.get('riderBonusKobo') ?? 0,
    paymentProtected: o.get('escrowStatus') === 'held',
  }
}

export async function acceptJob(riderUid: string, orderId: string) {
  const orderRef = db().collection('orders').doc(orderId)
  const riderRef = db().collection('riders').doc(riderUid)
  const userRef = db().collection('users').doc(riderUid)
  const order = await db().runTransaction(async (tx) => {
    const [o, r, u] = await Promise.all([tx.get(orderRef), tx.get(riderRef), tx.get(userRef)])
    if (!o.exists || o.get('status') !== 'ready_for_pickup') throw new ApiError('not_found', 'This job is no longer available')
    if (o.get('riderId')) throw new ApiError('conflict', 'Another rider has already taken this job')
    if (r.get('activeOrderId')) throw new ApiError('conflict', 'Finish your current delivery first')
    if (!r.get('isOnline')) throw new ApiError('conflict', 'Go online to accept jobs')
    const vehicle = r.get('vehicle') ?? {}
    tx.update(orderRef, {
      riderId: riderUid,
      riderName: u.get('name'),
      riderPhone: u.get('phone') || null,
      riderVehicle: { type: vehicle.type ?? null, plateNumber: vehicle.plateNumber ?? null, color: vehicle.color ?? null, makeModel: vehicle.makeModel ?? null },
      assignedAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(riderRef, { activeOrderId: orderId })
    return o.data()!
  })
  await notify(order.buyerId, 'order_status', 'Rider assigned', `A rider is heading to ${order.storeName} for ${orderId}.`, { orderId })
  await notify(order.storeId, 'order_status', 'Rider assigned', `A rider is on the way to collect ${orderId}.`, { orderId })
}

export async function declineJob(riderUid: string, orderId: string) {
  await db().collection('orders').doc(orderId).update({ declinedBy: FieldValue.arrayUnion(riderUid) })
}

// Rider position, every few seconds while online. Updates the buyer's
// tracking map on the active order.
export async function updateLocation(riderUid: string, point: LatLng & { heading?: number; speed?: number }) {
  const riderRef = db().collection('riders').doc(riderUid)
  const rider = await riderRef.get()
  const location = { lat: point.lat, lng: point.lng }
  await riderRef.update({ location, heading: point.heading ?? null, speed: point.speed ?? null, locationAt: FieldValue.serverTimestamp() })

  const activeOrderId = rider.get('activeOrderId') as string | null
  if (!activeOrderId) return null
  const order = await db().collection('orders').doc(activeOrderId).get()
  if (!order.exists) return null
  const headingToBuyer = order.get('status') === 'out_for_delivery'
  const target = headingToBuyer ? order.get('address').location : order.get('storeLocation')
  const km = distanceKm(location, target)
  const tracking = {
    riderLocation: location,
    heading: point.heading ?? null,
    target: headingToBuyer ? 'buyer' : 'store',
    distanceKm: km,
    etaMinutes: travelMinutes(km),
    updatedAt: Timestamp.now(),
  }
  await order.ref.update({ tracking })
  return { orderId: activeOrderId, ...tracking, updatedAt: tracking.updatedAt.toDate().toISOString() }
}
