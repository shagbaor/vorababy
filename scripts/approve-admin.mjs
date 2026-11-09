// Grants (or with --revoke, removes) admin access for an account created on
// the /admin/signup page.
// Usage: pnpm admin:approve someone@example.com [--revoke]
import { FieldValue } from 'firebase-admin/firestore'
import { auth, db, projectId } from './firebase.mjs'

const email = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const revoke = process.argv.includes('--revoke')
if (!email) {
  console.error('Usage: pnpm admin:approve <email> [--revoke]')
  process.exit(1)
}

const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: !revoke })
await db
  .collection('admins')
  .doc(user.uid)
  .set(
    revoke ? { status: 'revoked', revokedAt: FieldValue.serverTimestamp() } : { status: 'active', approvedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
// Ends existing sessions so a revoke takes effect at once.
if (revoke) await auth.revokeRefreshTokens(user.uid)

console.log(`${revoke ? 'Revoked' : 'Approved'} admin access for ${email} on ${projectId}.`)
