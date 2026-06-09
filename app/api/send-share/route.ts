import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Currency conversion — matches journey.ts EXCHANGE rates
const EXCHANGE: Record<string, { sym: string; rate: number }> = {
  uk: { sym: '£',   rate: 0.042 },
  us: { sym: 'US$', rate: 0.054 },
  de: { sym: '€',   rate: 0.049 },
  za: { sym: 'R',   rate: 1.000 },
}

function convertAmount(zarAmount: number, market: string): string {
  const cfg = EXCHANGE[market] || EXCHANGE.uk
  const converted = Math.round(zarAmount * cfg.rate)
  return `${cfg.sym}${converted.toLocaleString()}`
}

// Resend only — matches the checkout route exactly
async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    console.log('[send-share] RESEND_API_KEY not set — would send to:', to)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from:    'The Safari Edition <journeys@thesafariedition.com>',
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[send-share] Resend error', res.status, err)
    throw new Error(`Resend ${res.status}: ${err}`)
  }
  console.log('[send-share] sent to', to)
}

function buildHtml({
  title, ref, senderName, note, baseUrl,
  totalDisplay, market,
}: {
  title: string; ref: string; senderName: string; note: string; baseUrl: string;
  totalDisplay?: number; market?: string;
}) {
  const url = `${baseUrl}/journey/${ref}?mode=confirmed`
  const mkt = market || 'uk'

  const priceBlock = totalDisplay && totalDisplay > 0 ? `
    <div style="background:#141414;border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:20px 24px;margin-bottom:28px">
      <div style="font-size:11px;color:rgba(212,175,55,0.7);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:14px">Journey value</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:rgba(245,240,232,0.6);font-size:13px">Total journey</span>
        <span style="font-size:22px;color:#f5f0e8;font-weight:300">${convertAmount(totalDisplay, mkt)}</span>
      </div>
      <div style="font-size:11px;color:rgba(245,240,232,0.3);margin-top:8px">
        ${mkt !== 'za' ? `R ${Math.round(totalDisplay).toLocaleString()} · converted at today's rate` : ''}
      </div>
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0a0a0a;color:#f5f0e8;font-family:Georgia,serif;margin:0;padding:0">
<div style="max-width:580px;margin:0 auto;padding:48px 28px">

  <div style="color:#d4af37;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;margin-bottom:32px">✦ The Safari Edition</div>

  <h1 style="font-size:34px;font-weight:300;margin:0 0 8px;color:#f5f0e8;line-height:1.1">${title}</h1>
  <p style="color:rgba(245,240,232,0.5);font-size:13px;margin:0 0 28px">${senderName} has shared this journey with you.</p>

  ${note ? `
  <div style="background:#141414;border-left:2px solid #d4af37;padding:14px 18px;margin-bottom:24px;border-radius:0 8px 8px 0">
    <div style="font-size:10px;color:#d4af37;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px">A note</div>
    <p style="color:#f5f0e8;font-size:14px;line-height:1.6;margin:0;font-style:italic">${note}</p>
  </div>` : ''}

  ${priceBlock}

  <a href="${url}"
     style="display:block;text-align:center;padding:16px 28px;background:#d4af37;color:#0a0a0a;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;font-family:system-ui,sans-serif;margin-bottom:16px;letter-spacing:0.02em">
    View the journey →
  </a>

  <p style="text-align:center;font-size:11px;color:rgba(245,240,232,0.3);margin:0 0 40px;word-break:break-all">${url}</p>

  <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;font-size:11px;color:rgba(245,240,232,0.25);line-height:1.6">
    The Safari Edition · journeys@thesafariedition.com<br>
    This is a private journey link shared directly with you.
  </div>
</div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const {
      booking_reference,
      recipients,
      note = '',
      sender_name = 'The Safari Edition team',
    } = await req.json()

    if (!booking_reference || !recipients?.length)
      return NextResponse.json({ success: false, error: 'booking_reference and recipients required' }, { status: 400 })

    const invalid = (recipients as string[]).filter((e: string) => !e.includes('@'))
    if (invalid.length)
      return NextResponse.json({ success: false, error: `Invalid email: ${invalid.join(', ')}` }, { status: 400 })

    // Fetch booking — title + market for currency conversion
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data: bk } = await sb
      .from('bookings')
      .select('title, total_display_zar, lead_traveller_snapshot')
      .eq('booking_reference', booking_reference)
      .single()

    const title        = bk?.title || 'Your Safari Journey'
    const totalDisplay = bk?.total_display_zar || 0
    const market       = bk?.lead_traveller_snapshot?.source_market || 'uk'
    const baseUrl      = process.env.NEXT_PUBLIC_SITE_URL
      || `https://${req.headers.get('host')}`
      || 'https://tse-website-test.vercel.app'

    const html    = buildHtml({ title, ref: booking_reference, senderName: sender_name, note, baseUrl, totalDisplay, market })
    const subject = `${title} — your journey awaits ✦`

    const results = await Promise.allSettled(
      (recipients as string[]).map((e: string) => sendEmail(e, subject, html))
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message)

    return NextResponse.json({
      success: sent > 0,
      sent,
      failed:  errors.length,
      errors:  errors.length ? errors : undefined,
    })

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
