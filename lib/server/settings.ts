import 'server-only'
import { db } from '@/lib/firebase/admin'

// Business settings in Firestore meta/settings, with defaults until the owner
// decides (docs/mobile-api.md section 16). Money is in kobo.
export type Settings = {
  commissionRate: number
  serviceFeeKobo: number
  deliveryBaseFeeKobo: number
  deliveryFreeKm: number
  deliveryPerKmKobo: number
  riderShare: number
  maxDeliveryKm: number
  riderJobRadiusKm: number
  withdrawalFeeKobo: number
  minTopUpKobo: number
  minWithdrawalKobo: number
  autoReleaseHours: number
  splitExpiryHours: number
  supportEmail: string
}

export const DEFAULT_SETTINGS: Settings = {
  commissionRate: 0.1,
  serviceFeeKobo: 5_000,
  deliveryBaseFeeKobo: 50_000,
  deliveryFreeKm: 3,
  deliveryPerKmKobo: 10_000,
  riderShare: 0.8,
  maxDeliveryKm: 40,
  riderJobRadiusKm: 15,
  withdrawalFeeKobo: 5_000,
  minTopUpKobo: 10_000,
  minWithdrawalKobo: 50_000,
  autoReleaseHours: 48,
  splitExpiryHours: 24,
  supportEmail: 'support@vorapicks.com',
}

export async function getSettings(): Promise<Settings> {
  const snapshot = await db().collection('meta').doc('settings').get()
  return { ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<Settings> | undefined) }
}

export function deliveryFeeKobo(settings: Settings, distanceKm: number) {
  const extraKm = Math.max(0, Math.ceil(distanceKm - settings.deliveryFreeKm))
  return settings.deliveryBaseFeeKobo + extraKm * settings.deliveryPerKmKobo
}

export function riderPayKobo(settings: Settings, deliveryFee: number) {
  return Math.round(deliveryFee * settings.riderShare)
}
