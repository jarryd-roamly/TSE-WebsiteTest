import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let API routes, static files and login page through unconditionally
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/demo-login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Check auth cookie
  const cookie = request.cookies.get('demo_auth')
  if (cookie?.value === 'authenticated') return NextResponse.next()

  // Everything else → login
  return NextResponse.redirect(new URL('/demo-login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)']
}
