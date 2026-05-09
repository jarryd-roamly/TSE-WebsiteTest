import { NextRequest } from 'next/server'

const DEMO_PASSWORD = 'safari2026'

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body.password === DEMO_PASSWORD) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `demo_auth=authenticated; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`,
      },
    })
  }

  return new Response(JSON.stringify({ ok: false }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
