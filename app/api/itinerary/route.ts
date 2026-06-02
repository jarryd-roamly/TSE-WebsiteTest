// app/api/itinerary/route.ts
// POST: saves draft itinerary to `itineraries` table. Returns { success, id }.
// GET:  reads itinerary by ?id=UUID (checkout) or ?code=TSE-XXXX (journey mini-site).
//
// Supabase `itineraries` table needs these columns:
//   id uuid PK, idempotency_key text, edition_id text, state text,
//   title text, adults int, children_count int, nights int,
//   check_in text, check_out text, total_display_zar numeric,
//   total_net_zar numeric, budget_zar numeric, components jsonb,
//   input_mode text, created_at timestamptz

import { NextRequest, NextResponse } from 'next/server';

function getKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
}
function getUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const id   = req.nextUrl.searchParams.get('id');
    const code = req.nextUrl.searchParams.get('code');

    if (!id && !code) {
      return NextResponse.json({ success: false, error: 'id or code required' }, { status: 400 });
    }

    const url = getUrl();
    const key = getKey();

    if (id) {
      // Checkout page: load draft itinerary by UUID
      const res = await fetch(
        `${url}/rest/v1/itineraries?id=eq.${id}&select=*&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      const rows = await res.json();
      if (!rows?.length) {
        return NextResponse.json({ success: false, error: 'Itinerary not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, itinerary: rows[0] });
    }

    if (code) {
      // Journey mini-site: load confirmed booking by booking_reference
      const res = await fetch(
        `${url}/rest/v1/bookings?booking_reference=eq.${code}&select=*&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      const rows = await res.json();
      if (!rows?.length) {
        return NextResponse.json({ success: false, error: 'Journey not found' }, { status: 404 });
      }
      // Enrich with itinerary data if available
      const booking = rows[0];
      if (booking.itinerary_id) {
        const iRes = await fetch(
          `${url}/rest/v1/itineraries?id=eq.${booking.itinerary_id}&select=*&limit=1`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } }
        );
        const iRows = await iRes.json();
        if (iRows?.length) {
          return NextResponse.json({ success: true, itinerary: { ...iRows[0], booking } });
        }
      }
      return NextResponse.json({ success: true, itinerary: booking });
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const booking = await req.json();
    const url = getUrl();
    const key = getKey();

    // Idempotency: return existing record if same key already saved
    const existing = await fetch(
      `${url}/rest/v1/itineraries?idempotency_key=eq.${booking.idempotency_key}&select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await existing.json();
    if (rows?.length > 0) {
      return NextResponse.json({ success: true, id: rows[0].id, duplicate: true });
    }

    // Save draft itinerary
    const res = await fetch(`${url}/rest/v1/itineraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ ...booking, created_at: new Date().toISOString() }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data?.message || 'Save failed' }, { status: 400 });
    }
    return NextResponse.json({ success: true, id: data[0]?.id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
