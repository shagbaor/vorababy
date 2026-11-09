import 'server-only'
import { ApiError } from '@/lib/api/response'
import { db } from '@/lib/firebase/admin'

// Loads an order the caller is part of (as buyer, seller or rider), or 404.
export async function orderFor(uid: string, orderId: string, as: 'buyer' | 'seller' | 'rider') {
  const snapshot = await db().collection('orders').doc(orderId).get()
  const field = as === 'buyer' ? 'buyerId' : as === 'seller' ? 'storeId' : 'riderId'
  if (!snapshot.exists || snapshot.get(field) !== uid) throw new ApiError('not_found', 'Order not found')
  return snapshot
}
