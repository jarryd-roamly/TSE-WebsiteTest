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
  const passphrase  = process.env.PAYFAST_PASSPHRASE   || ''

  const data: Record<string, string> = {
    merchant_id:  merchantId,
    merchant_key: merchantKey,
    return_url:   params.returnUrl,
    cancel_url:   params.cancelUrl,
    notify_url:   params.notifyUrl,
    email_address: params.email,
    name_first:   params.name.split(' ')[0] || params.name,
    name_last:    params.name.split(' ').slice(1).join(' ') || '',
    m_payment_id: params.bookingRef,
    amount:       params.amount.toFixed(2),
    item_name:    params.itemName,
    custom_str1:  params.bookingRef,
  }

  // Remove empty values (PayFast rejects blank fields)
  Object.keys(data).forEach(k => { if (!data[k]) delete data[k] })

  const sigString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&')

  const sigWithPassphrase = passphrase
    ? `${sigString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : sigString

  const signature = crypto.createHash('md5').update(sigWithPassphrase).digest('hex')

  // Use sandbox in non-production, live otherwise
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

  const nights = params.itinerary?.nights || 0
  const title  = params.itinerary?.title  || 'Your Safari Journey'

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#0a0a0a;color:#f5f0e8;font-family:Georgia,serif;margin:0;padding:0">
      <div style="max-width:600px;margin:0 auto;padding:40px 24px">
        <div style="color:#c8a96e;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;margin-bottom:20px">
          The Safari Edition
        </div>
        <h1 style="font-size:32px;font-weight:300;margin:0 0 8px;color:#f5f0e8">
          ${title}
        </h1>
        <div style="color:rgba(245,240,232,0.5);font-size:13px;margin-bottom:32px">
          ${nights > 0 ? `${nights} nights · ` : ''}Booking reference: <strong style="color:#c8a96e">${params.bookingRef}</strong>
        </div>
        <div style="background:#141414;border:1px solid rgba(200,169,110,0.2);border-radius:12px;padding:24px;margin-bottom:24px">
          <div style="font-size:11px;color:rgba(200,169,110,0.7);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px">
            Payment Summary
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px">
            <span style="color:rgba(245,240,232,0.6)">Total journey value</span>
            <span style="font-size:20px;color:#f5f0e8">R ${Math.round(params.totalZAR).toLocaleString()}</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;margin-top:12px">
            <span style="color:rgba(245,240,232,0.6)">Deposit to secure</span>
            <span style="font-size:24px;color:#c8a96e">R ${Math.round(params.depositTotal).toLocaleString()}</span>
          </div>
        </div>
        <p style="color:rgba(245,240,232,0.6);font-size:13px;line-height:1.7">
          This quote is valid for 48 hours. Your Journey Specialist will be in touch within 2 hours 
          to answer any questions and confirm availability.
        </p>
        <a href="${params.baseUrl}/checkout?id=${params.itinerary?.id}" 
           style="display:inline-block;padding:14px 28px;background:#c8a96e;color:#0a0a0a;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin-top:16px">
          Confirm &amp; Pay Deposit →
        </a>
        <div style="margin-top:40px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.07);font-size:11px;color:rgba(245,240,232,0.3);line-height:1.7">
          The Safari Edition · journeys@thesafariedition.com<br>
          ASATA registered · SSL secured
        </div>
      </div>
    </body>
    </html>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from:    'The Safari Edition <onboarding@resend.dev>',
      to:      params.email,
      subject: (params as any).isDeposit
        ? `Booking Confirmed · ${params.bookingRef} · The Safari Edition`
        : `Your Safari Journey Quote · ${params.bookingRef}`,
      html,
    }),
  })
  if (!res.ok) console.error('[resend error]', res.status, await res.text())
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
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
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
        amount:    Math.round(depositTotal * 100) / 100,
        itemName:  `The Safari Edition — ${bookingRef}`,
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

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

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
      itemName:  `The Safari Edition — ${bookingRef}`,
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
