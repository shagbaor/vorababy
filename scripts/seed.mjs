// Writes the development data in lib/admin/mock-data.ts to Firestore and
// creates a Firebase Auth account (same uid, random password) for each seed
// user so suspend and ban can be tried on real accounts.
// Usage: pnpm db:seed            (refuses to touch a project not ending in "-dev")
//        pnpm db:seed --force    (any project)
import { randomBytes } from 'node:crypto'
import { auth, db, projectId } from './firebase.mjs'
import { seedConversations, seedDashboard, seedDisputes, seedOrders, seedUsers } from '../lib/admin/mock-data.ts'

if (!projectId.endsWith('-dev') && !process.argv.includes('--force')) {
  console.error(`Refusing to seed "${projectId}": it does not look like a dev project. Pass --force to seed it anyway.`)
  process.exit(1)
}

const batch = db.batch()

for (const [name, items] of Object.entries({ orders: seedOrders, disputes: seedDisputes, conversations: seedConversations })) {
  items.forEach(({ id, ...data }, rank) => batch.set(db.collection(name).doc(id), { ...data, rank }))
  console.log(`${name}: ${items.length}`)
}

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

batch.set(db.collection('meta').doc('dashboard'), seedDashboard)
await batch.commit()
console.log(`Seeded ${projectId}.`)
