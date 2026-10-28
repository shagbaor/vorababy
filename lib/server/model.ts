import type { GeoPoint, Timestamp } from 'firebase-admin/firestore'

// Firestore document shapes. Field names here are the contract with the
// Flutter app (see docs/backend/README.md).

export type Role = 'buyer' | 'seller' | 'rider' | 'admin'
export type AccountStatus = 'active' | 'suspended' | 'banned'

// Sellers and riders must be approved by an admin before they can trade.
// Buyers and admins never need it.
export type VerificationStatus = 'not_required' | 'incomplete' | 'pending' | 'approved'

export type UserDoc = {
  role: Role
  fullName: string
  email: string | null
  phone: string | null
  photoUrl: string | null
  status: AccountStatus
  verified: boolean
  verificationStatus: VerificationStatus
  storeId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type StoreType = 'farm' | 'restaurant' | 'vendor'

export type StoreDoc = {
  ownerId: string
  name: string
  type: StoreType
  description: string | null
  phone: string | null
  logoUrl: string | null
  coverUrl: string | null
  address: { line: string; area: string | null; city: string; state: string | null }
  location: GeoPoint
  isOpen: boolean
  openingHours: Record<string, { open: string; close: string } | null> | null
  verificationStatus: Exclude<VerificationStatus, 'not_required' | 'incomplete'>
  rating: number | null
  ratingCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type VehicleType = 'motorbike' | 'bicycle' | 'car' | 'van'

export type RiderDoc = {
  userId: string
  vehicleType: VehicleType
  plateNumber: string | null
  verificationStatus: Exclude<VerificationStatus, 'not_required' | 'incomplete'>
  isOnline: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type AuditEntry = {
  adminId: string
  adminEmail: string | null
  action: string
  targetId: string
  details: Record<string, unknown>
  createdAt: Timestamp
}

// Timestamps and GeoPoints don't survive JSON, so API responses and server
// components convert them to ISO strings and plain {lat, lng}.
export function toJson<T>(value: T): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as unknown as Timestamp).toDate().toISOString()
  }
  if ('latitude' in value && 'longitude' in value && Object.keys(value).length <= 2) {
    const point = value as unknown as GeoPoint
    return { lat: point.latitude, lng: point.longitude }
  }
  if (Array.isArray(value)) return value.map(toJson)
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, toJson(inner)]))
}
