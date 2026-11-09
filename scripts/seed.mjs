// Writes the development data in lib/admin/mock-data.ts to Firestore.
// Usage: pnpm db:seed            (refuses to touch a project not ending in "-dev")
//        pnpm db:seed --force    (any project)
import { db, projectId } from './firebase.mjs'
import { seedConversations, seedDashboard, seedDisputes, seedOrders, seedUsers } from '../lib/admin/mock-data.ts'

if (!projectId.endsWith('-dev') && !process.argv.includes('--force')) {
  console.error(`Refusing to seed "${projectId}": it does not look like a dev project. Pass --force to seed it anyway.`)
  process.exit(1)
}

const collections = {
  orders: seedOrders,
  disputes: seedDisputes,
  users: seedUsers,
  conversations: seedConversations,
}

const batch = db.batch()
for (const [name, items] of Object.entries(collections)) {
  items.forEach(({ id, ...data }, rank) => batch.set(db.collection(name).doc(id), { ...data, rank }))
  console.log(`${name}: ${items.length}`)
}
batch.set(db.collection('meta').doc('dashboard'), seedDashboard)
await batch.commit()
console.log(`Seeded ${projectId}.`)
