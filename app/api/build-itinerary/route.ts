import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchKBForRegions,
  fetchOverrideEntries,
  buildKBContext,
  buildKBContextForSkeleton,
  type KBEntry,
} from '@/app/lib/kb';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/build-itinerary  (v3)
//
// Changes from v2:
//   ✓ KB integration — four-tier priority hierarchy enforced
//   ✓ Override entries gate property selection (guidance_importance:3)
//   ✓ Commercial KB entries inform property ranking (margin-aware)
//   ✓ KB context injected into AI planner system prompt
//   ✓ KB entries matched to skeleton findings stored in response
//   ✓ Property scoring boosted by KB trust signals
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

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

// ── KB-aware property scoring ─────────────────────────────────────────────────
// Extends the v2 theme-aware scorer with:
//   + KB trust boost: +10 if property has active KB entries with evidence_strength >= 4
//   + KB commercial boost: margin-ranked properties get up to +15
//   + KB demotion: properties flagged in KB guardrails get -20
function scoreSupplier(
  s:               any,
  checkIn:         string | undefined,
  nights:          number,
  themeTags:       string[],
  kbBySupplier:    Record<string, KBEntry[]>,
  marginRankMap:   Record<string, number>,  // supplierId → rank (1=best, higher=worse)
): any {
  const net  = Number(s.net_rate_per_night) || 25000;
  const disp = Number(s.display_rate_per_night) || Math.round(net * M.hotels);
  const gp   = disp - net;

  // Base score (unchanged from v2)
  let score = Math.round(
    (Number(s.trust_score)   || 50) * 0.25 +
    (Number(s.content_score) || 40) * 0.15 +
    normGP(gp)                            * 0.30 +
    seasonScore(s.region_slug, checkIn)   * 0.20 +
    availScore(s.pms_type)                * 0.10
  );

  // Theme tag boost (unchanged from v2)
  const supplierTags  = Array.isArray(s.tags) ? s.tags.map((t: string) => t.toLowerCase()) : [];
  const matchedTags   = themeTags.filter(t => supplierTags.includes(t.toLowerCase()));
  if (matchedTags.length > 0) score += Math.min(15, matchedTags.length * 5);

  // ── KB boosts ──────────────────────────────────────────────────────────────
  const supplierKB = kbBySupplier[s.id] ?? [];

  // Trust boost: property has high-evidence KB entries (site visits, FAM trips)
  const highEvidenceEntries = supplierKB.filter(e =>
    e.status === 'active' &&
    e.claim_type !== 'commercial' &&
    (e.evidence_strength ?? 1) >= 4
  );
  if (highEvidenceEntries.length > 0) score += 10;

  // Commercial margin rank boost: rank 1 gets +15, rank 2 gets +10, rank 3 gets +5
  const marginRank = marginRankMap[s.id];
  if (marginRank === 1) score += 15;
  else if (marginRank === 2) score += 10;
  else if (marginRank === 3) score += 5;

  // KB demotion: commercial entries with trust flags get penalised
  const demoted = supplierKB.some(e =>
    e.claim_type === 'commercial' &&
    e.specialist_recs?.some(r => r.toLowerCase().includes('not preferred') || r.toLowerCase().includes('do not recommend'))
  );
  if (demoted) score -= 20;

  score = Math.min(100, Math.max(0, score));

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
    funFact:              s.fun_fact || s.short_tagline || '',
    malariaFree:          Boolean(s.malaria_free),
    tags:                 supplierTags,
    pmsType:              s.pms_type || null,
    themeMatch:           matchedTags,
    kbEntryCount:         supplierKB.filter(e => e.status === 'active').length,
    upgrades: s.upgrades || {
      rooms:       [{ label:'Standard Suite', extra:0, tier:0 }, { label:'Premium Suite', extra:Math.round(disp*0.35), tier:1 }],
      basis:       [{ label:'All-inclusive',  extra:0, tier:0 }],
      flexibility: [{ label:'Standard',       extra:0, tier:0 }, { label:'Flexible',      extra:Math.round(disp*0.08), tier:1 }],
    },
  };
}

// ── Build margin rank map from commercial KB entries ──────────────────────────
// Returns: { supplierId: rank } where rank 1 = highest margin recommended
function buildMarginRankMap(kbEntries: KBEntry[]): Record<string, number> {
  const commercialEntries = kbEntries.filter(e =>
    e.claim_type === 'commercial' &&
    e.status === 'active' &&
    e.supplier_id &&
    e.guidance_importance === 2
  );

  // Sort by evidence_strength desc (higher = more confident margin data)
  // Within same strength, by guidance_importance
  const sorted = [...commercialEntries].sort((a, b) =>
    (b.evidence_strength ?? 1) - (a.evidence_strength ?? 1)
  );

  const rankMap: Record<string, number> = {};
  sorted.forEach((e, i) => {
    if (e.supplier_id && !rankMap[e.supplier_id]) {
      rankMap[e.supplier_id] = i + 1;
    }
  });

  return rankMap;
}

// ── Check if a property is blocked by a KB override entry ────────────────────
function isBlockedByKB(
  supplierId: string,
  supplierName: string,
  overrideEntries: KBEntry[]
): boolean {
  return overrideEntries.some(e =>
    e.override_ai &&
    e.specialist_recs?.some(r => {
      const lower = r.toLowerCase();
      return (
        lower.includes('do not recommend') ||
        lower.includes('not recommended') ||
        lower.includes('must not be recommended')
      ) && (
        lower.includes(supplierName.toLowerCase()) ||
        (e.supplier_id && e.supplier_id === supplierId)
      );
    })
  );
}

// ── Default city for region ───────────────────────────────────────────────────
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
    city:       r?.label || slug.replace(/-/g, ' '),
    country:    r?.country || '',
    regionSlug: slug,
    nights,
    why:        whys[slug] || 'A region we know well.',
    highlights: highlights[slug] || [],
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
          content: `Extract from brief: "${text.replace(/"/g, '\\"')}"\n\nCategories (independent — a brief can have multiple):\n- party: family|couple|solo|friends|group|multigenerational\n- occasion: honeymoon|anniversary|birthday|babymoon|retirement|graduation|none\n- style: adventure|wildlife|photography|conservation|romantic|luxury|cultural|mixed\n\n"Family" is PARTY, never occasion. "Honeymoon" is OCCASION.\n\nReturn:\n{"party":{"value":<x>,"confidence":<0-1>},"occasion":{"value":<x>,"confidence":<0-1>},"style":{"value":<x>,"confidence":<0-1>},"themes":[<tag keywords for property matching>]}`,
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

// ── Night distribution ────────────────────────────────────────────────────────
const REGION_MINIMUMS: Record<string, number> = {
  'kruger-sabi-sand': 3, 'okavango-delta': 3, 'cape-town': 3,
  'madikwe': 2, 'chobe-vic-falls': 2, 'masai-mara': 3,
  'bwindi': 2, 'phinda': 2, 'mozambique': 3,
};

const SEASON_PEAKS: Record<string, { peak: number[]; shoulder: number[] }> = {
  'kruger-sabi-sand': { peak:[6,7,8,9],     shoulder:[4,5,10,11] },
  'okavango-delta':   { peak:[7,8,9,10],    shoulder:[5,6,11]    },
  'cape-town':        { peak:[11,12,1,2,3], shoulder:[10,4,9]    },
  'madikwe':          { peak:[6,7,8,9],     shoulder:[4,5,10,11] },
  'chobe-vic-falls':  { peak:[8,9,10],      shoulder:[6,7,11]    },
  'masai-mara':       { peak:[7,8,9,10],    shoulder:[6,11]      },
  'bwindi':           { peak:[6,7,12,1],    shoulder:[2,3,8,9]   },
};

const REGION_TYPE_MULT: Record<string, number> = { 'cape-town': 0.55 };

function distributeNights(
  regions:     string[],
  totalNights: number,
  suppliers:   any[],
  checkinDate?: string,
  marginHotels: number = 1.15,
): number[] {
  if (regions.length === 0) return [];
  if (regions.length === 1) return [totalNights];

  const minimums = regions.map(r => REGION_MINIMUMS[r] ?? 2);
  const minTotal = minimums.reduce((a, b) => a + b, 0);
  if (minTotal >= totalNights) return minimums;

  const nights    = [...minimums];
  let remaining   = totalNights - minTotal;

  const month = checkinDate ? new Date(checkinDate).getMonth() + 1 : 0;
  const scores = regions.map(slug => {
    const pool    = suppliers.filter((s: any) => s.region_slug === slug && s.is_active !== false);
    const avgNet  = pool.length > 0
      ? pool.reduce((s: number, p: any) => s + (Number(p.net_rate_per_night) || 25000), 0) / pool.length
      : 25000;
    const avgDisp = pool.length > 0
      ? pool.reduce((s: number, p: any) => s + (Number(p.display_rate_per_night) || Math.round(avgNet * marginHotels)), 0) / pool.length
      : Math.round(avgNet * marginHotels);
    const gpPerNight = avgDisp - avgNet;
    const sp         = SEASON_PEAKS[slug];
    const seasonMult = !month ? 1.0
      : sp?.peak.includes(month)     ? 1.25
      : sp?.shoulder.includes(month) ? 1.0
      : 0.75;
    const typeMult = REGION_TYPE_MULT[slug] ?? 1.0;
    return gpPerNight * seasonMult * typeMult;
  });

  const decayScores = [...scores];
  for (let i = 0; i < remaining; i++) {
    const maxIdx = decayScores.indexOf(Math.max(...decayScores));
    nights[maxIdx]++;
    decayScores[maxIdx] *= 0.75;
  }

  return nights;
}

function orderRegions(slugs: string[]): string[] {
  const orderPriority: Record<string, number> = {
    'kruger-sabi-sand': 1, 'madikwe': 2, 'okavango-delta': 3,
    'chobe-vic-falls': 4, 'masai-mara': 5, 'bwindi': 6, 'cape-town': 9,
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
      theme,
      occasion,
      style,
      editionId = 'safari',
    } = body;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let effectiveBudget   = budget;
    let effectiveNights   = nights;
    let effectiveRegions  = [...regions];
    let effectiveTheme    = theme;
    let effectiveOccasion = occasion;
    let effectiveStyle    = style;
    let themeTags: string[] = [];
    let briefStructured: any = null;

    // ── Step 1: Brief extraction ──────────────────────────────────────────────
    if (mode === 'brief' && briefText?.trim()) {
      briefStructured = await extractBrief(briefText);
      if (briefStructured) {
        if (briefStructured.party?.value)    effectiveTheme    = briefStructured.party.value;
        if (briefStructured.occasion?.value) effectiveOccasion = briefStructured.occasion.value;
        if (briefStructured.style?.value)    effectiveStyle    = briefStructured.style.value;
        if (Array.isArray(briefStructured.themes)) themeTags = briefStructured.themes;
      }
    }

    // ── Step 2: Theme tags ────────────────────────────────────────────────────
    if (effectiveOccasion && THEME_TAG_BOOST[effectiveOccasion]) themeTags.push(...THEME_TAG_BOOST[effectiveOccasion]);
    if (effectiveStyle    && THEME_TAG_BOOST[effectiveStyle])    themeTags.push(...THEME_TAG_BOOST[effectiveStyle]);
    if (effectiveTheme    && THEME_TAG_BOOST[effectiveTheme])    themeTags.push(...THEME_TAG_BOOST[effectiveTheme]);
    themeTags = [...new Set(themeTags)];

    // ── Step 3: Malaria filter ────────────────────────────────────────────────
    const requiresMalariaFree = infants > 0 || effectiveOccasion === 'babymoon';
    if (requiresMalariaFree) {
      effectiveRegions = effectiveRegions.filter((r: string) => !MALARIA_REGIONS.has(r));
      if (effectiveRegions.length === 0) effectiveRegions = ['madikwe'];
    }

    // ── Step 4: Order regions ────────────────────────────────────────────────
    if (effectiveRegions.length > 0) {
      effectiveRegions = orderRegions(effectiveRegions);
    }

    // ── Step 5: Load suppliers ────────────────────────────────────────────────
    const { data: suppliers = [] } = await supabase
      .from('suppliers')
      .select('*')
      .eq('edition_id', editionId)
      .eq('is_active', true)
      .order('trust_score', { ascending: false });

    // ── Step 6: Fetch KB entries (parallel with suppliers) ────────────────────
    // Fetch ALL entries for the journey's regions including commercial ones.
    // Commercial entries are used server-side for scoring only — never returned.
    const regionsToFetch = effectiveRegions.length > 0
      ? effectiveRegions
      : ['kruger-sabi-sand', 'okavango-delta']; // fallback

    const [kbEntries, overrideEntries] = await Promise.all([
      fetchKBForRegions(regionsToFetch, editionId),
      fetchOverrideEntries(regionsToFetch, editionId),
    ]);

    // Build lookup structures for fast scoring
    const kbContext       = buildKBContext(kbEntries, regionsToFetch, editionId);
    const kbForSkeleton   = buildKBContextForSkeleton(kbEntries, regionsToFetch);
    const marginRankMap   = buildMarginRankMap(kbEntries);

    // ── Step 7: Build cities ──────────────────────────────────────────────────
    let cities: any[] = [];
    let source: 'explicit-regions' | 'ai-suggested' | 'fallback' = 'explicit-regions';

    if (effectiveRegions.length > 0) {
      const nightSplit = distributeNights(effectiveRegions, effectiveNights, suppliers, checkinDate, M.hotels);
      cities = effectiveRegions.map((slug: string, i: number) => defaultCityForRegion(slug, nightSplit[i]));

      if (cities.length !== effectiveRegions.length) {
        return NextResponse.json({
          success: false,
          error: `Region count mismatch: ${cities.length} cities for ${effectiveRegions.length} regions`,
        }, { status: 500 });
      }
    } else {
      source = 'ai-suggested';
      cities = [
        defaultCityForRegion('kruger-sabi-sand', Math.ceil(effectiveNights * 0.57)),
        defaultCityForRegion('okavango-delta',   effectiveNights - Math.ceil(effectiveNights * 0.57)),
      ];
    }

    // ── Step 8: Score and assign property per city (KB-aware) ─────────────────
    const cityStays:     any[] = [];
    const pricedCities:  any[] = [];
    const kbMatchedIds:  string[] = [];
    let displayTotal = 0;

    for (const city of cities) {
      const pool = suppliers.filter((s: any) => s.region_slug === city.regionSlug);

      // Apply KB override blocks — remove any property the KB says not to recommend
      const eligiblePool = pool.filter((s: any) =>
        !isBlockedByKB(s.id, s.name, overrideEntries)
      );

      const scored = eligiblePool
        .map((s: any) => scoreSupplier(
          s, checkinDate, city.nights, themeTags,
          kbForSkeleton.bySupplier,
          marginRankMap,
        ))
        .sort((a: any, b: any) => b.score - a.score);

      const best     = scored[0];
      const hotelId  = best?.id ?? 0;

      cityStays.push({ hotelId, nights: city.nights, prefs: { rooms: 0, basis: 0, flexibility: 0 } });

      const lodgeCost = (best?.displayPricePerNight ?? 0) * city.nights;
      displayTotal += lodgeCost;

      // Collect KB entry IDs matched to this city
      const cityKBEntries = kbForSkeleton.byRegion[city.regionSlug] ?? [];
      kbMatchedIds.push(...cityKBEntries.map(e => e.id));

      pricedCities.push({
        ...city,
        hotelRate:      best?.displayPricePerNight ?? 0,
        estimatedCost:  lodgeCost,
        flightCost: 0, transferCost: 0, activityCost: 0,
        arrivalGap:   'Arrive midday — first drive at 16:00',
        departureGap: 'Final morning drive before departure',
        propertyOptions: scored.slice(0, 4).map((s: any) => ({
          id: s.id, name: s.name, score: s.score,
          displayPricePerNight: s.displayPricePerNight,
          image: s.image, funFact: s.funFact,
          trustScore: s.trustScore, contentScore: s.contentScore,
          malariaFree: s.malariaFree, tags: s.tags,
          themeMatch: s.themeMatch, kbEntryCount: s.kbEntryCount,
          upgrades: s.upgrades,
        })),
      });
    }

    // ── Step 9: Final integrity check ─────────────────────────────────────────
    if (effectiveRegions.length > 0 && pricedCities.length !== effectiveRegions.length) {
      return NextResponse.json({
        success: false,
        error: `Integrity check failed: expected ${effectiveRegions.length} cities, got ${pricedCities.length}`,
      }, { status: 500 });
    }

    // ── Step 10: Build itinerary response ─────────────────────────────────────
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
      aiInsights:          [
        'Your rates are 15–27% below direct booking.',
        ...kbEntries
          .filter(e => e.guidance_importance >= 2 && !e.internal_only && e.highlights?.length)
          .slice(0, 2)
          .map(e => e.highlights![0]),
      ].filter(Boolean),
      warnings:            requiresMalariaFree && infants > 0
        ? ['Malaria regions excluded due to infants travelling.']
        : [],
      inputMode:           mode,
      theme:               effectiveTheme,
      occasion:            effectiveOccasion,
      style:               effectiveStyle,
      themeTags,
    };

    return NextResponse.json({
      success:        true,
      itinerary,
      cityStays,
      displayTotal,
      depositAmount:  Math.round(displayTotal * 0.30),
      regions:        effectiveRegions,
      source,
      briefStructured,
      // KB metadata — used by skeleton engine, not shown to traveller
      kbMatchedIds:   [...new Set(kbMatchedIds)],
      kbContext,       // injected into AI planner system prompt when used
      overrideCount:  overrideEntries.length,
    });

  } catch (e: any) {
    console.error('[build-itinerary v3]', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'Build failed' }, { status: 500 });
  }
}
