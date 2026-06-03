import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties?region=kruger-sabi-sand&checkin=2026-07-01&nights=4&pax=2
//
// Returns ranked, scored properties for a given region + context.
// Net rates used internally for scoring — NEVER returned to client.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MARGIN_HOTELS = Number(process.env.MARGIN_HOTELS) || 1.15;

const SEASON: Record<string, { peak: number[]; shoulder: number[] }> = {
  'kruger-sabi-sand': { peak:[6,7,8,9],     shoulder:[4,5,10,11] },
  'okavango-delta':   { peak:[7,8,9,10],    shoulder:[5,6,11]    },
  'cape-town':        { peak:[11,12,1,2,3], shoulder:[10,4,9]    },
  'madikwe':          { peak:[6,7,8,9],     shoulder:[4,5,10,11] },
  'chobe-vic-falls':  { peak:[8,9,10],      shoulder:[6,7,11]    },
  'masai-mara':       { peak:[7,8,9,10],    shoulder:[6,11]      },
  'bwindi':           { peak:[6,7,12,1],    shoulder:[2,3,8,9]   },
};

function seasonal(slug: string, checkIn?: string): number {
  if (!checkIn) return 72;
  const m = new Date(checkIn).getMonth() + 1;
  const s = SEASON[slug];
  if (!s) return 72;
  return s.peak.includes(m) ? 100 : s.shoulder.includes(m) ? 70 : 42;
}

function availConf(pmsType?: string | null): number {
  if (!pmsType) return 55;
  const t = pmsType.toLowerCase();
  return ['resrequest','nightsbridge','opera','rms'].includes(t) ? 100 : t === 'manual' ? 72 : 55;
}

function normGP(gp: number): number {
  return Math.min(100, Math.max(0, Math.round((gp - 1000) / 17000 * 100)));
}

function extractImg(s: any): string {
  let img = '';
  try {
    if (typeof s.images === 'string' && s.images.startsWith('http')) img = s.images;
    else {
      const imgs: any[] = Array.isArray(s.images) ? s.images : (s.images ? JSON.parse(s.images) : []);
      const p = imgs.find(i => i.is_primary && i.status === 'approved') ?? imgs.find(i => i.status === 'approved') ?? imgs[0];
      if (p?.url) img = p.url;
    }
  } catch {}
  return img || s.hero_image || s.cover_image || '';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region  = searchParams.get('region') || '';
  const checkIn = searchParams.get('checkin') || undefined;
  const nights  = Number(searchParams.get('nights')) || 4;
  const pax     = Number(searchParams.get('pax'))    || 2;
  const limit   = Math.min(Number(searchParams.get('limit')) || 8, 20);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let query = supabase
    .from('suppliers')
    .select('id,name,net_rate_per_night,display_rate_per_night,trust_score,content_score,pms_type,region_slug,destination,country,images,hero_image,cover_image,fun_fact,malaria_free,tags,upgrades,reels')
    .eq('is_active', true);

  if (region) query = query.eq('region_slug', region);

  const { data: rows = [], error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Score and rank (uses net_rate internally, never exposed)
  const scored = (rows as any[]).map(s => {
    const net  = Number(s.net_rate_per_night) || 25000;
    const disp = Number(s.display_rate_per_night) || Math.round(net * MARGIN_HOTELS);
    const gp   = disp - net;

    const score = Math.min(100, Math.round(
      (Number(s.trust_score)   || 50) * 0.25 +
      (Number(s.content_score) || 40) * 0.15 +
      normGP(gp)                       * 0.30 +
      seasonal(s.region_slug, checkIn) * 0.20 +
      availConf(s.pms_type)            * 0.10
    ));

    // Upgrade extras — display prices only
    const ups = s.upgrades || {
      rooms:       [{ label:'Standard Suite', extra:0, tier:0 }, { label:'Premium Suite', extra:Math.round(disp*0.35), tier:1 }],
      basis:       [{ label:'All-inclusive',  extra:0, tier:0 }],
      flexibility: [{ label:'Standard',       extra:0, tier:0 }, { label:'Flexible',      extra:Math.round(disp*0.08),  tier:1 }],
    };

    return {
      id:                   s.id,
      name:                 s.name,
      score,
      displayPricePerNight: disp,
      displayPrice:         disp * nights,
      trustScore:           Number(s.trust_score)   || 50,
      contentScore:         Number(s.content_score) || 40,
      destination:          s.destination || '',
      subRegion:            s.region_slug || '',
      country:              s.country || '',
      image:                extractImg(s),
      funFact:              s.fun_fact || '',
      malariaFree:          Boolean(s.malaria_free),
      tags:                 Array.isArray(s.tags) ? s.tags : [],
      upgrades:             ups,
      reelUrl:              s.reels?.[0]?.url || null,
    };
  }).sort((a: any, b: any) => b.score - a.score).slice(0, limit);

  return NextResponse.json({ success: true, properties: scored, count: scored.length });
}
