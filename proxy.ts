import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/admin/auth'

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/signup']

// Sends visitors without a session cookie to the admin login page. This is only
// a fast first check: the (app) layout verifies the Firebase session cookie and
// the (auth) layout sends signed-in admins on to /admin.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const signedIn = request.cookies.has(SESSION_COOKIE)
  const isPublic = PUBLIC_ADMIN_PATHS.includes(pathname)

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
