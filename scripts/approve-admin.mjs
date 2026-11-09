// Grants admin access for an account created on the /admin/signup page. Meant
// for the first super admin; after that, super admins manage the team in the
// app (/admin/team).
// Usage: pnpm admin:approve someone@example.com            approve as admin
//        pnpm admin:approve someone@example.com --super    approve as super admin
//        pnpm admin:approve someone@example.com --revoke   remove access and end their sessions
import { FieldValue } from 'firebase-admin/firestore'
import { auth, db, projectId } from './firebase.mjs'

const email = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const revoke = process.argv.includes('--revoke')
const superAdmin = !revoke && process.argv.includes('--super')
if (!email) {
  console.error('Usage: pnpm admin:approve <email> [--super | --revoke]')
  process.exit(1)
}

const user = await auth.getUserByEmail(email)
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: !revoke, superAdmin })
await db
  .collection('admins')
  .doc(user.uid)
  .set(
    revoke
      ? { status: 'revoked', role: 'admin', revokedAt: FieldValue.serverTimestamp() }
      : { status: 'active', role: superAdmin ? 'super' : 'admin', approvedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
// Ends existing sessions so a revoke takes effect at once.
if (revoke) await auth.revokeRefreshTokens(user.uid)

console.log(`${revoke ? 'Revoked' : superAdmin ? 'Approved as super admin:' : 'Approved admin access for'} ${email} on ${projectId}.`)
