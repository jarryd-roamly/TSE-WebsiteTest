// app/api/checkout/route.ts
// Handles three actions: 'deposit' (PayFast), 'hold' (48hr hold), 'quote' (email PDF)
//
// FIX: Removed `deposit_zar` column reference that caused the Supabase schema error.
//      The bookings table uses `total_display_zar` — deposit amount is derived,
//      not stored as a separate column.
// FIX: Column is `state` not `status` — all inserts updated accordingly.
//
// ADDITIONS:
//   - deposit_pct support (30–100%)
//   - traveller phone + nationality saved to lead_traveller_snapshot
//   - action: 'deposit' | 'hold' | 'quote'
//   - For 'hold' and 'quote': booking saved with state 'on_hold' / 'quote'
//     and email dispatched via Resend (or logged if not configured)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

function buildPayFastUrl(params: {
  amount: number
  itemName: string
  bookingRef: string
  email: string
  name: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
}) {
  const merchantId  = process.env.PAYFAST_MERCHANT_ID  || '10000100'
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a'
  // PayFast sandbox test account passphrase is 'payfast' — set PAYFAST_PASSPHRASE in env for production
  const passphrase  = process.env.PAYFAST_PASSPHRASE   ?? 'payfast'

  // Sanitize item_name - PayFast only accepts ASCII characters
  const sanitizedItemName = params.itemName.replace(/[^\x00-\x7F]/g, '-').substring(0, 100)

  const nameParts = params.name.trim().split(' ')
  const firstName = nameParts[0] || 'Traveller'
  const lastName  = nameParts.slice(1).join(' ') || 'Guest'

  // PayFast requires fields in this exact order for correct signature
  const orderedFields: [string, string][] = [
    ['merchant_id',   merchantId],
    ['merchant_key',  merchantKey],
    ['return_url',    params.returnUrl],
    ['cancel_url',    params.cancelUrl],
    ['notify_url',    params.notifyUrl],
    ['name_first',    firstName],
    ['name_last',     lastName],
    ['email_address', params.email],
    ['m_payment_id',  params.bookingRef],
    ['amount',        params.amount.toFixed(2)],
    ['item_name',     sanitizedItemName],
    ['custom_str1',   params.bookingRef],
  ]

  // Build signature string — PayFast uses urlencoded values, spaces as +
  const pfEncode = (v: string) => encodeURIComponent(v).replace(/%20/g, '+')

  const sigString = orderedFields
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${pfEncode(v)}`)
    .join('&')

  const sigWithPassphrase = passphrase
    ? `${sigString}&passphrase=${pfEncode(passphrase)}`
    : sigString

  const signature = crypto.createHash('md5').update(sigWithPassphrase).digest('hex')

  const host = process.env.PAYFAST_LIVE === 'true'
    ? 'https://www.payfast.co.za/eng/process'
    : 'https://sandbox.payfast.co.za/eng/process'

  return `${host}?${sigString}&signature=${signature}`
}

async function sendQuoteEmail(params: {
  email: string
  name: string
  bookingRef: string
  itinerary: any
  depositTotal: number
  totalZAR: number
  baseUrl: string
}) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    console.log('[checkout] RESEND_API_KEY not set — skipping email for', params.bookingRef)
    return { ok: true, skipped: true }
  }

  const itin       = params.itinerary || {}
  const nights     = itin.nights || 0
  const title      = itin.title  || 'Your Safari Journey'
  const occasion   = (itin.occasion || '').toLowerCase()
  const themes: string[] = Array.isArray(itin.themes) ? itin.themes : []
  const cities: any[] = Array.isArray(itin.cities) ? itin.cities : []
  const route      = cities.map((c: any) => c.city || '').filter(Boolean)
  const routeStr   = route.join(' · ') || (itin.routing || '').replace(/JNB →|→ JNB/g, '').trim()
  const firstName  = (params.name || '').split(' ')[0] || 'Traveller'
  const isDeposit  = (params as any).isDeposit

  // Hero image: first hotel component image
  const components: any[] = Array.isArray(itin.components) ? itin.components : []
  const firstHotel = components.find((c: any) =>
    c.pillar === 'hotel' || c.type === 'accommodation' || c.component_type === 'hotel'
  )
  const heroImg = firstHotel?.hero_image_url || firstHotel?.image || itin.hero_image_url || ''

  // Exchange rate for GBP display (≈ same as app)
  const GBP_RATE  = 0.042
  const fmtZAR    = (n: number) => `R\u00a0${Math.round(n).toLocaleString('en-ZA')}`
  const fmtGBP    = (n: number) => `£${Math.round(n * GBP_RATE).toLocaleString('en-GB')}`

  // Emotive headline + sub copy matching minisite emoTive() logic
  const emoHeadline = (() => {
    if (occasion === 'honeymoon') return `${nights} nights. Wilderness, wonder, and each other.`
    if (occasion === 'anniversary') return `Africa doesn't do ordinary. Neither should your anniversary.`
    if (occasion === 'family')   return `The Africa your family will carry forever.`
    if (occasion === 'birthday') return `A birthday worth every one of those years.`
    if (nights >= 10)            return `${nights} nights. ${route.length} wildernesses. One sequence.`
    return title
  })()

  const emoSub = (() => {
    if (occasion === 'honeymoon')  return `${routeStr || title} — every detail arranged so you simply arrive, and wonder begins.`
    if (occasion === 'anniversary') return `${routeStr || title} — a journey you'll still talk about in twenty years.`
    if (occasion === 'family')     return `${routeStr || title} — these are the moments that become stories for life.`
    const themeStr = themes.slice(0, 2).join(' · ')
    return `${routeStr || title}${themeStr ? ` · ${themeStr}` : ''}. Specialist-curated. Fully arranged.`
  })()

  const occasionBadge = occasion === 'honeymoon' ? '✦ Your Honeymoon'
    : occasion === 'anniversary' ? '✦ Your Anniversary Journey'
    : occasion === 'family'      ? '✦ Your Family Safari'
    : '✦ Your Safari Proposal'

  const miniSiteUrl  = `${params.baseUrl}/journey/${params.bookingRef}`
  const checkoutUrl  = `${params.baseUrl}/checkout?id=${itin.id}`

  // Build the "hero" section — uses VML fallback for Outlook, CSS background for all others
  const heroSection = heroImg
    ? `<!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;height:420px;"><v:fill type="frame" src="${heroImg}" color="#0a0a0a" /><v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0"><![endif]-->
      <div style="background-image:url('${heroImg}');background-size:cover;background-position:center;min-height:380px;border-radius:14px 14px 0 0;position:relative;">
      <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->`
    : `<div style="background:linear-gradient(135deg,#1a1206,#0a0a0a);min-height:280px;border-radius:14px 14px 0 0;position:relative;">`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Georgia',serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px 48px;">

    <!-- LOGO BAR -->
    <div style="text-align:center;padding:16px 0 24px;">
      <div style="color:rgba(200,169,110,0.6);font-size:9px;letter-spacing:0.5em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;">
        ✦ THE SAFARI EDITION ✦
      </div>
    </div>

    <!-- HERO CARD -->
    <div style="border-radius:16px;overflow:hidden;border:0.5px solid rgba(200,169,110,0.25);">

      <!-- Hero image section -->
      ${heroSection}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 50%,rgba(0,0,0,0.15) 100%);border-radius:14px 14px 0 0;"></div>
      <div style="position:relative;padding:48px 32px 36px;">
        <!-- Occasion badge -->
        <div style="display:inline-block;background:rgba(200,169,110,0.15);border:0.5px solid rgba(200,169,110,0.4);color:#d4af37;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;padding:5px 14px;border-radius:20px;font-family:Helvetica,Arial,sans-serif;margin-bottom:18px;">
          ${occasionBadge}
        </div>
        <!-- Themes row -->
        ${themes.length > 0 ? `<div style="margin-bottom:12px;">${themes.slice(0,3).map(th => `<span style="display:inline-block;background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.12);color:rgba(245,240,232,0.55);font-size:9px;letter-spacing:0.14em;text-transform:uppercase;padding:3px 10px;border-radius:20px;font-family:Helvetica,Arial,sans-serif;margin-right:6px;">${th}</span>`).join('')}</div>` : ''}
        <!-- Route breadcrumb -->
        ${routeStr ? `<div style="color:rgba(200,169,110,0.8);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;margin-bottom:12px;">${routeStr}</div>` : ''}
        <!-- Emotive headline -->
        <h1 style="font-family:'Georgia',serif;font-size:32px;font-weight:400;color:#f5f0e8;margin:0 0 14px;line-height:1.1;">
          ${emoHeadline}
        </h1>
        <!-- Emotive sub -->
        <p style="color:rgba(245,240,232,0.65);font-size:14px;line-height:1.7;margin:0 0 20px;font-family:Helvetica,Arial,sans-serif;">
          ${emoSub}
        </p>
        <!-- Meta -->
        <div style="color:rgba(245,240,232,0.5);font-size:12px;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
          ${firstName} &nbsp;|&nbsp; ${nights > 0 ? `${nights} nights` : ''} &nbsp;·&nbsp; Ref: <strong style="color:#d4af37;letter-spacing:0.05em;">${params.bookingRef}</strong>
        </div>
      </div>
      </div><!-- end hero bg div -->

      <!-- PAYMENT PANEL -->
      <div style="background:#111111;border-top:0.5px solid rgba(200,169,110,0.18);padding:28px 32px;">
        <div style="font-size:9px;color:rgba(200,169,110,0.55);letter-spacing:0.32em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;margin-bottom:18px;">
          Payment Summary
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-bottom:10px;color:rgba(245,240,232,0.55);font-size:13px;font-family:Helvetica,Arial,sans-serif;">Total journey value</td>
            <td style="padding-bottom:10px;text-align:right;font-family:'Georgia',serif;">
              <span style="font-size:22px;color:#f5f0e8;">${fmtZAR(params.totalZAR)}</span>
              <div style="font-size:11px;color:rgba(245,240,232,0.35);font-family:Helvetica,Arial,sans-serif;margin-top:2px;">≈ ${fmtGBP(params.totalZAR)}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0;"><div style="height:0.5px;background:rgba(255,255,255,0.07);margin:4px 0 14px;"></div></td>
          </tr>
          <tr>
            <td style="color:rgba(245,240,232,0.55);font-size:13px;font-family:Helvetica,Arial,sans-serif;">${isDeposit ? 'Deposit to pay now' : 'Deposit to secure'}</td>
            <td style="text-align:right;font-family:'Georgia',serif;">
              <span style="font-size:28px;color:#d4af37;">${fmtZAR(params.depositTotal)}</span>
              <div style="font-size:11px;color:rgba(200,169,110,0.45);font-family:Helvetica,Arial,sans-serif;margin-top:2px;">≈ ${fmtGBP(params.depositTotal)} · held in trust</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- VALIDITY + BUTTONS -->
      <div style="background:#0e0e0e;border-top:0.5px solid rgba(255,255,255,0.06);padding:24px 32px 28px;">
        <p style="color:rgba(245,240,232,0.5);font-size:12px;line-height:1.7;margin:0 0 22px;font-family:Helvetica,Arial,sans-serif;">
          ${isDeposit
            ? `Your deposit secures every rate and holds all camps. A Journey Specialist will be in contact within 2 hours to confirm availability and next steps.`
            : `This proposal is held for 48 hours. Your Journey Specialist will be in touch within 2 hours to answer any questions and confirm availability.`
          }
        </p>
        <!-- Two CTA buttons side by side -->
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:10px;">
              <a href="${miniSiteUrl}"
                 style="display:inline-block;padding:14px 22px;background:linear-gradient(180deg,#e8c96e,#c8a96e);color:#1a1206;text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.02em;white-space:nowrap;">
                ✦ Visit Trip Minisite
              </a>
            </td>
            <td>
              <a href="${checkoutUrl}"
                 style="display:inline-block;padding:14px 22px;background:transparent;color:#d4af37;text-decoration:none;border-radius:9px;font-size:13px;font-weight:600;font-family:Helvetica,Arial,sans-serif;border:1px solid rgba(200,169,110,0.45);letter-spacing:0.02em;white-space:nowrap;">
                Pay Deposit →
              </a>
            </td>
          </tr>
        </table>
      </div>

    </div><!-- end hero card -->

    <!-- FOOTER -->
    <div style="margin-top:32px;padding-top:20px;border-top:0.5px solid rgba(255,255,255,0.06);text-align:center;">
      <div style="font-size:10px;color:rgba(245,240,232,0.25);line-height:1.8;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.06em;">
        THE SAFARI EDITION &nbsp;·&nbsp; journeys@thesafariedition.com<br>
        ASATA registered &nbsp;·&nbsp; SSL secured &nbsp;·&nbsp; Deposits held in client trust<br>
        <span style="color:rgba(245,240,232,0.15);">thesafariedition.com</span>
      </div>
    </div>

  </div>
</body>
</html>`

  // ── Send via Resend ────────────────────────────────────────────────────────
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from:     'The Safari Edition <journeys@thesafariedition.com>',
      to:       params.email,
      reply_to: 'journeys@thesafariedition.com',
      subject:  isDeposit
        ? `Booking Confirmed · ${params.bookingRef} · The Safari Edition`
        : `${emoHeadline} · ${params.bookingRef}`,
      html,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown')
    console.error('[resend error]', res.status, errText)
  } else {
    console.log('[resend] sent to', params.email)
  }
  return { ok: res.ok }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      itinerary_id,
      traveller_email,
      traveller_name,
      traveller_phone,
      traveller_nationality,
      deposit_pct = 30,
      action = 'deposit', // 'deposit' | 'hold' | 'quote'
    } = body

    if (!itinerary_id || !traveller_email) {
      return NextResponse.json(
        { success: false, error: 'Missing itinerary_id or traveller_email' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Load itinerary
    const { data: itinerary, error: iErr } = await supabase
      .from('itineraries')
      .select('id, title, nights, adults, check_in, check_out, total_display_zar, components')
      .eq('id', itinerary_id)
      .single()

    if (iErr || !itinerary) {
      return NextResponse.json({ success: false, error: 'Itinerary not found' }, { status: 404 })
    }

    const totalZAR = itinerary.total_display_zar || 0

    // Separate flights/transfers (always full) from accommodation (deposit %)
    const components: any[] = itinerary.components || []
    const flightTotal   = components.filter(c => {
      const t = (c.type || c.component_type || '').toLowerCase()
      return t.includes('flight') || t.includes('air') || c.is_flight
    }).reduce((s: number, c: any) => s + (c.price_display_zar || 0), 0)
    const transferTotal = components.filter(c => {
      const t = (c.type || c.component_type || '').toLowerCase()
      return (t.includes('transfer') || t === 'transport') && !t.includes('flight')
    }).reduce((s: number, c: any) => s + (c.price_display_zar || 0), 0)
    const landTotal     = totalZAR - flightTotal - transferTotal
    const depositOnLand = Math.round(landTotal * deposit_pct / 100)
    const depositTotal  = depositOnLand + flightTotal + transferTotal
    const balanceAmount = totalZAR - depositTotal

    const bookingRef = 'TSE-' + Math.random().toString(36).substring(2, 10).toUpperCase()

    const statusMap: Record<string, string> = {
      deposit: 'pending_payment',
      hold:    'on_hold',
      quote:   'quote',
    }

    // ── Save booking record ─────────────────────────────────────────────────
    // NOTE: We do NOT write `deposit_zar` — that column does not exist in the schema.
    //       Deposit amount is always recalculated from total_display_zar + deposit_pct.
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        itinerary_id,
        booking_reference:     bookingRef,
        idempotency_key:       bookingRef,
        edition_id:            'safari',
        state:                 statusMap[action] || 'pending_payment',
        title:                 itinerary.title || 'Safari Journey',
        adults:                itinerary.adults || 2,
        children_count:        0,
        nights:                itinerary.nights || 1,
        check_in:              itinerary.check_in || null,
        check_out:             itinerary.check_out || null,
        total_display_zar:     totalZAR,
        total_net_zar:         Math.round(totalZAR * 0.82),
        total_paid_zar:        0,
        outstanding_zar:       totalZAR,
        budget_zar:            totalZAR,
        currency_paid:         'ZAR',
        deposit_pct:           deposit_pct,
        booked_at:             new Date().toISOString(),
        lead_traveller_snapshot: {
          name:        traveller_name  || '',
          email:       traveller_email,
          phone:       traveller_phone || '',
          nationality: traveller_nationality || '',
        },
      })
      .select('id, booking_reference')
      .single()

    if (bErr) {
      // Fallback with only guaranteed columns
      const { data: bFallback, error: bFallbackErr } = await supabase
        .from('bookings')
        .insert({
          itinerary_id,
          booking_reference: bookingRef,
          idempotency_key:   bookingRef,
          edition_id:        'safari',
          state:             statusMap[action] || 'pending_payment',
          title:             itinerary.title || 'Safari Journey',
          adults:            itinerary.adults || 2,
          children_count:    0,
          nights:            itinerary.nights || 1,
          check_in:          itinerary.check_in || null,
          check_out:         itinerary.check_out || null,
          total_display_zar: totalZAR,
          total_net_zar:     Math.round(totalZAR * 0.82),
          budget_zar:        totalZAR,
          booked_at:         new Date().toISOString(),
          lead_traveller_snapshot: {
            name:        traveller_name  || '',
            email:       traveller_email,
            phone:       traveller_phone || '',
            nationality: traveller_nationality || '',
          },
        })
        .select('id, booking_reference')
        .single()

      if (bFallbackErr) {
        return NextResponse.json(
          { success: false, error: `Could not save booking: ${bFallbackErr.message}` },
          { status: 500 }
        )
      }

      // Use fallback booking if primary insert failed
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}` || 'https://tse-website-test.vercel.app'
      if (action === 'quote' || action === 'hold') {
        await sendQuoteEmail({ email: traveller_email, name: traveller_name || '', bookingRef, itinerary, depositTotal, totalZAR, baseUrl })
        return NextResponse.json({
          success: true,
          booking_id:     bFallback!.id,
          booking_ref:    bFallback!.booking_reference,
          action,
          deposit_amount: depositTotal,
          total_amount:   totalZAR,
        })
      }

      const payfastUrl = buildPayFastUrl({
        amount:    parseFloat((Math.round(depositTotal * 100) / 100).toFixed(2)),
        itemName:  `The Safari Edition - ${bookingRef}`,
        bookingRef,
        email:     traveller_email,
        name:      traveller_name || '',
        returnUrl: `${baseUrl}/booking/confirmed?ref=${bookingRef}`,
        cancelUrl: `${baseUrl}/checkout?id=${itinerary_id}&cancelled=1`,
        notifyUrl: `${baseUrl}/api/payfast/notify`,
      })

      return NextResponse.json({
        success: true,
        booking_id:     bFallback!.id,
        booking_ref:    bFallback!.booking_reference,
        deposit_amount: depositTotal,
        balance_amount: balanceAmount,
        total_amount:   totalZAR,
        payfast_url:    payfastUrl,
      })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}` || 'https://tse-website-test.vercel.app'

    // ── Hold or Quote ────────────────────────────────────────────────────────
    if (action === 'quote' || action === 'hold') {
      await sendQuoteEmail({ email: traveller_email, name: traveller_name || '', bookingRef, itinerary, depositTotal, totalZAR, baseUrl })
      return NextResponse.json({
        success:        true,
        booking_id:     booking!.id,
        booking_ref:    booking!.booking_reference,
        action,
        deposit_amount: depositTotal,
        total_amount:   totalZAR,
      })
    }

    // ── Deposit → send confirmation email + PayFast ─────────────────────────
    // Send booking confirmation email (non-blocking — don't fail payment if email fails)
    try {
      await sendQuoteEmail({
        email:       traveller_email,
        name:        traveller_name || '',
        bookingRef,
        itinerary,
        depositTotal,
        totalZAR,
        baseUrl,
        isDeposit:   true,
      })
    } catch { /* email failure must never block PayFast redirect */ }

    const payfastUrl = buildPayFastUrl({
      amount:    Math.round(depositTotal * 100) / 100,
      itemName:  `The Safari Edition - ${bookingRef}`,
      bookingRef,
      email:     traveller_email,
      name:      traveller_name || '',
      returnUrl: `${baseUrl}/booking/confirmed?ref=${bookingRef}`,
      cancelUrl: `${baseUrl}/checkout?id=${itinerary_id}&cancelled=1`,
      notifyUrl: `${baseUrl}/api/payfast/notify`,
    })

    return NextResponse.json({
      success:        true,
      booking_id:     booking!.id,
      booking_ref:    booking!.booking_reference,
      deposit_amount: depositTotal,
      balance_amount: balanceAmount,
      total_amount:   totalZAR,
      payfast_url:    payfastUrl,
    })

  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Server error' },
      { status: 500 }
    )
  }
}
