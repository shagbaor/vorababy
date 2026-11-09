import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, db } from '@/lib/firebase/admin'
import { initials, SESSION_COOKIE } from '@/lib/admin/auth'

export type AdminSession = {
  uid: string
  email: string
  name: string
  initials: string
  superAdmin: boolean
}

// Verifies the Firebase session cookie (including revocation), then reads the
// admin's record on every request, so approvals, removals and super admin
// changes take effect at once rather than at the next sign-in.
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value
  if (!cookie) return null
  try {
    const claims = await adminAuth().verifySessionCookie(cookie, true)
    const record = await db().collection('admins').doc(claims.uid).get()
    if (record.get('status') !== 'active') return null
    const name = (record.get('fullName') as string | undefined) || (claims.name as string | undefined) || claims.email || 'Admin'
    return { uid: claims.uid, email: claims.email ?? '', name, initials: initials(name), superAdmin: record.get('role') === 'super' }
  } catch {
    return null
  }
})

export async function requireAdmin() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return session
}
