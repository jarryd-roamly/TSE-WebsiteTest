import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/kb-tips?regions=okavango-delta,chobe-vic-falls&theme=adventure&propertyIds=42,67
//
// Returns Knowledge Base entries filtered by:
//   - regions in the actual itinerary
//   - properties in the itinerary
//   - theme (honeymoon/family/etc) — drives tag matching
//
// FIXES BUG #10: previously the system showed a "Sabi Sand tip" on an
// Okavango + Vic Falls itinerary because there was no filtering by region.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const regions     = (searchParams.get('regions')     || '').split(',').filter(Boolean);
  const propertyIds = (searchParams.get('propertyIds') || '').split(',').filter(Boolean);
  const theme       = searchParams.get('theme') || '';
  const limit       = Math.min(Number(searchParams.get('limit')) || 6, 20);

  if (regions.length === 0 && propertyIds.length === 0) {
    return NextResponse.json({ success: false, error: 'Must provide regions or propertyIds' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Property-specific KB entries (highest priority) ─────────────────────────
  const propertyTips: any[] = [];
  if (propertyIds.length > 0) {
    const { data = [] } = await supabase
      .from('knowledge_base')
      .select('id, type, title, linked_to, structured_fields, specialist_notes, region_slug, property_id, tags')
      .eq('active', true)
      .eq('edition_id', 'safari')
      .in('property_id', propertyIds)
      .neq('type', 'trade_tip')
      .limit(8);

    propertyTips.push(...(data || []).map((k: any) => ({ ...k, source: 'property', priority: 1 })));
  }

  // ── Region-specific KB entries ──────────────────────────────────────────────
  const regionTips: any[] = [];
  if (regions.length > 0) {
    const { data = [] } = await supabase
      .from('knowledge_base')
      .select('id, type, title, linked_to, structured_fields, specialist_notes, region_slug, property_id, tags')
      .eq('active', true)
      .eq('edition_id', 'safari')
      .in('region_slug', regions)
      .neq('type', 'trade_tip')
      .limit(10);

    regionTips.push(...(data || [])
      .filter((k: any) => !propertyTips.find(p => p.id === k.id))
      .map((k: any) => ({ ...k, source: 'region', priority: 2 })));
  }

  // ── Theme-tagged entries (cross-region) ─────────────────────────────────────
  const themeTips: any[] = [];
  if (theme) {
    const { data = [] } = await supabase
      .from('knowledge_base')
      .select('id, type, title, linked_to, structured_fields, specialist_notes, region_slug, property_id, tags')
      .eq('active', true)
      .eq('edition_id', 'safari')
      .contains('tags', [theme])
      .neq('type', 'trade_tip')
      .limit(6);

    themeTips.push(...(data || [])
      .filter((k: any) => !propertyTips.find(p => p.id === k.id) && !regionTips.find(r => r.id === k.id))
      // ALSO must match a region in the itinerary if region_slug is set
      .filter((k: any) => !k.region_slug || regions.includes(k.region_slug))
      .map((k: any) => ({ ...k, source: 'theme', priority: 3 })));
  }

  // ── Combine, sort by priority, limit ─────────────────────────────────────────
  const all = [...propertyTips, ...regionTips, ...themeTips]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    tips: all,
    breakdown: {
      property: propertyTips.length,
      region:   regionTips.length,
      theme:    themeTips.length,
    },
  });
}
