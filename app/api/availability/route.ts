// app/api/availability/route.ts
// Availability check endpoint.
// Phase 1: returns optimistic demo data (Tier 1 manual suppliers).
// Phase 2: wire to ResRequest / Nightsbridge PMS per supplier tier.
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { supplier_id, check_in, nights, pax } = await req.json();

  // TODO Phase 2: route to PMS API based on supplier.pms_type
  // For now: Tier 1 (manual) — all available, confirmation within 2 hours
  return NextResponse.json({
    success: true,
    result: {
      supplier_id,
      check_in,
      available: true,
      source: 'demo',
      options: [
        {
          label: 'Standard Suite',
          available: true,
          rate_zar: 0, // actual rate fetched from supplier record
          display_rate_zar: 0,
          meal_basis: 'All-inclusive',
        },
      ],
      response_ms: 120,
    },
  });
}