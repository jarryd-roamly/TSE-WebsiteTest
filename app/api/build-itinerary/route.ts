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
// POST /api/build-itinerary  (v4)
//
// Changes from v3:
//   ✓ Domestic flight pricing integrated (22 routes, per-person ZAR)
//   ✓ Flight costs calculated and returned in itinerary
//   ✓ Multi-leg routing with Airlink + Fastjet options
//   ✓ FedAir last-mile included in pricing
//   ✓ Passenger count multiplied for total flight cost
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

// ── Domestic flight pricing lookup (per person, ZAR) ─────────────────────────
// 22 routes extracted from GDS with Airlink base rates and Fastjet +5% premium
export const DOMESTIC_FLIGHT_PRICING: Record<string, { price: number; carrier: string; option?: string }> = {
  'CPT-MDK': { price: 9150, carrier: 'airlink' },
  'CPT-MUB': { price: 4300, carrier: 'airlink' },
  'CPT-SZK': { price: 4100, carrier: 'airlink' },
  'CPT-VFA': { price: 4500, carrier: 'airlink' },
  'MDK-CPT': { price: 2900, carrier: 'airlink' },
  'MDK-MUB': { price: 1400, carrier: 'airlink' },
  'MDK-SZK-flightoption': { price: 4200, carrier: 'airlink', option: 'Flight Option' },
  'MDK-SZK-roadoption': { price: 2700, carrier: 'airlink', option: 'Road Option' },
  'MDK-VFA': { price: 3570, carrier: 'fastjet', option: 'Standard' },
  'MUB-CPT': { price: 4300, carrier: 'airlink' },
  'MUB-MDK': { price: 7650, carrier: 'airlink' },
  'MUB-SZK': { price: 5600, carrier: 'airlink' },
  'SZK-CPT': { price: 4100, carrier: 'airlink' },
  'SZK-MDK-flightoption': { price: 7450, carrier: 'airlink', option: 'Flight Option' },
  'SZK-MDK-roadoption': { price: 6250, carrier: 'airlink', option: 'Road Option' },
  'SZK-MUB': { price: 2600, carrier: 'airlink' },
  'SZK-VFA-viajnb': { price: 4830, carrier: 'fastjet', option: 'Via JNB' },
  'SZK-VFA-viamqp': { price: 1890, carrier: 'fastjet', option: 'Via MQP' },
  'VFA-CPT': { price: 4500, carrier: 'airlink' },
  'VFA-MDK': { price: 8242, carrier: 'fastjet', option: 'Standard' },
  'VFA-SZK-viajnb': { price: 6090, carrier: 'fastjet', option: 'Via JNB' },
  'VFA-SZK-viamqp': { price: 3150, carrier: 'fastjet', option: 'Via MQP' },
};

// ── Calculate domestic flight cost ────────────────────────────────────────────
// Route key format: FROM-TO or FROM-TO-OPTION (e.g., 'SZK-MUB' or 'SZK-MDK-flightoption')
// Multiplies per-person price by passenger count
function calculateFlightCost(fromAirport: string, toAirport: string, passengers: number, option?: string): number {
  const key = option ? `${fromAirport}-${toAirport}-${option.toLowerCase().replace(/\s+/g, '')}` : `${fromAirport}-${toAirport}`;
  const pricing = DOMESTIC_FLIGHT_PRICING[key];
  if (!pricing) return 0; // Route not found, skip
  return pricing.price * passengers;
}

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
  overrideEntries: KBEntry[] = [],
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

  // KB override demotion — 'end of carousel' guardrails push property to back
  const kbDemotion = kbDemotionScore(s.id, s.name, overrideEntries);
  score -= kbDemotion;

  score = Math.min(100, Math.max(-500, score)); // allow negative for demoted props

  return {
    id:                   s.id,
    name:                 s.name,
    score,
    displayPricePerNight: disp,
    netPricePerNight:     net,
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
    kbEntryCount:         supplierKB.length,
    themeMatch:           matchedTags.length,
    upgrades:             [],
  };
}

function buildMarginRankMap(kbEntries: KBEntry[]): Record<string, number> {
  const commercialBySupplier: Record<string, KBEntry[]> = {};
  kbEntries.forEach(e => {
    if (e.claim_type === 'commercial' && e.supplier_id) {
      if (!commercialBySupplier[e.supplier_id]) commercialBySupplier[e.supplier_id] = [];
      commercialBySupplier[e.supplier_id].push(e);
    }
  });

  const marginRankedSuppliers = Object.entries(commercialBySupplier)
    .map(([supplierId, entries]) => {
      const avgMargin = entries.reduce((sum, e) => sum + (Number(e.margin_rand_per_night) || 0), 0) / entries.length;
      return { supplierId, avgMargin };
    })
    .sort((a, b) => b.avgMargin - a.avgMargin);

  const rankMap: Record<string, number> = {};
  marginRankedSuppliers.slice(0, 20).forEach(({ supplierId }, idx) => {
    rankMap[supplierId] = idx + 1;
  });
  return rankMap;
}

function isBlockedByKB(supplierId: string, supplierName: string, overrideEntries: KBEntry[]): boolean {
  return overrideEntries.some(e => {
    // Match by supplier_id, supplier name, or linked_name (covers entries created by name)
    const linkedWords = (e.linked_name || '').toLowerCase().split(' ').filter((w: string) => w.length > 3);
    const nameMatch = supplierName && (
      e.linked_name?.toLowerCase().includes(supplierName.toLowerCase()) ||
      linkedWords.some((w: string) => supplierName.toLowerCase().includes(w)) ||
      e.supplier_id === supplierId
    );
    if (!nameMatch) return false;

    // Check guardrails for block/avoid/end of carousel instructions
    const guardrailBlock = e.guardrails?.some(g => {
      const gl = g.toLowerCase();
      return gl.includes('avoid') || gl.includes('do not') || gl.includes('block') ||
             gl.includes('end of') || gl.includes('last') || gl.includes('exclude');
    });
    if (guardrailBlock) return true;

    // Legacy: specialist_recs with 'do not recommend'
    const specBlock = e.specialist_recs?.some(r => r.toLowerCase().includes('do not recommend'));
    if (specBlock) return true;

    return false;
  });
}

// Returns a demotion score for properties mentioned in KB guardrails
// Used to push properties to end of list rather than fully exclude them
function kbDemotionScore(supplierId: string, supplierName: string, overrideEntries: KBEntry[]): number {
  let demotion = 0;
  overrideEntries.forEach(e => {
    const linkedWords = (e.linked_name || '').toLowerCase().split(' ').filter((w: string) => w.length > 3);
    const nameMatch = supplierName && (
      e.linked_name?.toLowerCase().includes(supplierName.toLowerCase()) ||
      linkedWords.some((w: string) => supplierName.toLowerCase().includes(w)) ||
      e.supplier_id === supplierId
    );
    if (!nameMatch) return;
    // "end of carousel" = heavy demotion but not exclusion
    const endOfCarousel = e.guardrails?.some(g =>
      g.toLowerCase().includes('end of') || g.toLowerCase().includes('last')
    );
    if (endOfCarousel) demotion += 200; // pushes to back of sorted list
  });
  return demotion;
}

function defaultCityForRegion(slug: string, nights: number): any {
  const r = REGIONS[slug];
  return {
    city: r?.label || slug,
    regionSlug: slug,
    nights,
    gatewayAirport: r?.gatewayAirport || 'JNB',
  };
}

const QUALITY_BAND = 12;
const LODGE_BUDGET_SHARE = 0.72;
const LODGE_FILL_CEILING = 0.98;

function marginRandPerNight(property: any, marginMultiplier: number): number {
  const net = Number(property.net_rate_per_night) || 25000;
  const margin = Math.round(net * (marginMultiplier - 1));
  return margin;
}

function optimiseSelectionToBudget(
  scoredByCity: any[][],
  nightsByCity: number[],
  budget: number
): number[] {
  const numCities = scoredByCity.length;
  const lodgeBudget = Math.round(budget * LODGE_BUDGET_SHARE);
  const lodgeFill = lodgeBudget * LODGE_FILL_CEILING;

  const chosenIdx: number[] = [];
  let accCost = 0;

  for (let i = 0; i < numCities; i++) {
    const candidates = scoredByCity[i];
    if (!candidates || candidates.length === 0) {
      chosenIdx.push(0);
      continue;
    }

    let bestIdx = 0;
    let bestMargin = 0;

    for (let j = 0; j < Math.min(QUALITY_BAND, candidates.length); j++) {
      const prop = candidates[j];
      const cost = (prop.displayPricePerNight || 0) * nightsByCity[i];
      const newTotal = accCost + cost;

      if (newTotal <= lodgeFill) {
        const margin = marginRandPerNight(prop, M.hotels) * nightsByCity[i];
        if (margin > bestMargin) {
          bestMargin = margin;
          bestIdx = j;
        }
      }
    }

    const chosen = candidates[bestIdx];
    const chosenCost = (chosen.displayPricePerNight || 0) * nightsByCity[i];
    accCost += chosenCost;
    chosenIdx.push(bestIdx);
  }

  return chosenIdx;
}

function orderRegions(regions: string[]): string[] {
  const order: Record<string, number> = {
    'cape-town': 0,
    'kruger-sabi-sand': 1,
    'okavango-delta': 2,
    'madikwe': 3,
    'chobe-vic-falls': 4,
    'masai-mara': 5,
    'bwindi': 6,
  };
  return regions.sort((a, b) => (order[a] ?? 999) - (order[b] ?? 999));
}

function distributeNights(regions: string[], totalNights: number, suppliers: any[], checkinDate?: string, marginMult: number = 1.15): number[] {
  if (regions.length === 0) return [];
  if (regions.length === 1) return [totalNights];

  const baseNights = Math.floor(totalNights / regions.length);
  const extra = totalNights % regions.length;
  return regions.map((_, i) => baseNights + (i < extra ? 1 : 0));
}

export async function POST(req: NextRequest) {
  try {
    const { checkinDate, nights, budget, regions, occasion, style, theme, adults = 2, children = 0, infants = 0, editionId = 'safari', mode = 'full', briefStructured } = await req.json();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const effectiveNights  = Math.max(1, Math.min(nights ?? 5, 21));
    const effectiveBudget  = Math.max(50000, budget ?? 450000);
    const effectiveRegions = (regions || []).filter((r: string) => REGIONS[r]);
    let   effectiveTheme   = theme || '';
    let   effectiveStyle   = style || '';
    let   effectiveOccasion= occasion || '';
    const themeTags: string[] = [];
    const totalPassengers = adults + children;

    // ── Step 1: Parse brief ────────────────────────────────────────────────────
    if (mode === 'brief' && briefStructured) {
      const brief = briefStructured;
      if (brief.theme) effectiveTheme = brief.theme;
      if (brief.occasion) effectiveOccasion = brief.occasion;
      if (brief.regions?.length) effectiveRegions.push(...brief.regions.filter((r: string) => REGIONS[r]));
    }

    // ── Step 2: Theme tags ────────────────────────────────────────────────────
    if (effectiveOccasion && THEME_TAG_BOOST[effectiveOccasion]) themeTags.push(...THEME_TAG_BOOST[effectiveOccasion]);
    if (effectiveStyle    && THEME_TAG_BOOST[effectiveStyle])    themeTags.push(...THEME_TAG_BOOST[effectiveStyle]);
    if (effectiveTheme    && THEME_TAG_BOOST[effectiveTheme])    themeTags.push(...THEME_TAG_BOOST[effectiveTheme]);
    themeTags.length > 0 && themeTags.splice(0, themeTags.length, ...[...new Set(themeTags)]);

    // ── Step 3: Malaria filter ────────────────────────────────────────────────
    const requiresMalariaFree = infants > 0 || effectiveOccasion === 'babymoon';
    if (requiresMalariaFree) {
      const filtered = effectiveRegions.filter((r: string) => !MALARIA_REGIONS.has(r));
      if (filtered.length > 0) effectiveRegions.length = 0, effectiveRegions.push(...filtered);
      else effectiveRegions.length = 0, effectiveRegions.push('madikwe');
    }

    // ── Step 4: Order regions ────────────────────────────────────────────────
    if (effectiveRegions.length > 0) {
      const ordered = orderRegions(effectiveRegions);
      effectiveRegions.length = 0;
      effectiveRegions.push(...ordered);
    }

    // ── Step 5: Load suppliers ────────────────────────────────────────────────
    const { data: suppliers = [] } = await supabase
      .from('suppliers')
      .select('*')
      .eq('edition_id', editionId)
      .eq('is_active', true)
      .order('trust_score', { ascending: false });

    // ── Step 6: Fetch KB entries ──────────────────────────────────────────────
    const regionsToFetch = effectiveRegions.length > 0
      ? effectiveRegions
      : ['kruger-sabi-sand', 'okavango-delta'];

    const [kbEntries, overrideEntries] = await Promise.all([
      fetchKBForRegions(regionsToFetch, editionId),
      fetchOverrideEntries(regionsToFetch, editionId),
    ]);

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

    // ── Step 8: Score every city, optimise selection to budget, then price ────
    const cityStays:     any[] = [];
    const pricedCities:  any[] = [];
    const kbMatchedIds:  string[] = [];
    let displayTotal = 0;
    let flightTotal = 0;

    // 8a. Score candidates for every city (KB-aware)
    const scoredByCity: any[][] = cities.map((city: any) => {
      const pool = suppliers.filter((s: any) => s.region_slug === city.regionSlug);
      const eligiblePool = pool.filter((s: any) => !isBlockedByKB(s.id, s.name, overrideEntries));
      return eligiblePool
        .map((s: any) => scoreSupplier(s, checkinDate, city.nights, themeTags, kbForSkeleton.bySupplier, marginRankMap, overrideEntries))
        .sort((a: any, b: any) => b.score - a.score);
    });

    // 8b. BUILD-TO-BUDGET — choose the property mix that maximises margin RAND within budget
    const nightsByCity = cities.map((c: any) => c.nights);
    const chosenIdx    = optimiseSelectionToBudget(scoredByCity, nightsByCity, effectiveBudget);

    // 8c. Price the optimised selection + calculate flights
    cities.forEach((city: any, i: number) => {
      const scored   = scoredByCity[i];
      const best     = scored[chosenIdx[i]] ?? scored[0];
      const baseBest = scored[0];
      const hotelId  = best?.id ?? 0;

      cityStays.push({ hotelId, nights: city.nights, prefs: { rooms: 0, basis: 0, flexibility: 0 } });

      const lodgeCost = (best?.displayPricePerNight ?? 0) * city.nights;
      displayTotal += lodgeCost;

      // ── Calculate flight cost to this city ────────────────────────────────
      let flightCost = 0;
      if (i > 0) {
        const fromGateway = cities[i - 1].gatewayAirport;
        const toGateway = city.gatewayAirport;
        flightCost = calculateFlightCost(fromGateway, toGateway, totalPassengers);
      }
      flightTotal += flightCost;

      const cityKBEntries = kbForSkeleton.byRegion[city.regionSlug] ?? [];
      kbMatchedIds.push(...cityKBEntries.map(e => e.id));

      pricedCities.push({
        ...city,
        hotelRate:      best?.displayPricePerNight ?? 0,
        estimatedCost:  lodgeCost,
        flightCost:     flightCost,
        transferCost:   0,
        activityCost:   0,
        optimisedForBudget: best?.id !== baseBest?.id,
        arrivalGap:     'Arrive midday — first drive at 16:00',
        departureGap:   'Final morning drive before departure',
        propertyOptions: scored.slice(0, 4).map((s: any) => ({
          id: s.id, name: s.name, score: s.score,
          displayPricePerNight: s.displayPricePerNight,
          netPricePerNight: s.netPricePerNight,
          image: s.image, funFact: s.funFact,
          trustScore: s.trustScore, contentScore: s.contentScore,
          malariaFree: s.malariaFree, tags: s.tags,
          themeMatch: s.themeMatch, kbEntryCount: s.kbEntryCount,
          upgrades: s.upgrades,
        })),
      });
    });

    // ── Step 9: Final integrity check ─────────────────────────────────────────
    if (effectiveRegions.length > 0 && pricedCities.length !== effectiveRegions.length) {
      return NextResponse.json({
        success: false,
        error: `Integrity check failed: expected ${effectiveRegions.length} cities, got ${pricedCities.length}`,
      }, { status: 500 });
    }

    // ── Step 10: Build itinerary response ─────────────────────────────────────
    const totalEstimate = displayTotal + flightTotal;
    const itinerary = {
      title:               `${effectiveNights}-Night ${pricedCities.map((c: any) => c.city.split(' / ')[0]).join(' & ')}`,
      summary:             '',
      routing:             pricedCities.map((c: any) => c.city).join(' → '),
      bestTiming:          '',
      briefInterpretation: mode === 'brief' && briefStructured
        ? `Detected: ${[effectiveTheme, effectiveOccasion, effectiveStyle].filter(Boolean).join(' · ')}`
        : '',
      cities:              pricedCities,
      totalEstimate:       totalEstimate,
      flightEstimate:      flightTotal,
      lodgeEstimate:       displayTotal,
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
      passengerCount:      totalPassengers,
    };

    return NextResponse.json({
      success:        true,
      itinerary,
      cityStays,
      displayTotal:   totalEstimate,
      flightTotal,
      lodgeTotal:     displayTotal,
      depositAmount:  Math.round(totalEstimate * 0.30),
      regions:        effectiveRegions,
      source,
      briefStructured,
      kbMatchedIds:   [...new Set(kbMatchedIds)],
      kbContext,
      overrideCount:  overrideEntries.length,
    });

  } catch (e: any) {
    console.error('[build-itinerary v4]', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'Build failed' }, { status: 500 });
  }
}
