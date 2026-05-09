import { NextRequest, NextResponse } from 'next/server'

const DEMO_PASSWORD = 'safari2026'

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body.password === DEMO_PASSWORD) {
    response.cookies.set('demo_auth', 'authenticated', {
    response.cookies.set('demo_auth', DEMO_PASSWORD, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
    })
    return response
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}
