import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/audit — site-wide health check

export async function GET(req: NextRequest) {
  const checks: any[] = [];

  try {
    const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const MARGINS = {
      hotels:     Number(process.env.MARGIN_HOTELS)     || 0,
      transfers:  Number(process.env.MARGIN_TRANSFERS)  || 0,
      activities: Number(process.env.MARGIN_ACTIVITIES) || 0,
      flights:    Number(process.env.MARGIN_FLIGHTS)    || 0,
    };

    // ── 1. Environment variables ──────────────────────────────────────────────
    const missingEnvs = [
      !SUPABASE_URL           && 'NEXT_PUBLIC_SUPABASE_URL',
      !SERVICE_KEY            && 'SUPABASE_SERVICE_ROLE_KEY',
      !process.env.ANTHROPIC_API_KEY && 'ANTHROPIC_API_KEY',
      !MARGINS.hotels         && 'MARGIN_HOTELS',
    ].filter(Boolean);

    checks.push({
      name:   'Environment variables present',
      status: missingEnvs.length === 0 ? 'pass' : 'fail',
      detail: missingEnvs.length === 0
        ? 'All required env vars set'
        : `Missing: ${missingEnvs.join(', ')}`,
    });

    // Stop here if no DB connection is possible
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        summary: { total: checks.length, passed: 0, failed: checks.length, warned: 0 },
        checks,
        error: 'Cannot connect to database — SUPABASE_URL or SERVICE_KEY missing',
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 2. Margin multipliers ─────────────────────────────────────────────────
    const marginIssues: string[] = [];
    for (const [k, v] of Object.entries(MARGINS)) {
      if (v === 0)    marginIssues.push(`${k}: not set`);
      else if (v < 1.05) marginIssues.push(`${k}: ${v} below floor of 1.05`);
      else if (v > 1.50) marginIssues.push(`${k}: ${v} above ceiling of 1.50`);
    }
    checks.push({
      name:   'Margin multipliers within bounds',
      status: marginIssues.length === 0 ? 'pass' : MARGINS.hotels === 0 ? 'fail' : 'warn',
      detail: marginIssues.length === 0
        ? `H:${MARGINS.hotels} T:${MARGINS.transfers} A:${MARGINS.activities} F:${MARGINS.flights}`
        : marginIssues.join('; '),
    });

    // ── 3. Load suppliers ─────────────────────────────────────────────────────
    const { data: suppliers = [], error: suppErr } = await supabase
      .from('suppliers')
      .select('id, name, net_rate_per_night, display_rate_per_night, is_active, region_slug, trust_score, content_score, images, reels');

    if (suppErr) {
      checks.push({ name: 'Suppliers table accessible', status: 'fail', detail: suppErr.message });
      return respond(checks);
    }

    checks.push({
      name:   'Suppliers table accessible',
      status: 'pass',
      detail: `${suppliers.length} total suppliers loaded`,
    });

    const sActive = (suppliers as any[]).filter(s => s.is_active);

    // ── 4. Display rate below net rate ────────────────────────────────────────
    const badPricing = sActive.filter((s: any) => {
      const net = Number(s.net_rate_per_night) || 0;
      const dsp = Number(s.display_rate_per_night) || 0;
      return net > 0 && dsp > 0 && dsp < net;
    });
    checks.push({
      name:     'No supplier has display rate below net rate',
      status:   badPricing.length === 0 ? 'pass' : 'fail',
      detail:   badPricing.length === 0
        ? `${sActive.length} active suppliers checked`
        : `${badPricing.length} losing money: ${badPricing.slice(0,3).map((s:any) => s.name).join(', ')}`,
      affected: badPricing.length,
    });

    // ── 5. Missing net rate ───────────────────────────────────────────────────
    const noNetRate = sActive.filter((s: any) => !Number(s.net_rate_per_night));
    checks.push({
      name:     'All active suppliers have net rate set',
      status:   noNetRate.length === 0 ? 'pass' : 'fail',
      detail:   noNetRate.length === 0
        ? 'All set'
        : `${noNetRate.length} missing: ${noNetRate.slice(0,3).map((s:any) => s.name).join(', ')}`,
      affected: noNetRate.length,
    });

    // ── 6. Low trust score ────────────────────────────────────────────────────
    const lowTrust = sActive.filter((s: any) => (Number(s.trust_score) || 0) < 50);
    checks.push({
      name:     'No active supplier has trust score below 50',
      status:   lowTrust.length === 0 ? 'pass' : 'warn',
      detail:   lowTrust.length === 0
        ? 'All above 50'
        : `${lowTrust.length} below 50: ${lowTrust.slice(0,3).map((s:any) => s.name).join(', ')}`,
      affected: lowTrust.length,
    });

    // ── 7. Missing images ─────────────────────────────────────────────────────
    const noImages = sActive.filter((s: any) => {
      const imgs = s.images;
      if (!imgs) return true;
      if (typeof imgs === 'string' && imgs.startsWith('http')) return false;
      try {
        const arr = Array.isArray(imgs) ? imgs : JSON.parse(imgs);
        return arr.length === 0;
      } catch { return true; }
    });
    checks.push({
      name:     'All active suppliers have images',
      status:   noImages.length === 0 ? 'pass' : 'warn',
      detail:   noImages.length === 0
        ? 'All have images'
        : `${noImages.length} missing images: ${noImages.slice(0,3).map((s:any) => s.name).join(', ')}`,
      affected: noImages.length,
    });

    // ── 8. Region coverage ────────────────────────────────────────────────────
    const REQUIRED = ['kruger-sabi-sand','okavango-delta','cape-town','madikwe','chobe-vic-falls'];
    const regionsLow = REQUIRED.filter(r => {
      const count = sActive.filter((s: any) => s.region_slug === r).length;
      return count < 2;
    });
    checks.push({
      name:     'Key regions have at least 2 active suppliers',
      status:   regionsLow.length === 0 ? 'pass' : 'warn',
      detail:   regionsLow.length === 0
        ? 'All key regions covered'
        : `Under-supplied: ${regionsLow.join(', ')}`,
      affected: regionsLow.length,
    });

    // ── 9. Knowledge base accessible ─────────────────────────────────────────
    const { data: kbAll = [], error: kbErr } = await supabase
      .from('knowledge_base')
      .select('id, title, destination, supplier_id, tags, is_active')
      .eq('is_active', true)
      .limit(50);

    checks.push({
      name:   'Knowledge base accessible',
      status: kbErr ? 'fail' : 'pass',
      detail: kbErr ? kbErr.message : `${kbAll.length} active KB entries`,
    });

    // ── 10. Curated journeys ──────────────────────────────────────────────────
    const { data: curated = [], error: curErr } = await supabase
      .from('curated_journeys')
      .select('id, name, cities, status, hero_image');

    if (curErr) {
      checks.push({ name: 'Curated journeys table accessible', status: 'fail', detail: curErr.message });
    } else {
      const published = (curated as any[]).filter(j => j.status === 'published');
      const noHero    = published.filter(j => !j.hero_image);
      const supplierIds = new Set(sActive.map((s: any) => String(s.id)));
      let badRef = 0;
      for (const j of published) {
        const ids = (j.cities || []).map((c: any) => c.propertyId).filter(Boolean);
        if (ids.some((id: string) => !supplierIds.has(String(id)))) badRef++;
      }
      checks.push({
        name:     'Curated journeys valid',
        status:   badRef > 0 ? 'fail' : noHero.length > 0 ? 'warn' : 'pass',
        detail:   `${published.length} published · ${badRef} with broken property refs · ${noHero.length} missing hero images`,
        affected: badRef + noHero.length,
      });
    }

    // ── 11. Net rates hidden from anon key ────────────────────────────────────
    if (ANON_KEY) {
      try {
        const anonClient = createClient(SUPABASE_URL, ANON_KEY);
        const { data: row } = await anonClient
          .from('suppliers')
          .select('id, net_rate_per_night')
          .limit(1)
          .maybeSingle();
        const leaked = row != null && row.net_rate_per_night != null;
        checks.push({
          name:   'Net rates hidden from anon key (security)',
          status: leaked ? 'fail' : 'pass',
          detail: leaked
            ? 'NET RATES VISIBLE TO BROWSER — apply RLS SQL immediately'
            : 'RLS correctly hiding net rates from anon key',
        });
      } catch {
        checks.push({
          name:   'Net rates hidden from anon key (security)',
          status: 'warn',
          detail: 'Could not test — check RLS manually in Supabase Table Editor',
        });
      }
    }

    return respond(checks);

  } catch (e: any) {
    checks.push({ name: 'Audit crashed', status: 'fail', detail: e?.message || 'Unknown error' });
    return respond(checks);
  }
}

function respond(checks: any[]) {
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  return NextResponse.json({
    success:   failed === 0,
    timestamp: new Date().toISOString(),
    summary:   { total: checks.length, passed, failed, warned },
    checks,
  });
}
