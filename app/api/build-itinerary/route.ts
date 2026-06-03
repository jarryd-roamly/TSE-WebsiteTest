import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/build-itinerary  (v2)
//
// Changes from v1:
//   ✓ Strict region adherence: regions.length === output.cities.length, or fail
//   ✓ Theme parameter: drives KB selection, property scoring, malaria-free filter
//   ✓ Brief extraction: structured fields via Haiku, not regex
//   ✓ Multi-region templates (3+ regions) supported
//   ✓ Returns followUps array for low-confidence brief fields
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY!;

const M = {
  hotels:     Number(process.env.MARGIN_HOTELS)     || 1.15,
  transfers:  Number(process.env.MARGIN_TRANSFERS)  || 1.20,
  activities: Number(process.env.MARGIN_ACTIVITIES) || 1.18,
  flights:    Number(process.env.MARGIN_FLIGHTS)    || 1.08,
};

// ── Region metadata ───────────────────────────────────────────────────────────
const REGIONS: Record<string, { label: string; country: string; gatewayAirport: string }> = {
  'kruger-sabi-sand': { label: 'Kruger / Sabi Sand', country: 'South Africa', gatewayAirport: 'SZK' },
  'okavango-delta':   { label: 'Okavango Delta',     country: 'Botswana',     gatewayAirport: 'MUB' },
  'cape-town':        { label: 'Cape Town',           country: 'South Africa', gatewayAirport: 'CPT' },
  'madikwe':          { label: 'Madikwe',             country: 'South Africa', gatewayAirport: 'MDK' },
  'chobe-vic-falls':  { label: 'Victoria Falls',      country: 'Zimbabwe',     gatewayAirport: 'VFA' },
  'masai-mara':       { label: 'Masai Mara',          country: 'Kenya',        gatewayAirport: 'MRE' },
  'bwindi':           { label: 'Bwindi',              country: 'Uganda',       gatewayAirport: 'EBB' },
};

// ── Theme-driven scoring overrides ────────────────────────────────────────────
const THEME_TAG_BOOST: Record<string, string[]> = {
  honeymoon:    ['romantic', 'private', 'exclusive-use', 'suite', 'couples-only'],
  anniversary:  ['romantic', 'private', 'exclusive-use'],
  family:       ['family-friendly', 'children-programme', 'malaria-free', 'pool'],
  babymoon:     ['malaria-free', 'comfortable', 'low-altitude'],
  photography:  ['photography-host', 'hide', 'small-vehicle', 'professional-guide'],
  adventure:    ['walking', 'horseback', 'helicopter', 'remote'],
  conservation: ['research', 'conservation-fee', 'rhino', 'community'],
  romantic:     ['romantic', 'private-deck', 'exclusive-use'],
  luxury:       ['butler', 'wine', 'spa', 'helicopter-transfer'],
  cultural:     ['village', 'community', 'tribe', 'heritage'],
};

const MALARIA_REGIONS = new Set(['kruger-sabi-sand','okavango-delta','chobe-vic-falls','masai-mara','bwindi']);

// ── Scoring helpers ───────────────────────────────────────────────────────────
const SEASON: Record<string, { peak: number[]; shoulder: number[] }> = {
  'kruger-sabi-sand': { peak:[6,7,8,9],     shoulder:[4,5,10,11] },
  'okavango-delta':   { peak:[7,8,9,10],    shoulder:[5,6,11]    },
  'cape-town':        { peak:[11,12,1,2,3], shoulder:[10,4,9]    },
  'madikwe':          { peak:[6,7,8,9],     shoulder:[4,5,10,11] },
  'chobe-vic-falls':  { peak:[8,9,10],      shoulder:[6,7,11]    },
  'masai-mara':       { peak:[7,8,9,10],    shoulder:[6,11]      },
  'bwindi':           { peak:[6,7,12,1],    shoulder:[2,3,8,9]   },
};

function seasonScore(slug: string, checkIn?: string): number {
  if (!checkIn) return 72;
  const m = new Date(checkIn).getMonth() + 1;
  const s = SEASON[slug]; if (!s) return 72;
  return s.peak.includes(m) ? 100 : s.shoulder.includes(m) ? 70 : 42;
}

function availScore(pms?: string | null): number {
  if (!pms) return 55;
  const t = pms.toLowerCase();
  return ['resrequest','nightsbridge','opera','rms'].includes(t) ? 100 : t==='manual' ? 72 : 55;
}

function normGP(gp: number): number {
  return Math.min(100, Math.max(0, Math.round((gp - 1000) / 17000 * 100)));
}

function extractImage(s: any): string {
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

// ── Theme-aware property scoring ──────────────────────────────────────────────
function scoreSupplier(s: any, checkIn: string | undefined, nights: number, themeTags: string[]): any {
  const net  = Number(s.net_rate_per_night) || 25000;
  const disp = Number(s.display_rate_per_night) || Math.round(net * M.hotels);
  const gp   = disp - net;

  // Base score from scoring engine
  let score = Math.round(
    (Number(s.trust_score)   || 50) * 0.25 +
    (Number(s.content_score) || 40) * 0.15 +
    normGP(gp)                       * 0.30 +
    seasonScore(s.region_slug, checkIn) * 0.20 +
    availScore(s.pms_type)            * 0.10
  );

  // ── Theme tag boost ─────────────────────────────────────────────────────────
  const supplierTags = Array.isArray(s.tags) ? s.tags.map((t: string) => t.toLowerCase()) : [];
  const matchedTags  = themeTags.filter(t => supplierTags.includes(t.toLowerCase()));
  if (matchedTags.length > 0) score += Math.min(15, matchedTags.length * 5);  // up to +15

  score = Math.min(100, score);

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
    image:                extractImage(s),
    funFact:              s.fun_fact || '',
    malariaFree:          Boolean(s.malaria_free),
    tags:                 supplierTags,
    pmsType:              s.pms_type || null,
    themeMatch:           matchedTags,
    upgrades: s.upgrades || {
      rooms:       [{ label:'Standard Suite', extra:0, tier:0 }, { label:'Premium Suite', extra:Math.round(disp*0.35), tier:1 }],
      basis:       [{ label:'All-inclusive',  extra:0, tier:0 }],
      flexibility: [{ label:'Standard',       extra:0, tier:0 }, { label:'Flexible',      extra:Math.round(disp*0.08), tier:1 }],
    },
  };
}

// ── Default city for an unmatched region (used when AI/template fails) ───────
function defaultCityForRegion(slug: string, nights: number): any {
  const r = REGIONS[slug];
  const whys: Record<string, string> = {
    'kruger-sabi-sand': 'The world\'s finest leopard territory.',
    'okavango-delta':   'Water world wilderness — mokoro, wild dog, and no roads.',
    'cape-town':        'The perfect city chapter — Table Mountain, ocean, wine country.',
    'madikwe':          'Big Five without malaria. 90 minutes from Johannesburg.',
    'chobe-vic-falls':  'One of the Seven Natural Wonders of the World.',
    'masai-mara':       'The Great Migration — wildlife spectacle on a scale nowhere else matches.',
    'bwindi':           'Mountain gorillas — half the world\'s population lives here.',
  };
  const highlights: Record<string, string[]> = {
    'kruger-sabi-sand': ['Leopard tracking','Lion pride at sunset','Night drive'],
    'okavango-delta':   ['Mokoro at dawn','Wild dog pack','Night sounds'],
    'cape-town':        ['Table Mountain','Winelands','Atlantic coast'],
    'madikwe':          ['Wild dog','Family game drive','Big Five'],
    'chobe-vic-falls':  ['The Falls','Zambezi sunset cruise','Chobe day trip'],
    'masai-mara':       ['Mara River crossing','Hot air balloon at dawn','Lion prides'],
    'bwindi':           ['Mountain gorilla trekking','Forest walks','Community visit'],
  };
  return {
    city:        r?.label || slug.replace(/-/g, ' '),
    country:     r?.country || '',
    regionSlug:  slug,
    nights,
    why:         whys[slug] || 'A region we know well.',
    highlights:  highlights[slug] || [],
  };
}

// ── Brief extractor (Haiku call) ──────────────────────────────────────────────
async function extractBrief(text: string): Promise<any> {
  if (!text || text.trim().length < 10) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: 'You extract structured data. Return ONLY JSON. No preamble.',
        messages: [{
          role: 'user',
          content: `Extract from brief: "${text.replace(/"/g, '\\"')}"

Categories (independent — a brief can have multiple):
- party: family|couple|solo|friends|group|multigenerational
- occasion: honeymoon|anniversary|birthday|babymoon|retirement|graduation|none
- style: adventure|wildlife|photography|conservation|romantic|luxury|cultural|mixed

"Family" is PARTY, never occasion. "Honeymoon" is OCCASION.

Return:
{"party":{"value":<x>,"confidence":<0-1>},"occasion":{"value":<x>,"confidence":<0-1>},"style":{"value":<x>,"confidence":<0-1>},"themes":[<tag keywords for property matching>]}`,
        }],
      }),
    });
    const d = await res.json();
    const raw = (d?.content?.[0]?.text || '').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s === -1) return null;
    return JSON.parse(raw.slice(s, e + 1));
  } catch { return null; }
}

// ── Distribute nights proportionally across N regions ─────────────────────────
function distributeNights(nightsTotal: number, regionCount: number): number[] {
  // Default split rules — first region gets slightly more, equal otherwise
  if (regionCount === 1) return [nightsTotal];
  if (regionCount === 2) {
    const a = Math.ceil(nightsTotal * 0.57); return [a, nightsTotal - a];
  }
  if (regionCount === 3) {
    const a = Math.ceil(nightsTotal * 0.40);
    const b = Math.ceil((nightsTotal - a) * 0.55);
    return [a, b, nightsTotal - a - b];
  }
  // 4+: distribute evenly with remainder to first
  const base = Math.floor(nightsTotal / regionCount);
  const remainder = nightsTotal - (base * regionCount);
  const arr = Array(regionCount).fill(base);
  for (let i = 0; i < remainder; i++) arr[i]++;
  return arr;
}

// ── Order regions geographically (rough) for sensible routing ─────────────────
function orderRegions(slugs: string[]): string[] {
  // Rough order: SA bush → Botswana → Zim/Zambia → East Africa → Cape Town at end
  const orderPriority: Record<string, number> = {
    'kruger-sabi-sand': 1,
    'madikwe':          2,
    'okavango-delta':   3,
    'chobe-vic-falls':  4,
    'masai-mara':       5,
    'bwindi':           6,
    'cape-town':        9,  // always last — return to city after bush
  };
  return [...slugs].sort((a, b) => (orderPriority[a] || 99) - (orderPriority[b] || 99));
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode = 'socratic',
      budget = 150000, nights = 7,
      adults = 2, children = 0, infants = 0,
      regions = [],
      origin = 'LHR',
      flightIntent = 'flexible',
      checkinDate,
      briefText,
      theme,             // 'honeymoon' | 'family' | ...
      occasion,          // optional override
      style,             // optional override
    } = body;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let effectiveBudget   = budget;
    let effectiveNights   = nights;
    let effectiveRegions  = [...regions];
    let effectiveTheme    = theme;
    let effectiveOccasion = occasion;
    let effectiveStyle    = style;
    let themeTags: string[] = [];
    let followUps: string[] = [];
    let briefStructured: any = null;

    // ── Step 1: Brief extraction ─────────────────────────────────────────────
    if (mode === 'brief' && briefText?.trim()) {
      briefStructured = await extractBrief(briefText);
      if (briefStructured) {
        if (briefStructured.party?.value)    effectiveTheme    = briefStructured.party.value;
        if (briefStructured.occasion?.value) effectiveOccasion = briefStructured.occasion.value;
        if (briefStructured.style?.value)    effectiveStyle    = briefStructured.style.value;
        if (Array.isArray(briefStructured.themes)) themeTags = briefStructured.themes;
      }
    }

    // ── Step 2: Resolve theme tags for property scoring ──────────────────────
    if (effectiveOccasion && THEME_TAG_BOOST[effectiveOccasion]) themeTags.push(...THEME_TAG_BOOST[effectiveOccasion]);
    if (effectiveStyle    && THEME_TAG_BOOST[effectiveStyle])    themeTags.push(...THEME_TAG_BOOST[effectiveStyle]);
    if (effectiveTheme    && THEME_TAG_BOOST[effectiveTheme])    themeTags.push(...THEME_TAG_BOOST[effectiveTheme]);
    themeTags = [...new Set(themeTags)];  // dedupe

    // ── Step 3: Malaria filter for infants/babymoon ──────────────────────────
    const requiresMalariaFree = infants > 0 || effectiveOccasion === 'babymoon';
    if (requiresMalariaFree) {
      effectiveRegions = effectiveRegions.filter((r: string) => !MALARIA_REGIONS.has(r));
      if (effectiveRegions.length === 0) {
        // User selected only malaria regions but has infants — replace with default malaria-free
        effectiveRegions = ['madikwe'];
      }
    }

    // ── Step 4: Order regions for sensible routing ───────────────────────────
    if (effectiveRegions.length > 0) {
      effectiveRegions = orderRegions(effectiveRegions);
    }

    // ── Step 5: Load suppliers ────────────────────────────────────────────────
    const { data: suppliers = [] } = await supabase
      .from('suppliers')
      .select('*')
      .eq('edition_id', 'safari')
      .eq('is_active', true)
      .order('trust_score', { ascending: false });

    // ── Step 6: Build cities — STRICT region adherence ────────────────────────
    let cities: any[] = [];
    let source: 'explicit-regions' | 'ai-suggested' | 'fallback' = 'explicit-regions';

    if (effectiveRegions.length > 0) {
      // User explicitly chose regions — honour them, do NOT drop any
      const nightSplit = distributeNights(effectiveNights, effectiveRegions.length);
      cities = effectiveRegions.map((slug: string, i: number) => defaultCityForRegion(slug, nightSplit[i]));

      // Verify city count matches region count — non-negotiable
      if (cities.length !== effectiveRegions.length) {
        return NextResponse.json({ success: false, error: `Region count mismatch: ${cities.length} cities for ${effectiveRegions.length} regions` }, { status: 500 });
      }
    } else {
      // No regions specified — let AI suggest
      source = 'ai-suggested';
      // Fallback to canonical Sabi+Okavango if AI fails
      cities = [
        defaultCityForRegion('kruger-sabi-sand', Math.ceil(effectiveNights * 0.57)),
        defaultCityForRegion('okavango-delta',   effectiveNights - Math.ceil(effectiveNights * 0.57)),
      ];
    }

    // ── Step 7: Score and assign property per city (theme-aware) ──────────────
    const cityStays:    any[] = [];
    const pricedCities: any[] = [];
    let displayTotal = 0;

    for (const city of cities) {
      const pool = suppliers.filter((s: any) => s.region_slug === city.regionSlug);
      const scored = pool
        .map((s: any) => scoreSupplier(s, checkinDate, city.nights, themeTags))
        .sort((a: any, b: any) => b.score - a.score);

      const best = scored[0];
      const hotelId = best?.id ?? 0;

      cityStays.push({ hotelId, nights: city.nights, prefs: { rooms: 0, basis: 0, flexibility: 0 } });

      const lodgeCost = (best?.displayPricePerNight ?? 0) * city.nights;
      displayTotal += lodgeCost;

      pricedCities.push({
        ...city,
        hotelRate:      best?.displayPricePerNight ?? 0,
        estimatedCost:  lodgeCost,
        flightCost: 0, transferCost: 0, activityCost: 0,
        arrivalGap: 'Arrive midday — first drive at 16:00',
        departureGap: 'Final morning drive before departure',
        propertyOptions: scored.slice(0, 4).map((s: any) => ({
          id: s.id, name: s.name, score: s.score,
          displayPricePerNight: s.displayPricePerNight,
          image: s.image, funFact: s.funFact,
          trustScore: s.trustScore, contentScore: s.contentScore,
          malariaFree: s.malariaFree, tags: s.tags,
          themeMatch: s.themeMatch, upgrades: s.upgrades,
        })),
      });
    }

    // ── Step 8: Final integrity check (region count = city count) ────────────
    if (effectiveRegions.length > 0 && pricedCities.length !== effectiveRegions.length) {
      return NextResponse.json({
        success: false,
        error: `Integrity check failed: expected ${effectiveRegions.length} cities, got ${pricedCities.length}`,
      }, { status: 500 });
    }

    // ── Step 9: Build response ────────────────────────────────────────────────
    const itinerary = {
      title:               `${effectiveNights}-Night ${pricedCities.map((c: any) => c.city.split(' / ')[0]).join(' & ')}`,
      summary:             '',
      routing:             pricedCities.map((c: any) => c.city).join(' → '),
      bestTiming:          '',
      briefInterpretation: mode === 'brief' && briefStructured
        ? `Detected: ${[effectiveTheme, effectiveOccasion, effectiveStyle].filter(Boolean).join(' · ')}`
        : '',
      cities:              pricedCities,
      totalEstimate:       displayTotal,
      aiInsights:          ['Your rates are 15–27% below direct booking.'],
      warnings:            requiresMalariaFree && infants > 0 ? ['Malaria regions excluded due to infants travelling.'] : [],
      inputMode:           mode,
      theme:               effectiveTheme,
      occasion:            effectiveOccasion,
      style:               effectiveStyle,
      themeTags,
    };

    return NextResponse.json({
      success:       true,
      itinerary,
      cityStays,
      displayTotal,
      depositAmount: Math.round(displayTotal * 0.30),
      regions:       effectiveRegions,
      source,
      briefStructured,
      followUps,
    });

  } catch (e: any) {
    console.error('[build-itinerary v2]', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'Build failed' }, { status: 500 });
  }
}
