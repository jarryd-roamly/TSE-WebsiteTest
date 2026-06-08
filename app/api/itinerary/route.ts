// app/api/itinerary/route.ts
// POST: saves draft itinerary to `itineraries` table. Returns { success, id }.
// GET:  reads itinerary by ?id=UUID (checkout) or ?code=TSE-XXXX (journey mini-site).
//
// FIX: POST now uses an explicit column whitelist instead of spreading the full
//      request body. This prevents unknown fields (deposit_zar, etc.) from ever
//      reaching Supabase and causing schema cache errors — regardless of what
//      the client sends.
//
// Supabase `itineraries` table columns:
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
      const res = await fetch(
        `${url}/rest/v1/bookings?booking_reference=eq.${code}&select=*&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      const rows = await res.json();
      if (!rows?.length) {
        return NextResponse.json({ success: false, error: 'Journey not found' }, { status: 404 });
      }
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
    const body = await req.json();
    const url  = getUrl();
    const key  = getKey();

    // Idempotency: return existing record if same key already saved
    const existing = await fetch(
      `${url}/rest/v1/itineraries?idempotency_key=eq.${body.idempotency_key}&select=id&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await existing.json();
    if (rows?.length > 0) {
      return NextResponse.json({ success: true, id: rows[0].id, duplicate: true });
    }

    // ── EXPLICIT WHITELIST — only known columns reach Supabase ──────────────
    // This prevents any unknown field (deposit_zar, depositZar, etc.) from
    // causing a schema cache error, regardless of what the client sends.
    const record = {
      idempotency_key:   body.idempotency_key   ?? null,
      edition_id:        body.edition_id         ?? null,
      state:             body.state              ?? 'quote',
      title:             body.title              ?? null,
      adults:            body.adults             ?? 2,
      children_count:    body.children_count     ?? 0,
      nights:            body.nights             ?? 0,
      check_in:          body.check_in           ?? null,
      check_out:         body.check_out          ?? null,
      total_display_zar: body.total_display_zar  ?? 0,
      total_net_zar:     body.total_net_zar      ?? 0,
      budget_zar:        body.budget_zar         ?? 0,
      components:        body.components         ?? [],
      input_mode:        body.input_mode         ?? null,
      created_at:        new Date().toISOString(),
    };

    const res = await fetch(`${url}/rest/v1/itineraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data?.message || 'Save failed' },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, id: data[0]?.id });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
