import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zhkpxmcoklbmpsdcjffb.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_LjKnraC4RwaYLS9F-P-kww_nKljckkn'

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = getSupabase()

    // 1. Save the itinerary
    const insertData: any = {
      title: body.title || 'Safari Journey',
      adults: body.adults || 2,
      infants: body.infants || 0,
      nights: body.nights || 7,
      total_display_zar: body.total_display_zar || 0,
      total_net_zar: body.total_net_zar || 0,
      status: 'quote',
    }
    if (body.children_ages) insertData.children_ages = body.children_ages
    if (body.check_in) insertData.date_from = body.check_in
    if (body.check_out) insertData.date_to = body.check_out
    if (body.budget_zar) insertData.budget_zar = body.budget_zar

    const { data: itinerary, error: iErr } = await supabase
      .from('itineraries')
      .insert(insertData)
      .select('id, share_token')
      .single()

    if (iErr) {
      return NextResponse.json({ success: false, error: iErr.message }, { status: 500 })
    }

    // 2. Save components to itinerary_components if provided
    if (body.components && body.components.length > 0) {
      const componentRows = body.components.map((c: any, idx: number) => ({
        itinerary_id: itinerary.id,
        pillar: c.pillar || 'hotel',
        sequence: idx + 1,
        supplier_id: c.supplier_id || null,
        net_rate_zar: c.net_rate_zar || 0,
        display_rate_zar: c.display_rate_zar || 0,
        margin_pct: c.margin_pct || 15,
        status: 'pending',
        notes: c.name || c.label || null,
      }))

      const { error: cErr } = await supabase
        .from('itinerary_components')
        .insert(componentRows)

      if (cErr) {
        console.error('Component save error:', cErr.message)
        // Don't fail the whole request — itinerary was saved successfully
      }
    }

    return NextResponse.json({
      success: true,
      id: itinerary.id,
      code: itinerary.share_token
    })

  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const id = req.nextUrl.searchParams.get('id')
  const supabase = getSupabase()

  try {
    let itinerary: any = null

    if (id) {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      itinerary = data
    } else if (code) {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('share_token', code)
        .single()
      if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      itinerary = data
    } else {
      return NextResponse.json({ error: 'code or id required' }, { status: 400 })
    }

    // Fetch components with supplier details
    const { data: components } = await supabase
      .from('itinerary_components')
      .select(`
        *,
        suppliers (
          id, name, type, destination, country,
          hero_image_url, hero_video_url,
          tagline, description_short,
          cancellation_policy,
          trust_score, content_score
        )
      `)
      .eq('itinerary_id', itinerary.id)
      .order('sequence')

    // Fetch traveller name from booking if exists
    const { data: booking } = await supabase
      .from('bookings')
      .select('lead_traveller_snapshot, booking_reference, status')
      .eq('itinerary_id', itinerary.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      success: true,
      itinerary: {
        ...itinerary,
        components: components || [],
        booking: booking || null,
      }
    })

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}