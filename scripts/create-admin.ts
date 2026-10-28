// Creates an admin login and prints a one-time link for them to set a password.
// Used once to create the first admin; after that, admins invite each other.
//
//   pnpm admin:create ops@vorapicks.com "Vorapicks HQ"

import { inviteAdmin, inviteInput } from '@/lib/server/accounts'

async function main() {
  const [email, fullName] = process.argv.slice(2)
  if (!email || !fullName) {
    console.error('Usage: pnpm admin:create <email> "<full name>"')
    process.exit(1)
  }
  const siteUrl = process.env.SITE_URL ?? 'https://www.vorapicks.com'
  const input = inviteInput.parse({ email, fullName })
  const result = await inviteAdmin({ uid: 'setup-script', email: null }, input, `${siteUrl}/admin/login`)
  console.log(`Created admin ${result.email} (${result.id}).`)
  console.log('Send them this link to set their password (it works once):')
  console.log(result.setPasswordLink)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
