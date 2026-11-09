import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth } from '@/lib/firebase/admin'
import { initials, SESSION_COOKIE } from '@/lib/admin/auth'

export type AdminSession = {
  uid: string
  email: string
  name: string
  initials: string
}

// Verifies the Firebase session cookie (including revocation) and requires the
// `admin` custom claim, which scripts/approve-admin.mjs grants.
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value
  if (!cookie) return null
  try {
    const claims = await adminAuth().verifySessionCookie(cookie, true)
    if (claims.admin !== true) return null
    const name = (claims.name as string | undefined) || claims.email || 'Admin'
    return { uid: claims.uid, email: claims.email ?? '', name, initials: initials(name) }
  } catch {
    return null
  }
})

export async function requireAdmin() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return session
}
