import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, GeoPoint, collection, query, where, getDocs } from 'firebase/firestore'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vorapicks',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Seed with rules disabled, the way the server API writes.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/buyer1'), { role: 'buyer', fullName: 'Amaka Osei', photoUrl: null, status: 'active', verified: false, updatedAt: new Date() })
    await setDoc(doc(db, 'users/seller1'), { role: 'seller', fullName: 'Green Valley Farm', photoUrl: null, status: 'active', verified: false, updatedAt: new Date() })
    await setDoc(doc(db, 'stores/approved'), { ownerId: 'seller1', name: 'Green Valley Farm', verificationStatus: 'approved', isOpen: true, description: null, updatedAt: new Date() })
    await setDoc(doc(db, 'stores/pending'), { ownerId: 'seller1', name: 'New Farm', verificationStatus: 'pending', isOpen: false, description: null, updatedAt: new Date() })
    await setDoc(doc(db, 'riders/rider1'), { verificationStatus: 'approved', isOnline: false, vehicleType: 'motorbike', updatedAt: new Date() })
    await setDoc(doc(db, 'riders/rider2'), { verificationStatus: 'pending', isOnline: false, vehicleType: 'motorbike', updatedAt: new Date() })
    await setDoc(doc(db, 'categories/vegetables'), { name: 'Vegetables' })
    await setDoc(doc(db, 'config/public'), { serviceFee: 0 })
    await setDoc(doc(db, 'config/platform'), { commissionRate: 0.1 })
    await setDoc(doc(db, 'auditLog/a1'), { action: 'verify' })
  })
})

const as = (uid: string, role: string) => env.authenticatedContext(uid, { role }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

describe('users', () => {
  it('lets people read their own profile only', async () => {
    await assertSucceeds(getDoc(doc(as('buyer1', 'buyer'), 'users/buyer1')))
    await assertFails(getDoc(doc(as('buyer1', 'buyer'), 'users/seller1')))
    await assertFails(getDoc(doc(anon(), 'users/buyer1')))
  })

  it('lets admins read any profile', async () => {
    await assertSucceeds(getDoc(doc(as('admin1', 'admin'), 'users/buyer1')))
  })

  it('allows editing name and photo', async () => {
    await assertSucceeds(updateDoc(doc(as('buyer1', 'buyer'), 'users/buyer1'), { fullName: 'Amaka O.', updatedAt: serverTimestamp() }))
  })

  it('blocks changing role, status or verification from the app', async () => {
    const db = as('buyer1', 'buyer')
    await assertFails(updateDoc(doc(db, 'users/buyer1'), { role: 'admin', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'users/buyer1'), { status: 'active', verified: true, updatedAt: serverTimestamp() }))
  })

  it('rejects a blank name and a missing server timestamp', async () => {
    const db = as('buyer1', 'buyer')
    await assertFails(updateDoc(doc(db, 'users/buyer1'), { fullName: '', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'users/buyer1'), { fullName: 'Amaka', updatedAt: new Date(0) }))
  })

  it('never lets the app create or delete a profile', async () => {
    await assertFails(setDoc(doc(as('new1', 'buyer'), 'users/new1'), { role: 'buyer', fullName: 'New', updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(as('buyer1', 'buyer'), 'users/buyer1')))
  })
})

describe('addresses and devices', () => {
  const address = () => ({
    label: 'Home',
    line: '12 Admiralty Way',
    area: 'Lekki Phase 1',
    city: 'Lagos',
    location: new GeoPoint(6.4474, 3.4722),
    isDefault: true,
    updatedAt: serverTimestamp(),
  })

  it('lets people manage their own addresses', async () => {
    const db = as('buyer1', 'buyer')
    await assertSucceeds(setDoc(doc(db, 'users/buyer1/addresses/home'), address()))
    await assertSucceeds(getDoc(doc(db, 'users/buyer1/addresses/home')))
    await assertSucceeds(deleteDoc(doc(db, 'users/buyer1/addresses/home')))
  })

  it("blocks other people's addresses and malformed ones", async () => {
    await assertFails(setDoc(doc(as('seller1', 'seller'), 'users/buyer1/addresses/home'), address()))
    await assertFails(setDoc(doc(as('buyer1', 'buyer'), 'users/buyer1/addresses/home'), { ...address(), location: 'Lekki' }))
    await assertFails(setDoc(doc(as('buyer1', 'buyer'), 'users/buyer1/addresses/home'), { ...address(), hacked: true }))
  })

  it('lets people register their own push device', async () => {
    const db = as('buyer1', 'buyer')
    await assertSucceeds(setDoc(doc(db, 'users/buyer1/devices/phone'), { token: 'fcm-token-abcdef', platform: 'android', updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, 'users/buyer1/devices/phone'), { token: 'fcm-token-abcdef', platform: 'blackberry', updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(as('seller1', 'seller'), 'users/buyer1/devices/phone'), { token: 'fcm-token-abcdef', platform: 'ios', updatedAt: serverTimestamp() }))
  })
})

describe('stores', () => {
  it('shows approved stores to everyone, pending ones only to owner and admin', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'stores/approved')))
    await assertFails(getDoc(doc(as('buyer1', 'buyer'), 'stores/pending')))
    await assertSucceeds(getDoc(doc(as('seller1', 'seller'), 'stores/pending')))
    await assertSucceeds(getDoc(doc(as('admin1', 'admin'), 'stores/pending')))
  })

  it('lets buyers list approved stores', async () => {
    const q = query(collection(as('buyer1', 'buyer'), 'stores'), where('verificationStatus', '==', 'approved'))
    await assertSucceeds(getDocs(q))
    await assertFails(getDocs(collection(as('buyer1', 'buyer'), 'stores')))
  })

  it('lets owners edit the description and opening state only', async () => {
    const db = as('seller1', 'seller')
    await assertSucceeds(updateDoc(doc(db, 'stores/approved'), { isOpen: false, description: 'Fresh daily', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'stores/pending'), { verificationStatus: 'approved', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'stores/approved'), { ownerId: 'someone', updatedAt: serverTimestamp() }))
  })

  it("blocks editing someone else's store and creating stores directly", async () => {
    await assertFails(updateDoc(doc(as('buyer1', 'buyer'), 'stores/approved'), { isOpen: false, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(as('seller1', 'seller'), 'stores/new'), { ownerId: 'seller1', name: 'Shortcut', verificationStatus: 'approved', isOpen: true, updatedAt: serverTimestamp() }))
  })
})

describe('riders', () => {
  it('lets an approved rider go online', async () => {
    await assertSucceeds(updateDoc(doc(as('rider1', 'rider'), 'riders/rider1'), { isOnline: true, updatedAt: serverTimestamp() }))
  })

  it('blocks unapproved riders and self-approval', async () => {
    await assertFails(updateDoc(doc(as('rider2', 'rider'), 'riders/rider2'), { isOnline: true, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as('rider2', 'rider'), 'riders/rider2'), { verificationStatus: 'approved', updatedAt: serverTimestamp() }))
  })

  it("hides rider records from other people", async () => {
    await assertFails(getDoc(doc(as('buyer1', 'buyer'), 'riders/rider1')))
  })
})

describe('platform data', () => {
  it('lets anyone read categories but nobody write them from the app', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'categories/vegetables')))
    await assertFails(setDoc(doc(as('admin1', 'admin'), 'categories/fruit'), { name: 'Fruit' }))
  })

  it('exposes only the public config', async () => {
    await assertSucceeds(getDoc(doc(as('buyer1', 'buyer'), 'config/public')))
    await assertFails(getDoc(doc(as('buyer1', 'buyer'), 'config/platform')))
  })

  it('keeps the audit log admin-only and read-only', async () => {
    await assertFails(getDoc(doc(as('buyer1', 'buyer'), 'auditLog/a1')))
    await assertSucceeds(getDoc(doc(as('admin1', 'admin'), 'auditLog/a1')))
    await assertFails(setDoc(doc(as('admin1', 'admin'), 'auditLog/a2'), { action: 'fake' }))
  })

  it('closes collections that have no rules yet', async () => {
    await assertFails(getDoc(doc(as('buyer1', 'buyer'), 'orders/o1')))
    await assertFails(setDoc(doc(as('admin1', 'admin'), 'wallets/w1'), { balance: 1_000_000 }))
  })
})
