// app/api/itinerary-margin-audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auditItinerary } from '@/app/lib/pricingEngine';

export async function POST(req: NextRequest) {
  try {
    const { lines, budgetZar, candidates } = await req.json();
    
    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json({ success: false, error: 'lines array required' }, { status: 400 });
    }

    // Margins — read from env or use defaults
    const M = {
      flights: parseFloat(process.env.MARGIN_FLIGHTS || '1.08'),
      hotels: parseFloat(process.env.MARGIN_HOTELS || '1.15'),
      transfers: parseFloat(process.env.MARGIN_TRANSFERS || '1.20'),
      activities: parseFloat(process.env.MARGIN_ACTIVITIES || '1.18'),
    };

    // Audit the itinerary
    const audit = auditItinerary({
      lines: lines.map((l: any) => ({
        pillar: l.pillar || 'hotel',
        name: l.name || 'Unnamed',
        netZar: parseFloat(l.net_rate_zar) || 0,
        displayZar: parseFloat(l.display_rate_zar) || 0,
        nights: parseFloat(l.nights) || 1,
        source: l.inclusion_source || 'fallback',
      })),
      budgetZar: parseFloat(budgetZar) || 600000,
      margins: M,
      candidates: candidates || [],
    });

    return NextResponse.json({ success: true, audit });
  } catch (error: any) {
    console.error('Audit error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
