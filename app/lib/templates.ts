// ─── TEMPLATE LIBRARY ─────────────────────────────────────────────────────────
// 12 canonical safari circuits. Matched before any AI call.
// Template hit = instant response, zero AI cost (~75% of bookings).
// HANDOVER: Add new templates here as new supplier regions are added.
// Templates reference regionSlug, not specific properties — the scoring
// engine assigns the best property in that region at query time.
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplateCity {
  city:       string;
  country:    string;
  regionSlug: string;
  nights:     number;  // base nights — scaled proportionally for other night counts
  why:        string;
  highlights: string[];
}

export interface JourneyTemplate {
  id:           string;
  name:         string;
  routing:      string;  // e.g. 'JNB → Sabi Sand → Maun → Okavango → JNB'
  summary:      string;
  bestTiming:   string;
  cities:       TemplateCity[];
  nightsBase:   number;  // canonical total this template was built for
  nightsMin:    number;  // minimum nights this template works for
  nightsMax:    number;  // maximum nights before it needs splitting
  themes:       Array<'honeymoon'|'family'|'adventure'|'first-timer'|'returning'|'anniversary'>;
  markets:      Array<'uk'|'us'|'de'|'all'>;
  malariaFree:  boolean;
}

export const TEMPLATES: JourneyTemplate[] = [

  // ── 1. Sabi Sand Classic ────────────────────────────────────────────────────
  {
    id: 'sabi-classic', name: 'Sabi Sand Classic',
    routing: 'JNB → Sabi Sand → JNB',
    summary: 'The benchmark safari. Highest leopard density on Earth. Private traversing rights — no other vehicles at sightings.',
    bestTiming: 'June–September: dry season, short grass, animals at waterholes. Peak June–August.',
    cities: [{
      city: 'Kruger / Sabi Sand', country: 'South Africa', regionSlug: 'kruger-sabi-sand', nights: 4,
      why: 'The finest leopard territory on Earth. Twice-daily drives in private concessions.',
      highlights: ['Leopard tracking', 'Lion pride at sunset', 'Night drive', 'Sundowner in the bush'],
    }],
    nightsBase: 4, nightsMin: 3, nightsMax: 7,
    themes: ['honeymoon','adventure','first-timer','anniversary'],
    markets: ['all'], malariaFree: false,
  },

  // ── 2. Sabi Sand + Cape Town ────────────────────────────────────────────────
  {
    id: 'sabi-cape', name: 'Safari & Cape Town',
    routing: 'JNB → Sabi Sand → CPT → home',
    summary: 'The classic South Africa combination. Bush first, city second. Each amplifies the other.',
    bestTiming: 'Oct–April: Cape Town in summer, game still excellent in Sabi Sand year-round.',
    cities: [
      { city: 'Kruger / Sabi Sand', country: 'South Africa', regionSlug: 'kruger-sabi-sand', nights: 4, why: 'Open with the finest Big Five territory.', highlights: ['Leopard', 'Lion', 'Night drive'] },
      { city: 'Cape Town', country: 'South Africa', regionSlug: 'cape-town', nights: 4, why: 'The perfect city chapter after the bush.', highlights: ['Table Mountain', 'Winelands', 'Atlantic coast', 'Cape Point'] },
    ],
    nightsBase: 8, nightsMin: 6, nightsMax: 13,
    themes: ['honeymoon','first-timer','anniversary'],
    markets: ['uk','us'], malariaFree: false,
  },

  // ── 3. Sabi Sand + Okavango ─────────────────────────────────────────────────
  {
    id: 'sabi-okavango', name: 'Sabi Sand & Okavango',
    routing: 'JNB → Sabi Sand → Maun → Okavango → JNB',
    summary: 'Two of Africa\'s finest wilderness areas. Dry Lowveld then the water world. The most-requested two-country circuit.',
    bestTiming: 'June–September: peak dry season in both. Perfect sequencing — start with predators, end with water.',
    cities: [
      { city: 'Kruger / Sabi Sand', country: 'South Africa', regionSlug: 'kruger-sabi-sand', nights: 4, why: 'World-class predator territory.', highlights: ['Leopard', 'Lion', 'Wild dog'] },
      { city: 'Okavango Delta', country: 'Botswana', regionSlug: 'okavango-delta', nights: 3, why: 'Complete contrast — water, mokoro, no roads.', highlights: ['Mokoro at dawn', 'Wild dog pack', 'Night sounds'] },
    ],
    nightsBase: 7, nightsMin: 6, nightsMax: 12,
    themes: ['adventure','honeymoon','returning'],
    markets: ['all'], malariaFree: false,
  },

  // ── 4. Sabi Sand + Victoria Falls ───────────────────────────────────────────
  {
    id: 'sabi-vic-falls', name: 'Sabi Sand & Victoria Falls',
    routing: 'JNB → Sabi Sand → VFA → Victoria Falls → JNB',
    summary: 'Bush then one of the Seven Natural Wonders of the World. The US market\'s most-requested pairing.',
    bestTiming: 'August–October: game excellent, Falls powerful. July ideal for combination.',
    cities: [
      { city: 'Kruger / Sabi Sand', country: 'South Africa', regionSlug: 'kruger-sabi-sand', nights: 4, why: 'The finest predator territory to open.', highlights: ['Leopard', 'Lion', 'Night drive'] },
      { city: 'Victoria Falls', country: 'Zimbabwe', regionSlug: 'chobe-vic-falls', nights: 3, why: 'The natural wonder chapter.', highlights: ['The Falls by foot', 'Zambezi sunset cruise', 'Chobe day trip'] },
    ],
    nightsBase: 7, nightsMin: 5, nightsMax: 11,
    themes: ['first-timer','adventure','anniversary'],
    markets: ['us'], malariaFree: false,
  },

  // ── 5. Grand Circuit ────────────────────────────────────────────────────────
  {
    id: 'grand-circuit', name: 'The Grand Safari Circuit',
    routing: 'JNB → Sabi Sand → Maun → Okavango → VFA → Victoria Falls → JNB',
    summary: 'Three countries. Three ecosystems. The safari as it should be done when time is not the constraint.',
    bestTiming: 'July–September: all three destinations simultaneously at their peak.',
    cities: [
      { city: 'Kruger / Sabi Sand', country: 'South Africa', regionSlug: 'kruger-sabi-sand', nights: 4, why: 'The predator chapter.', highlights: ['Leopard', 'Lion', 'Elephant'] },
      { city: 'Okavango Delta', country: 'Botswana', regionSlug: 'okavango-delta', nights: 3, why: 'The water world chapter.', highlights: ['Mokoro', 'Wild dog', 'Helicopter flight'] },
      { city: 'Victoria Falls', country: 'Zimbabwe', regionSlug: 'chobe-vic-falls', nights: 2, why: 'The wonder chapter.', highlights: ['The Falls', 'Zambezi sunset', 'Chobe National Park'] },
    ],
    nightsBase: 9, nightsMin: 8, nightsMax: 14,
    themes: ['adventure','returning','honeymoon','anniversary'],
    markets: ['us','uk'], malariaFree: false,
  },

  // ── 6. Southern Africa Grand Tour ───────────────────────────────────────────
  {
    id: 'grand-tour', name: 'Southern Africa Grand Tour',
    routing: 'JNB → Sabi Sand → Okavango → Victoria Falls → Cape Town → home',
    summary: 'The definitive southern Africa journey for those who want to experience everything.',
    bestTiming: 'June–October: all four destinations near or at their best.',
    cities: [
      { city: 'Kruger / Sabi Sand', country: 'South Africa', regionSlug: 'kruger-sabi-sand', nights: 4, why: 'The predator foundation.', highlights: ['Leopard', 'Lion'] },
      { city: 'Okavango Delta', country: 'Botswana', regionSlug: 'okavango-delta', nights: 3, why: 'Water world and wild dog.', highlights: ['Mokoro', 'Wild dog'] },
      { city: 'Victoria Falls', country: 'Zimbabwe', regionSlug: 'chobe-vic-falls', nights: 2, why: 'The natural wonder.', highlights: ['The Falls', 'Zambezi'] },
      { city: 'Cape Town', country: 'South Africa', regionSlug: 'cape-town', nights: 4, why: 'The city finale.', highlights: ['Table Mountain', 'Winelands'] },
    ],
    nightsBase: 13, nightsMin: 11, nightsMax: 20,
    themes: ['honeymoon','returning','anniversary'],
    markets: ['us','uk'], malariaFree: false,
  },

  // ── 7. Malaria-Free Family Safari ───────────────────────────────────────────
  {
    id: 'malaria-free-family', name: 'Malaria-Free Family Safari',
    routing: 'JNB → Madikwe → JNB',
    summary: 'Big Five without the malaria risk. Designed for families. Child-friendly guiding, no prophylactics.',
    bestTiming: 'Year-round. June–September for best game viewing. December holidays popular.',
    cities: [{
      city: 'Madikwe', country: 'South Africa', regionSlug: 'madikwe', nights: 4,
      why: 'Malaria-free Big Five. 90 minutes from Johannesburg. Purpose-built for families.',
      highlights: ['Wild dog', 'Big Five', 'Family game drive', 'Children\'s programme'],
    }],
    nightsBase: 4, nightsMin: 3, nightsMax: 7,
    themes: ['family'],
    markets: ['all'], malariaFree: true,
  },

  // ── 8. Cape Town + Madikwe (malaria-free) ───────────────────────────────────
  {
    id: 'malaria-free-circuit', name: 'Cape Town & Madikwe',
    routing: 'CPT → Cape Town → JNB → Madikwe → JNB',
    summary: 'Entirely malaria-free. City brilliance then wilderness. Perfect for families or those avoiding prophylactics.',
    bestTiming: 'Nov–April: Cape Town summer. Madikwe year-round.',
    cities: [
      { city: 'Cape Town', country: 'South Africa', regionSlug: 'cape-town', nights: 4, why: 'City and mountain. No malaria.', highlights: ['Table Mountain', 'Winelands', 'Seal Island'] },
      { city: 'Madikwe', country: 'South Africa', regionSlug: 'madikwe', nights: 3, why: 'Big Five without malaria. 90 min from JNB.', highlights: ['Wild dog', 'Big Five', 'Boma dinner'] },
    ],
    nightsBase: 7, nightsMin: 5, nightsMax: 12,
    themes: ['family','honeymoon'],
    markets: ['all'], malariaFree: true,
  },

  // ── 9. Okavango Immersion ────────────────────────────────────────────────────
  {
    id: 'okavango-deep', name: 'Okavango Delta Immersion',
    routing: 'JNB → Maun → Okavango → Maun → JNB',
    summary: 'A focused Botswana journey. The Delta deserves more than 3 nights.',
    bestTiming: 'July–October: flood peaks July–August, wild dog pupping August–September.',
    cities: [{
      city: 'Okavango Delta', country: 'Botswana', regionSlug: 'okavango-delta', nights: 5,
      why: 'The Delta at depth. Multiple concessions, multiple experiences.',
      highlights: ['Mokoro at dawn', 'Walking safari', 'Wild dog', 'Night sounds', 'Helicopter flight'],
    }],
    nightsBase: 5, nightsMin: 4, nightsMax: 8,
    themes: ['adventure','honeymoon','returning'],
    markets: ['all'], malariaFree: false,
  },

  // ── 10. Masai Mara Migration ─────────────────────────────────────────────────
  {
    id: 'masai-mara-migration', name: 'Masai Mara Great Migration',
    routing: 'NBO → Masai Mara → NBO',
    summary: 'The greatest wildlife spectacle on Earth. 1.5 million wildebeest. Mara River crossings.',
    bestTiming: 'July–October: peak migration. River crossings July–September. Resident game year-round.',
    cities: [{
      city: 'Masai Mara', country: 'Kenya', regionSlug: 'masai-mara', nights: 4,
      why: 'The Great Migration. The world\'s most extraordinary wildlife event.',
      highlights: ['Mara River crossing', 'Hot air balloon at dawn', 'Lion prides — 22 resident', 'Cheetah with cubs'],
    }],
    nightsBase: 4, nightsMin: 3, nightsMax: 7,
    themes: ['adventure','returning'],
    markets: ['us','uk'], malariaFree: false,
  },

  // ── 11. East & Southern Combo ────────────────────────────────────────────────
  {
    id: 'east-southern', name: 'East & Southern Africa',
    routing: 'NBO → Masai Mara → JNB → Okavango → JNB',
    summary: 'Two iconic wilderness areas. Migration in Kenya, permanent water world in Botswana.',
    bestTiming: 'July–September: both at peak simultaneously.',
    cities: [
      { city: 'Masai Mara', country: 'Kenya', regionSlug: 'masai-mara', nights: 4, why: 'Migration and river crossings.', highlights: ['River crossing', 'Hot air balloon', 'Big Five'] },
      { city: 'Okavango Delta', country: 'Botswana', regionSlug: 'okavango-delta', nights: 3, why: 'Permanent water wilderness.', highlights: ['Mokoro', 'Wild dog', 'Bush walks'] },
    ],
    nightsBase: 7, nightsMin: 6, nightsMax: 12,
    themes: ['adventure','returning'],
    markets: ['us'], malariaFree: false,
  },

  // ── 12. Gorilla + Safari ─────────────────────────────────────────────────────
  {
    id: 'gorilla-safari', name: 'Gorilla Trekking + Safari',
    routing: 'EBB → Bwindi → Maun → Okavango → JNB',
    summary: 'Gorilla trekking then the Okavango. The most extraordinary wildlife double bill available.',
    bestTiming: 'June–September: best trekking conditions in Bwindi, peak season in Okavango.',
    cities: [
      { city: 'Bwindi', country: 'Uganda', regionSlug: 'bwindi', nights: 3, why: 'Half the world\'s mountain gorillas. One hour with a family group.', highlights: ['Mountain gorilla trekking', 'Forest walks', 'Habituation experience'] },
      { city: 'Okavango Delta', country: 'Botswana', regionSlug: 'okavango-delta', nights: 4, why: 'The water world to follow the forest.', highlights: ['Mokoro', 'Wild dog', 'Night sounds'] },
    ],
    nightsBase: 7, nightsMin: 5, nightsMax: 12,
    themes: ['adventure','returning'],
    markets: ['us','uk'], malariaFree: false,
  },

];

// ── Template matcher ──────────────────────────────────────────────────────────
export interface MatchContext {
  regions:            string[];   // selected region slugs
  nights:             number;
  hasInfants:         boolean;
  requiresMalariaFree: boolean;
}

export function matchTemplate(ctx: MatchContext): JourneyTemplate | null {
  const candidates = TEMPLATES.filter(t => {
    // Malaria constraint
    if ((ctx.hasInfants || ctx.requiresMalariaFree) && !t.malariaFree) return false;
    // Night range
    if (ctx.nights < t.nightsMin || ctx.nights > t.nightsMax) return false;
    // Region match: if user selected specific regions, template must include ALL of them
    if (ctx.regions.length > 0) {
      const templateSlugs = new Set(t.cities.map(c => c.regionSlug));
      if (!ctx.regions.every(r => templateSlugs.has(r))) return false;
    }
    return true;
  });

  if (!candidates.length) return null;

  // Score candidates by closeness of night match and region coverage
  const scored = candidates.map(t => {
    const nightDiff  = Math.abs(t.nightsBase - ctx.nights);
    const regionHits = ctx.regions.length > 0
      ? ctx.regions.filter(r => t.cities.map(c => c.regionSlug).includes(r)).length
      : t.cities.length; // no preference = broader templates rank higher
    return { template: t, nightDiff, regionHits };
  }).sort((a, b) =>
    a.nightDiff - b.nightDiff || b.regionHits - a.regionHits
  );

  return scored[0]?.template ?? null;
}

// ── Scale template to target night count ──────────────────────────────────────
// Distributes nights proportionally, guarantees total === targetNights
export function scaleTemplate(
  template:     JourneyTemplate,
  targetNights: number,
): TemplateCity[] {
  const scaled = template.cities.map(c => ({
    ...c,
    nights: Math.max(2, Math.round((c.nights / template.nightsBase) * targetNights)),
  }));

  // Fix rounding so total === targetNights
  const total = scaled.reduce((s, c) => s + c.nights, 0);
  const diff  = targetNights - total;
  if (diff !== 0) scaled[0].nights = Math.max(2, scaled[0].nights + diff);

  return scaled;
}

// ── Helper: template IDs for "Inspire Me" randomisation ──────────────────────
export function getTemplateById(id: string): JourneyTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByTheme(
  theme: JourneyTemplate['themes'][number],
): JourneyTemplate[] {
  return TEMPLATES.filter(t => t.themes.includes(theme));
}
