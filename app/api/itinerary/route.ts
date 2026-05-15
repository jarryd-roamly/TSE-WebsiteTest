// app/api/itinerary/route.ts
// Saves BookingIntent to Supabase with idempotency check.
// Returns { success, id } for checkout redirect.
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const booking = await req.json();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Idempotency: check if this key already exists
    const existing = await fetch(
      `${url}/rest/v1/bookings?idempotency_key=eq.${booking.idempotency_key}&select=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await existing.json();
    if (rows?.length > 0) {
      return NextResponse.json({ success: true, id: rows[0].id, duplicate: true });
    }

    const res = await fetch(`${url}/rest/v1/bookings`, {
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
    if (!res.ok) return NextResponse.json({ success: false, error: data.message }, { status: 400 });
    return NextResponse.json({ success: true, id: data[0]?.id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}