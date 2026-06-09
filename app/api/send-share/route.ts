import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function sendEmail(to: string, subject: string, html: string) {
  const BREVO_KEY  = process.env.BREVO_API_KEY
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (BREVO_KEY) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify({ sender: { name: 'The Safari Edition', email: 'noreply@thesafariedition.com' }, to: [{ email: to }], subject, htmlContent: html }),
    })
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`)
    return
  }
  if (RESEND_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: 'The Safari Edition <onboarding@resend.dev>', to, subject, html }),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
    return
  }
  console.log('[send-share] No email provider — would send to:', to)
}

function buildHtml({ title, ref, senderName, note, baseUrl }: { title:string; ref:string; senderName:string; note:string; baseUrl:string }) {
  const url = `${baseUrl}/journey/${ref}?mode=confirmed`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0a0a0a;color:#f5f0e8;font-family:Georgia,serif;margin:0;padding:0">
<div style="max-width:580px;margin:0 auto;padding:48px 28px">
  <div style="color:#d4af37;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;margin-bottom:32px">✦ The Safari Edition</div>
  <h1 style="font-size:34px;font-weight:300;margin:0 0 8px;color:#f5f0e8;line-height:1.1">${title}</h1>
  <p style="color:rgba(245,240,232,0.5);font-size:13px;margin:0 0 28px">${senderName} has shared this journey with you.</p>
  ${note ? `<div style="background:#141414;border-left:2px solid #d4af37;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0"><div style="font-size:10px;color:#d4af37;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px">A note</div><p style="color:#f5f0e8;font-size:14px;line-height:1.6;margin:0;font-style:italic">${note}</p></div>` : ''}
  <a href="${url}" style="display:block;text-align:center;padding:16px 28px;background:#d4af37;color:#0a0a0a;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;font-family:system-ui,sans-serif;margin-bottom:16px">View the journey →</a>
  <p style="text-align:center;font-size:11px;color:rgba(245,240,232,0.3);margin:0 0 40px;word-break:break-all">${url}</p>
  <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;font-size:11px;color:rgba(245,240,232,0.25);line-height:1.6">The Safari Edition · journeys@thesafariedition.com</div>
</div></body></html>`
}

export async function POST(req: NextRequest) {
  try {
    const { booking_reference, recipients, note = '', sender_name = 'The Safari Edition team' } = await req.json()
    if (!booking_reference || !recipients?.length)
      return NextResponse.json({ success: false, error: 'booking_reference and recipients required' }, { status: 400 })
    const invalid = (recipients as string[]).filter(e => !e.includes('@'))
    if (invalid.length)
      return NextResponse.json({ success: false, error: `Invalid: ${invalid.join(', ')}` }, { status: 400 })
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data: bk } = await sb.from('bookings').select('title').eq('booking_reference', booking_reference).single()
    const title   = bk?.title || 'Your Safari Journey'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}` || 'https://tse-website-test.vercel.app'
    const html    = buildHtml({ title, ref: booking_reference, senderName: sender_name, note, baseUrl })
    const subject = `${title} — your journey awaits ✦`
    const results = await Promise.allSettled((recipients as string[]).map(e => sendEmail(e, subject, html)))
    const sent    = results.filter(r => r.status === 'fulfilled').length
    const errors  = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason?.message)
    return NextResponse.json({ success: sent > 0, sent, failed: errors.length, errors: errors.length ? errors : undefined })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
