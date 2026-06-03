// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
// Server-side ONLY. Never imported by client components.
// Input:  supplier row from Supabase (including net_rate — secret)
// Output: ScoredProperty — display prices only, no net rates exposed
//
// Ranking philosophy: maximise absolute ZAR gross profit per night,
// weighted with trust, content quality, seasonal fit, and availability
// confidence. Weights are configurable per Edition in scoring_config table.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoringContext {
  checkIn?:  string;   // ISO date — drives seasonal fit
  nights?:   number;
  pax?:      number;
}

export interface ScoreWeights {
  trust:   number;  // supplier reliability (trust_score)
  content: number;  // content quality (content_score)
  gp:      number;  // absolute ZAR GP per night — KEY METRIC
  season:  number;  // seasonal fit for check-in date
  avail:   number;  // availability confidence (PMS type)
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  trust:   0.25,
  content: 0.15,
  gp:      0.30,  // highest weight — the commercial objective
  season:  0.20,
  avail:   0.10,
};

// What the client receives — no net rates anywhere in this shape
export interface ScoredProperty {
  id:                   string | number;
  name:                 string;
  displayPricePerNight: number;
  displayPrice:         number;  // displayPricePerNight × nights
  score:                number;  // 0–100
  trustScore:           number;
  contentScore:         number;
  destination:          string;
  subRegion:            string;
  country:              string;
  image:                string;
  funFact:              string;
  malariaFree:          boolean;
  tags:                 string[];
  upgrades?:            any;     // room/basis/flexibility options (display prices only)
  pmsType?:             string;
}

// ── Seasonal fit ──────────────────────────────────────────────────────────────
// Month numbers: 1 = January, 12 = December
const SEASON: Record<string, { peak: number[]; shoulder: number[] }> = {
  'kruger-sabi-sand': { peak: [6,7,8,9],      shoulder: [4,5,10,11] },
  'okavango-delta':   { peak: [7,8,9,10],      shoulder: [5,6,11]    },
  'cape-town':        { peak: [11,12,1,2,3],   shoulder: [10,4,9]    },
  'madikwe':          { peak: [6,7,8,9],       shoulder: [4,5,10,11] },
  'chobe-vic-falls':  { peak: [8,9,10],        shoulder: [6,7,11]    },
  'masai-mara':       { peak: [7,8,9,10],      shoulder: [6,11]      },
  'phinda':           { peak: [6,7,8,9],       shoulder: [4,5,10,11] },
  'bwindi':           { peak: [6,7,12,1],      shoulder: [2,3,8,9]   },
  'mozambique':       { peak: [5,6,7,8,9,10],  shoulder: [4,11]      },
};

export function seasonalFit(regionSlug: string, checkIn?: string): number {
  if (!checkIn) return 72;
  const month = new Date(checkIn).getMonth() + 1;
  const s = SEASON[regionSlug];
  if (!s)                        return 72;
  if (s.peak.includes(month))    return 100;
  if (s.shoulder.includes(month)) return 70;
  return 40; // lean / off-season
}

// ── Availability confidence from PMS tier ─────────────────────────────────────
export function availabilityConfidence(pmsType?: string | null): number {
  if (!pmsType)         return 55;
  const t = pmsType.toLowerCase();
  if (['resrequest','nightsbridge','opera','rms'].includes(t)) return 100;
  if (t === 'manual')   return 72;
  return 55;
}

// ── GP normalisation: cap at R18,000/night, floor at R1,000 ──────────────────
export function normaliseGP(gpZARPerNight: number): number {
  const min = 1000, max = 18000;
  return Math.round(Math.min(100, Math.max(0, (gpZARPerNight - min) / (max - min) * 100)));
}

// ── Extract best image from Supabase JSONB or fallback fields ─────────────────
export function extractImage(supplier: any): string {
  let img = '';
  try {
    if (typeof supplier.images === 'string' && supplier.images.startsWith('http')) {
      img = supplier.images;
    } else {
      const imgs: any[] = Array.isArray(supplier.images)
        ? supplier.images
        : (supplier.images ? JSON.parse(supplier.images) : []);
      const primary = imgs.find(i => i.is_primary && i.status === 'approved')
        ?? imgs.find(i => i.status === 'approved')
        ?? imgs[0];
      if (primary?.url) img = primary.url;
    }
  } catch {}
  if (!img && supplier.hero_image)  img = supplier.hero_image;
  if (!img && supplier.cover_image) img = supplier.cover_image;
  return img;
}

// ── Core scoring function ─────────────────────────────────────────────────────
export function scoreProperty(
  supplier:          any,              // raw Supabase row (may contain net_rate)
  context:           ScoringContext,
  weights:           ScoreWeights  = DEFAULT_WEIGHTS,
  marginMultiplier:  number        = 1.15,
): ScoredProperty {
  const netRate          = Number(supplier.net_rate_per_night)     || 25000;
  const displayRateRaw   = Number(supplier.display_rate_per_night) || 0;
  const displayRate      = displayRateRaw > 0 ? displayRateRaw : Math.round(netRate * marginMultiplier);
  const gpPerNight       = displayRate - netRate;
  const nights           = context.nights || 1;

  const trustRaw   = Math.min(100, Number(supplier.trust_score)   || 50);
  const contentRaw = Math.min(100, Number(supplier.content_score) || 40);
  const gpNorm     = normaliseGP(gpPerNight);
  const seasonRaw  = seasonalFit(supplier.region_slug || '', context.checkIn);
  const availRaw   = availabilityConfidence(supplier.pms_type);

  const score = Math.min(100, Math.round(
    trustRaw   * weights.trust   +
    contentRaw * weights.content +
    gpNorm     * weights.gp      +
    seasonRaw  * weights.season  +
    availRaw   * weights.avail
  ));

  // Build upgrade options with DISPLAY prices only — never expose net components
  const upgrades = supplier.upgrades || {
    rooms:       [{ label: 'Standard Suite',  extra: 0, tier: 0 },
                  { label: 'Premium Suite',   extra: Math.round(displayRate * 0.35), tier: 1 }],
    basis:       [{ label: 'All-inclusive',   extra: 0, tier: 0 }],
    flexibility: [{ label: 'Standard',        extra: 0, tier: 0 },
                  { label: 'Flexible',        extra: Math.round(displayRate * 0.08), tier: 1 }],
  };

  return {
    id:                   supplier.id,
    name:                 supplier.name || '',
    displayPricePerNight: displayRate,
    displayPrice:         displayRate * nights,
    score,
    trustScore:           trustRaw,
    contentScore:         contentRaw,
    destination:          supplier.destination || '',
    subRegion:            supplier.region_slug || '',
    country:              supplier.country || '',
    image:                extractImage(supplier),
    funFact:              supplier.fun_fact || '',
    malariaFree:          Boolean(supplier.malaria_free || supplier.malariaFree),
    tags:                 Array.isArray(supplier.tags) ? supplier.tags : [],
    upgrades,
    pmsType:              supplier.pms_type || null,
  };
}

// ── Rank a pool of suppliers ──────────────────────────────────────────────────
export function rankProperties(
  suppliers:        any[],
  context:          ScoringContext,
  weights?:         ScoreWeights,
  marginMultiplier?: number,
): ScoredProperty[] {
  return suppliers
    .filter(s => s.is_active !== false)
    .map(s => scoreProperty(s, context, weights, marginMultiplier))
    .sort((a, b) => b.score - a.score);
}

// ── Top-N per region ──────────────────────────────────────────────────────────
export function topPropertiesPerRegion(
  suppliers:   any[],
  regionSlug:  string,
  context:     ScoringContext,
  n:           number = 4,
  weights?:    ScoreWeights,
  margin?:     number,
): ScoredProperty[] {
  const pool = suppliers.filter(s =>
    s.is_active !== false && s.region_slug === regionSlug
  );
  return rankProperties(pool, context, weights, margin).slice(0, n);
}
