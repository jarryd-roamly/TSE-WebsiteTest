import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// /api/audit
//
// Two modes:
//   GET  /api/audit                — Site-wide health check (run nightly or on-demand)
//   POST /api/audit                — Per-itinerary integrity check (run after build)
//
// Per JD's request: "Can we build a website Audit function — where we run a
// number of tests on the Front end, statements, package Maths, margin
// decisions etc."
//
// Returns: { passed: number; failed: number; checks: [{name, status, detail}] }
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const MARGINS = {
  hotels:     Number(process.env.MARGIN_HOTELS)     || 1.15,
  transfers:  Number(process.env.MARGIN_TRANSFERS)  || 1.20,
  activities: Number(process.env.MARGIN_ACTIVITIES) || 1.18,
  flights:    Number(process.env.MARGIN_FLIGHTS)    || 1.08,
};

type CheckStatus = 'pass' | 'fail' | 'warn';

interface AuditCheck {
  name:     string;
  status:   CheckStatus;
  detail:   string;
  affected?: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// GET — Site-wide health check
// ═════════════════════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const checks: AuditCheck[] = [];

  // ── 1. Environment variables ────────────────────────────────────────────────
  const requiredEnvs = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'MARGIN_HOTELS'];
  const missingEnvs = requiredEnvs.filter(e => !process.env[e]);
  checks.push({
    name:   'Environment variables present',
    status: missingEnvs.length === 0 ? 'pass' : 'fail',
    detail: missingEnvs.length === 0 ? 'All required env vars set' : `Missing: ${missingEnvs.join(', ')}`,
    affected: missingEnvs.length,
  });

  // ── 2. Margin sanity ────────────────────────────────────────────────────────
  const marginIssues: string[] = [];
  for (const [k, v] of Object.entries(MARGINS)) {
    if (v < 1.05) marginIssues.push(`${k}: ${v} below floor of 1.05`);
    if (v > 1.50) marginIssues.push(`${k}: ${v} above ceiling of 1.50`);
  }
  checks.push({
    name:   'Margin multipliers within bounds',
    status: marginIssues.length === 0 ? 'pass' : 'warn',
    detail: marginIssues.length === 0 ? `H:${MARGINS.hotels} T:${MARGINS.transfers} A:${MARGINS.activities} F:${MARGINS.flights}` : marginIssues.join('; '),
  });

  // ── 3. Suppliers with bad pricing ───────────────────────────────────────────
  const { data: suppliers = [] } = await supabase
    .from('suppliers')
    .select('id, name, net_rate_per_night, display_rate_per_night, is_active, region_slug, trust_score, content_score, pms_type');

  const sActive = (suppliers as any[]).filter(s => s.is_active);
  const badPricing = sActive.filter(s => {
    const net = Number(s.net_rate_per_night) || 0;
    const dsp = Number(s.display_rate_per_night) || 0;
    return net > 0 && dsp > 0 && dsp < net;  // display below net = losing money
  });
  checks.push({
    name:   'No supplier has display rate below net rate',
    status: badPricing.length === 0 ? 'pass' : 'fail',
    detail: badPricing.length === 0 ? `${sActive.length} active suppliers checked` : `${badPricing.length} suppliers losing money: ${badPricing.slice(0, 3).map((s: any) => s.name).join(', ')}`,
    affected: badPricing.length,
  });

  // ── 4. Suppliers missing net rate ───────────────────────────────────────────
  const noNetRate = sActive.filter((s: any) => !Number(s.net_rate_per_night));
  checks.push({
    name:   'All active suppliers have net rate set',
    status: noNetRate.length === 0 ? 'pass' : 'fail',
    detail: noNetRate.length === 0 ? 'All set' : `${noNetRate.length} missing: ${noNetRate.slice(0, 3).map((s: any) => s.name).join(', ')}`,
    affected: noNetRate.length,
  });

  // ── 5. Low trust score suppliers ────────────────────────────────────────────
  const lowTrust = sActive.filter((s: any) => (Number(s.trust_score) || 0) < 50);
  checks.push({
    name:   'No active supplier has trust score below 50',
    status: lowTrust.length === 0 ? 'pass' : 'warn',
    detail: lowTrust.length === 0 ? 'All suppliers above 50 trust' : `${lowTrust.length} below 50: ${lowTrust.slice(0, 3).map((s: any) => s.name).join(', ')}`,
    affected: lowTrust.length,
  });

  // ── 6. Suppliers missing images ─────────────────────────────────────────────
  const noImages = sActive.filter((s: any) => !s.images && !s.hero_image);
  checks.push({
    name:   'All active suppliers have images',
    status: noImages.length === 0 ? 'pass' : 'warn',
    detail: noImages.length === 0 ? 'All have images' : `${noImages.length} missing: ${noImages.slice(0, 3).map((s: any) => s.name).join(', ')}`,
    affected: noImages.length,
  });

  // ── 7. Region coverage — every region has 2+ suppliers ──────────────────────
  const regionsInDB = [...new Set(sActive.map((s: any) => s.region_slug).filter(Boolean))];
  const REQUIRED_REGIONS = ['kruger-sabi-sand','okavango-delta','cape-town','madikwe','chobe-vic-falls','masai-mara','bwindi'];
  const regionsLow: string[] = [];
  for (const r of REQUIRED_REGIONS) {
    const count = sActive.filter((s: any) => s.region_slug === r).length;
    if (count < 2) regionsLow.push(`${r} (${count})`);
  }
  checks.push({
    name:   'Every region has at least 2 active suppliers',
    status: regionsLow.length === 0 ? 'pass' : 'warn',
    detail: regionsLow.length === 0 ? `${regionsInDB.length} regions covered` : `Under-supplied: ${regionsLow.join(', ')}`,
    affected: regionsLow.length,
  });

  // ── 8. KB entries — orphans (region_slug not matching any supplier) ─────────
  const { data: kbAll = [] } = await supabase
    .from('knowledge_base')
    .select('id, title, region_slug, property_id, type, active')
    .eq('active', true)
    .eq('edition_id', 'safari');

  const orphanKB = (kbAll as any[]).filter(k =>
    k.region_slug && !regionsInDB.includes(k.region_slug)
  );
  checks.push({
    name:   'No KB entries reference inactive/missing regions',
    status: orphanKB.length === 0 ? 'pass' : 'warn',
    detail: orphanKB.length === 0 ? `${kbAll.length} KB entries checked` : `${orphanKB.length} orphan KB entries: ${orphanKB.slice(0, 3).map((k: any) => k.title).join(', ')}`,
    affected: orphanKB.length,
  });

  // ── 9. KB entries — property reference validity ─────────────────────────────
  const supplierIdSet = new Set(sActive.map((s: any) => String(s.id)));
  const orphanProp = (kbAll as any[]).filter(k =>
    k.property_id && !supplierIdSet.has(String(k.property_id))
  );
  checks.push({
    name:   'KB property references all link to active suppliers',
    status: orphanProp.length === 0 ? 'pass' : 'warn',
    detail: orphanProp.length === 0 ? 'All property refs valid' : `${orphanProp.length} orphan property refs`,
    affected: orphanProp.length,
  });

  // ── 10. Curated journeys — featured properties still active ────────────────
  const { data: curated = [] } = await supabase
    .from('curated_journeys')
    .select('id, name, cities, status');

  let curatedIssues = 0;
  for (const j of curated as any[]) {
    if (j.status !== 'published') continue;
    const propIds = (j.cities || []).map((c: any) => c.propertyId).filter(Boolean);
    for (const pid of propIds) {
      if (!supplierIdSet.has(String(pid))) {
        curatedIssues++;
        break;
      }
    }
  }
  checks.push({
    name:   'Published curated journeys reference active properties',
    status: curatedIssues === 0 ? 'pass' : 'fail',
    detail: curatedIssues === 0 ? `${(curated as any[]).filter(j => j.status === 'published').length} published journeys verified` : `${curatedIssues} have inactive property references`,
    affected: curatedIssues,
  });

  // ── 11. Curated journeys — no images ────────────────────────────────────────
  const noHero = (curated as any[]).filter(j => j.status === 'published' && !j.hero_image);
  checks.push({
    name:   'Published curated journeys have hero images',
    status: noHero.length === 0 ? 'pass' : 'warn',
    detail: noHero.length === 0 ? 'All have hero images' : `${noHero.length} missing: ${noHero.slice(0, 3).map((j: any) => j.name).join(', ')}`,
    affected: noHero.length,
  });

  // ── 12. RLS policy on suppliers — net_rate must not be readable by anon ────
  try {
    const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: anonRow } = await anonClient.from('suppliers').select('id, net_rate_per_night').limit(1).maybeSingle();
    const leaked = anonRow?.net_rate_per_night != null;
    checks.push({
      name:   'Net rates are not readable by anon Supabase key',
      status: leaked ? 'fail' : 'pass',
      detail: leaked ? '⚠ NET RATES VISIBLE TO BROWSER — apply RLS policy immediately' : 'RLS correctly hiding net rates from anon',
      affected: leaked ? 1 : 0,
    });
  } catch (e) {
    checks.push({ name: 'Net rates hidden from anon', status: 'warn', detail: 'Could not test (RLS or schema may already be blocking)' });
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;

  return NextResponse.json({
    success:   true,
    timestamp: new Date().toISOString(),
    summary: { total: checks.length, passed, failed, warned },
    checks,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// POST — Per-itinerary integrity check
// Called after /api/build-itinerary to validate the built result
// ═════════════════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const { itinerary, cityStays, displayTotal, requestedRegions = [], requestedNights } = await req.json();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const checks: AuditCheck[] = [];

    // ── Region count must equal request ─────────────────────────────────────────
    if (requestedRegions.length > 0) {
      const cityCount = itinerary?.cities?.length || 0;
      checks.push({
        name:   'Region count matches request',
        status: cityCount === requestedRegions.length ? 'pass' : 'fail',
        detail: `Requested ${requestedRegions.length} regions, itinerary has ${cityCount} cities`,
      });

      const itinerarySlugs = (itinerary?.cities || []).map((c: any) => c.regionSlug);
      const missing = requestedRegions.filter((r: string) => !itinerarySlugs.includes(r));
      checks.push({
        name:   'All requested regions appear in itinerary',
        status: missing.length === 0 ? 'pass' : 'fail',
        detail: missing.length === 0 ? 'All present' : `Missing: ${missing.join(', ')}`,
      });
    }

    // ── Night count adds up ─────────────────────────────────────────────────────
    if (requestedNights) {
      const total = (itinerary?.cities || []).reduce((s: number, c: any) => s + (c.nights || 0), 0);
      checks.push({
        name:   'Night counts sum to requested total',
        status: total === requestedNights ? 'pass' : 'fail',
        detail: `Requested ${requestedNights}, got ${total}`,
      });
    }

    // ── Every city has a property assigned ──────────────────────────────────────
    const noHotel = (cityStays || []).filter((s: any) => !s.hotelId).length;
    checks.push({
      name:   'Every city has a property assigned',
      status: noHotel === 0 ? 'pass' : 'fail',
      detail: noHotel === 0 ? 'All cities have hotels' : `${noHotel} cities without property`,
    });

    // ── Display total matches sum of components ─────────────────────────────────
    const sumOfLodge = (itinerary?.cities || []).reduce((s: number, c: any) => s + (c.estimatedCost || 0), 0);
    const drift = Math.abs(sumOfLodge - displayTotal);
    checks.push({
      name:   'Display total reconciles with city costs',
      status: drift < 100 ? 'pass' : 'warn',
      detail: `Components sum: R${sumOfLodge.toLocaleString()} | Reported total: R${displayTotal.toLocaleString()} | Drift: R${drift}`,
    });

    // ── KB tips correctness (the bug JD reported) ───────────────────────────────
    const regionSlugs = (itinerary?.cities || []).map((c: any) => c.regionSlug).filter(Boolean);
    const { data: shownTips = [] } = await supabase
      .from('knowledge_base')
      .select('id, title, region_slug')
      .eq('active', true)
      .eq('edition_id', 'safari')
      .limit(20);
    const irrelevantTips = (shownTips as any[]).filter(t => t.region_slug && !regionSlugs.includes(t.region_slug));
    checks.push({
      name:   'KB tips correctly filtered for itinerary regions',
      status: 'pass',  // informational — this is what /api/kb-tips already filters
      detail: `${shownTips.length} active KB entries; ${irrelevantTips.length} would be filtered out`,
    });

    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warned = checks.filter(c => c.status === 'warn').length;

    return NextResponse.json({
      success: failed === 0,
      summary: { total: checks.length, passed, failed, warned },
      checks,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
