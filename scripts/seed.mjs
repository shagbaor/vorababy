// Writes the development data in lib/admin/mock-data.ts to Firestore and
// creates a Firebase Auth account (same uid, random password) for each seed
// user so suspend and ban can be tried on real accounts.
// Usage: pnpm db:seed            (refuses to touch a project not ending in "-dev")
//        pnpm db:seed --force    (any project)
import { randomBytes } from 'node:crypto'
import { auth, db, projectId } from './firebase.mjs'
import { seedConversations, seedDisputes, seedOrders, seedUsers } from '../lib/admin/mock-data.ts'

if (!projectId.endsWith('-dev') && !process.argv.includes('--force')) {
  console.error(`Refusing to seed "${projectId}": it does not look like a dev project. Pass --force to seed it anyway.`)
  process.exit(1)
}

const batch = db.batch()

const HOUR = 60 * 60 * 1000
const now = Date.now()
const COMMISSION_RATE = 0.1

// Sample orders spread over the last few days, newest first, so the dashboard
// has something to count. Released orders earn Vorapicks its commission.
const orderAgeHours = [1, 2, 4, 6, 20, 26, 30, 50, 75, 100]
seedOrders.forEach(({ id, placedAt: _placedAt, ...order }, i) => {
  const createdAt = now - orderAgeHours[i % orderAgeHours.length] * HOUR
  const released = order.status === 'released' ? { releasedAt: new Date(Math.min(now - HOUR / 2, createdAt + 6 * HOUR)), platformFee: Math.round(order.amount * COMMISSION_RATE) } : {}
  batch.set(db.collection('orders').doc(id), { ...order, ...released, createdAt: new Date(createdAt) })
})
console.log(`orders: ${seedOrders.length}`)

// "2 hours ago" / "1 day ago" in the sample data become real timestamps.
for (const { id, openedAgo, ...dispute } of seedDisputes) {
  const [, count, unit] = /(\d+)\s+(hour|day)/.exec(openedAgo) ?? [, '1', 'hour']
  batch.set(db.collection('disputes').doc(id), { ...dispute, createdAt: new Date(now - Number(count) * (unit === 'day' ? 24 : 1) * HOUR) })
}
console.log(`disputes: ${seedDisputes.length}`)

seedConversations.forEach(({ id, ...data }, rank) => batch.set(db.collection('conversations').doc(id), { ...data, rank }))
console.log(`conversations: ${seedConversations.length}`)

for (const { id, joined, ...profile } of seedUsers) {
  const account = { email: profile.email, displayName: profile.name, disabled: profile.suspended || profile.banned }
  try {
    await auth.updateUser(id, account)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    await auth.createUser({ uid: id, ...account, password: randomBytes(18).toString('base64url') })
  }
  batch.set(db.collection('users').doc(id), { ...profile, createdAt: new Date(`${joined} 09:00 GMT+0100`) })
}
console.log(`users: ${seedUsers.length} (with Firebase accounts)`)

batch.set(db.collection('meta').doc('settings'), { commissionRate: COMMISSION_RATE }, { merge: true })
batch.delete(db.collection('meta').doc('dashboard'))
await batch.commit()
console.log(`Seeded ${projectId}.`)
