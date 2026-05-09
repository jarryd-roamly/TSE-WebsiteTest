import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zhkpxmcoklbmpsdcjffb.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_LjKnraC4RwaYLS9F-P-kww_nKljckkn'

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

function buildPayFastUrl(params: {
  amount: number
  itemName: string
  bookingRef: string
  email: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
}) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100'
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a'
  const passphrase = process.env.PAYFAST_PASSPHRASE || ''

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    notify_url: params.notifyUrl,
    email_address: params.email,
    m_payment_id: params.bookingRef,
    amount: params.amount.toFixed(2),
    item_name: params.itemName,
    custom_str1: params.bookingRef,
  }

  const sigString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&')

  const sigWithPassphrase = passphrase
    ? `${sigString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : sigString

  const signature = crypto.createHash('md5').update(sigWithPassphrase).digest('hex')

  return `https://sandbox.payfast.co.za/eng/process?${sigString}&signature=${signature}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { itinerary_id, traveller_email, traveller_name } = body

    if (!itinerary_id || !traveller_email) {
      return NextResponse.json(
        { success: false, error: 'Missing itinerary_id or traveller_email' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    const { data: itinerary, error: iErr } = await supabase
      .from('itineraries')
      .select('*')
      .eq('id', itinerary_id)
      .single()

    if (iErr || !itinerary) {
      return NextResponse.json(
        { success: false, error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    const totalAmount = itinerary.total_display_zar || 0
    const depositAmount = Math.round(totalAmount * 0.30 * 100) / 100
    const balanceAmount = Math.round((totalAmount - depositAmount) * 100) / 100

    const bookingRef = 'TSE-' + Math.random().toString(36).substring(2, 10).toUpperCase()

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        itinerary_id,
        booking_reference: bookingRef,
        status: 'pending_payment',
        total_display_zar: totalAmount,
        total_paid_zar: 0,
        outstanding_zar: totalAmount,
        currency_paid: 'ZAR',
        lead_traveller_snapshot: {
          name: traveller_name || '',
          email: traveller_email
        },
        booked_at: new Date().toISOString(),
      })
      .select('id, booking_reference')
      .single()

    if (bErr) {
      return NextResponse.json(
        { success: false, error: bErr.message },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const payfastUrl = buildPayFastUrl({
      amount: depositAmount,
      itemName: `The Safari Edition — ${bookingRef}`,
      bookingRef,
      email: traveller_email,
      returnUrl: `${baseUrl}/booking/confirmed?ref=${bookingRef}`,
      cancelUrl: `${baseUrl}/booking/cancelled?ref=${bookingRef}`,
      notifyUrl: `${baseUrl}/api/payfast/notify`,
    })

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      booking_ref: booking.booking_reference,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      total_amount: totalAmount,
      payfast_url: payfastUrl,
    })

  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Server error' },
      { status: 500 }
    )
  }
}