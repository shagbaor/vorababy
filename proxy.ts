import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/admin/auth'

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/signup']

// Sends signed-out visitors to the admin login page. The session cookie is set
// by the mock sign-in in lib/admin/auth.ts.
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

  if (signedIn && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
