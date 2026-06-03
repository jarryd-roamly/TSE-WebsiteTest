import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/price-package
//
// Receives property selections. Returns display prices ONLY.
// Net rates and margin multipliers NEVER leave this function.
// Used by the builder screen for live grand total updates.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Margins from env — never in client bundle
const M = {
  hotels:     Number(process.env.MARGIN_HOTELS)     || 1.15,
  transfers:  Number(process.env.MARGIN_TRANSFERS)  || 1.20,
  activities: Number(process.env.MARGIN_ACTIVITIES) || 1.18,
  flights:    Number(process.env.MARGIN_FLIGHTS)    || 1.08,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      selections,     // [{propertyId, nights, upgrades:{rooms,basis,flexibility}}]
      activities = [], // [{activityId}]
      transferIds = {},
      adults = 2,
      children = 0,
    } = body;

    if (!Array.isArray(selections) || !selections.length) {
      return NextResponse.json({ success: false, error: 'No selections provided' }, { status: 400 });
    }

    const supabase   = createClient(SUPABASE_URL, SERVICE_KEY);
    const propertyIds = selections.map((s: any) => s.propertyId).filter(Boolean);

    // ── Load supplier rows (with net rates) ───────────────────────────────────
    const { data: supplierRows = [] } = await supabase
      .from('suppliers')
      .select('id, name, net_rate_per_night, display_rate_per_night, upgrades')
      .in('id', propertyIds);

    const suppMap = new Map(supplierRows.map((s: any) => [String(s.id), s]));

    // ── Calculate lodge cost ──────────────────────────────────────────────────
    let lodgeCost    = 0;
    const components: any[] = [];

    for (const sel of selections) {
      const s = suppMap.get(String(sel.propertyId));
      if (!s) continue;

      const net  = Number(s.net_rate_per_night) || 25000;
      const disp = Number(s.display_rate_per_night) || Math.round(net * M.hotels);

      // Apply upgrade extras (stored as display price additions, not net additions)
      const ups = sel.upgrades || {};
      const upgrades = s.upgrades || {};
      let upgradeExtra = 0;
      for (const [key, tierNum] of Object.entries(ups)) {
        const opts: any[] = (upgrades as any)[key] || [];
        const opt = opts.find((o: any) => o.tier === tierNum) ?? opts[0];
        if (opt?.extra) upgradeExtra += opt.extra;
      }

      const lineCost = (disp + upgradeExtra) * sel.nights;
      lodgeCost += lineCost;

      components.push({
        type:             'lodge',
        propertyId:       String(s.id),
        propertyName:     s.name,
        nights:           sel.nights,
        displayPerNight:  disp,
        upgradeExtra,
        lineTotal:        lineCost,
      });
    }

    // ── Activity cost ─────────────────────────────────────────────────────────
    let activityCost = 0;
    if (activities.length > 0) {
      const activityIds = activities.map((a: any) => a.activityId).filter(Boolean);
      const { data: actRows = [] } = await supabase
        .from('activities')
        .select('id, name, net_rate, currency')
        .in('id', activityIds);

      for (const act of actRows as any[]) {
        const netZAR = Number(act.net_rate) || 0;
        const dispZAR = Math.round(netZAR * M.activities);
        activityCost += dispZAR;
        components.push({ type: 'activity', name: act.name, lineTotal: dispZAR });
      }
    }

    const displayTotal  = lodgeCost + activityCost;
    const depositAmount = Math.round(displayTotal * 0.30);
    const balanceAmount = displayTotal - depositAmount;

    return NextResponse.json({
      success:      true,
      displayTotal,
      depositAmount,
      balanceAmount,
      lodgeCost,
      activityCost,
      components,    // line items for display — no net rates included
    });

  } catch (e: any) {
    console.error('[price-package]', e?.message);
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
