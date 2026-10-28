// Loads the starting platform data: shop categories and the fee settings.
// Safe to run more than once; it only fills in what's missing.
//
//   pnpm seed

import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/server/firebase-admin'

const categories = [
  { id: 'vegetables', name: 'Vegetables', sortOrder: 1 },
  { id: 'fruits', name: 'Fruits', sortOrder: 2 },
  { id: 'grains', name: 'Grains & Cereals', sortOrder: 3 },
  { id: 'tubers', name: 'Tubers', sortOrder: 4 },
  { id: 'meat-fish', name: 'Meat & Fish', sortOrder: 5 },
  { id: 'dairy-eggs', name: 'Dairy & Eggs', sortOrder: 6 },
  { id: 'spices', name: 'Spices & Herbs', sortOrder: 7 },
  { id: 'meals', name: 'Restaurant Meals', sortOrder: 8 },
]

// Placeholders until the business rules are decided. Money is in kobo.
const platformConfig = {
  commissionRate: 0.1,
  serviceFeeKobo: 0,
  deliveryBaseFeeKobo: 50_000,
  deliveryFeePerKmKobo: 10_000,
  escrowAutoReleaseHours: 24,
  riderOfferTimeoutSeconds: 60,
}

// The part of the config the app is allowed to read.
const publicConfig = {
  serviceFeeKobo: platformConfig.serviceFeeKobo,
  deliveryBaseFeeKobo: platformConfig.deliveryBaseFeeKobo,
  deliveryFeePerKmKobo: platformConfig.deliveryFeePerKmKobo,
  supportPhone: null,
  minimumAppVersion: '1.0.0',
}

async function main() {
  const db = adminDb()
  const batch = db.batch()
  const now = FieldValue.serverTimestamp()
  const added: string[] = []

  for (const { id, ...category } of categories) {
    const ref = db.doc(`categories/${id}`)
    if (!(await ref.get()).exists) {
      batch.set(ref, { ...category, icon: null, createdAt: now })
      added.push(`categories/${id}`)
    }
  }
  for (const [id, data] of [['platform', platformConfig], ['public', publicConfig]] as const) {
    const ref = db.doc(`config/${id}`)
    if (!(await ref.get()).exists) {
      batch.set(ref, { ...data, updatedAt: now })
      added.push(`config/${id}`)
    }
  }

  await batch.commit()
  console.log(added.length ? `Added ${added.length} documents: ${added.join(', ')}` : 'Nothing to add; everything is already there.')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
