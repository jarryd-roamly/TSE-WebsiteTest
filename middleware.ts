import { NextRequest, NextResponse } from 'next/server'

const DEMO_PASSWORD = 'safari2026'

export function middleware(request: NextRequest) {
  // Already authenticated
  const cookie = request.cookies.get('demo_auth')
  if (cookie?.value === 'authenticated') return NextResponse.next()

  // Let the login page through
  const { pathname } = request.nextUrl
  if (pathname === '/demo-login') return NextResponse.next()

  // Everything else → redirect to login
  return NextResponse.redirect(new URL('/demo-login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
