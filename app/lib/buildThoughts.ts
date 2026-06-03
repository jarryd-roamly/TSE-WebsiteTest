// ─── BUILD THOUGHTS — v2 ──────────────────────────────────────────────────────
// Generates the rolling "thinking" text shown during the cinematic spinner.
// FIXES BUG #8: 3 regions in but only 2 in thoughts — now always honours N.
// FIXES BUG B3: free-text brief keywords not surfaced — now personalised.
// ─────────────────────────────────────────────────────────────────────────────

interface ThoughtContext {
  regions:        string[];       // region slugs from the actual input
  nights:         number;
  adults:         number;
  children:       number;
  infants:        number;
  budget:         number;          // ZAR
  origin:         string;          // LHR, JFK, etc.
  // From brief extraction (mode === 'brief' only)
  occasion?:      string | null;   // 'honeymoon' | 'anniversary' | ...
  style?:         string | null;
  party?:         string | null;
  themeTags?:     string[];
  briefText?:     string;
}

const REGION_LABELS: Record<string, string> = {
  'kruger-sabi-sand': 'Sabi Sand',
  'okavango-delta':   'Okavango Delta',
  'cape-town':        'Cape Town',
  'madikwe':          'Madikwe',
  'chobe-vic-falls':  'Victoria Falls',
  'masai-mara':       'Masai Mara',
  'bwindi':           'Bwindi',
  'phinda':           'Phinda',
};

const REGION_FUN_FACTS: Record<string, string[]> = {
  'kruger-sabi-sand': [
    'Sabi Sand has the highest leopard density of any reserve on Earth.',
    'Singita\'s traversing rights cover 13,000 hectares — larger than Manhattan.',
    'Private vehicles can off-road for sightings here. Most reserves cannot.',
  ],
  'okavango-delta': [
    'The Okavango is the largest inland delta in the world.',
    '95% of the Delta is private concessions — meaning low vehicle density.',
    'Wild dog populations here are growing — the only big African predator on the rise.',
  ],
  'cape-town': [
    'Table Mountain is one of the New Seven Wonders of Nature.',
    'The Cape Floral Kingdom is the smallest of the world\'s six floral kingdoms.',
    'Cape Town gets more direct hours of sunshine annually than most Mediterranean cities.',
  ],
  'madikwe': [
    'Madikwe is one of only two reserves in Africa with stable wild dog and rhino populations.',
    'No day visitors are permitted — every guest is staying overnight.',
    'The reserve was created from former cattle farmland — a conservation success story.',
  ],
  'chobe-vic-falls': [
    'Victoria Falls is twice the height of Niagara, twice the width.',
    'Chobe has the largest elephant population in Africa — over 50,000.',
    'The local name for the Falls is "Mosi-oa-Tunya" — the smoke that thunders.',
  ],
  'masai-mara': [
    '1.5 million wildebeest cross the Mara River each year between July and October.',
    'The Mara is home to over 22 lion prides — the highest density in Africa.',
    'Hot air balloon safaris depart at first light — landing for champagne breakfast.',
  ],
  'bwindi': [
    'Bwindi means "place of darkness" in the local language.',
    'Half the world\'s remaining mountain gorillas live here.',
    'Permits are limited to 8 trekkers per gorilla family per day.',
  ],
};

// ── Per-region "thinking" lines (rotated through during spinner) ─────────────
const REGION_THINKING: Record<string, string[]> = {
  'kruger-sabi-sand': [
    'Reviewing leopard sighting data for the past 90 days...',
    'Cross-referencing Sabi Sand lodge availability...',
    'Checking traversing rights and concession boundaries...',
    'Calibrating private game drive vehicle ratios...',
  ],
  'okavango-delta': [
    'Mapping mokoro routes through the Delta channels...',
    'Confirming flood levels affect water-based activities...',
    'Reviewing wild dog pack locations...',
    'Checking helicopter charter availability for transfers...',
  ],
  'cape-town': [
    'Selecting boutique hotels along the Atlantic Seaboard...',
    'Reviewing private winelands tour operators...',
    'Checking Table Mountain cable car availability...',
    'Sourcing Robben Island ferry timings...',
  ],
  'madikwe': [
    'Confirming family-friendly camps with children\'s programmes...',
    'Reviewing wild dog and rhino sighting patterns...',
    'Cross-checking road transfer times from Johannesburg...',
    'Verifying malaria-free zone boundaries...',
  ],
  'chobe-vic-falls': [
    'Sourcing sunset cruise availability on the Zambezi...',
    'Reviewing Falls activity packages — gorge walks, helicopter flips...',
    'Coordinating Chobe day trip with elephant herd movements...',
    'Confirming border transfer logistics Zambia ↔ Zimbabwe...',
  ],
  'masai-mara': [
    'Tracking the Great Migration progress through the corridor...',
    'Reviewing river crossing hotspots — Mara River, Talek River...',
    'Sourcing hot air balloon operators with safety certification...',
    'Checking conservancy access (Olare Motorogi, Mara North)...',
  ],
  'bwindi': [
    'Confirming gorilla trekking permit availability...',
    'Reviewing forest lodge locations relative to gorilla families...',
    'Checking Volcanoes vs Bwindi alternatives based on group strength...',
    'Coordinating Entebbe and Kigali transfer options...',
  ],
};

// ── Universal opener lines ───────────────────────────────────────────────────
const OPENER_LINES = [
  'Reading the brief...',
  'Cross-checking specialist Knowledge Base entries...',
  'Pulling availability across preferred suppliers...',
];

// ── Theme-driven lines (appear once each, mid-sequence) ──────────────────────
const OCCASION_LINES: Record<string, string> = {
  honeymoon:   'Filtering for private, romantic retreats...',
  anniversary: 'Prioritising properties known for milestone moments...',
  birthday:    'Looking for memorable, story-worthy lodges...',
  babymoon:    'Filtering to malaria-free, low-altitude options...',
  retirement:  'Sourcing premium options with relaxed pacing...',
};

const STYLE_LINES: Record<string, string> = {
  adventure:    'Sourcing walking safaris, horseback, helicopter add-ons...',
  photography:  'Reviewing photography-host guides and hide access...',
  conservation: 'Identifying lodges with active research and rhino projects...',
  romantic:     'Filtering for private decks, outdoor showers, exclusive-use camps...',
  luxury:       'Including butler service, helicopter transfers, wine pairing...',
  wildlife:     'Optimising for predator density and Big Five sighting rates...',
  cultural:     'Including community visits and heritage experiences...',
};

const PARTY_LINES: Record<string, string> = {
  family:           'Prioritising family-friendly camps with children\'s programmes...',
  multigenerational: 'Sourcing camps suitable for three generations under one roof...',
  group:            'Reviewing group-buyout options and family suites...',
  solo:             'Including hosted-table dining and small group drives...',
  friends:          'Considering exclusive-use camps for the whole party...',
};

// ── Budget-aware lines ────────────────────────────────────────────────────────
function budgetLine(budget: number): string | null {
  if (budget <= 0)         return null;
  if (budget < 100000)     return 'Calibrating value-led options without compromising quality...';
  if (budget < 250000)     return 'Reviewing well-known properties with strong reputations...';
  if (budget < 600000)     return 'Including signature lodges across our preferred suppliers...';
  if (budget < 1200000)    return 'Considering exclusive-use camps and helicopter transfers...';
  return 'Reviewing the most exclusive properties — including private islands and full-house buyouts...';
}

// ── Closing lines ────────────────────────────────────────────────────────────
const CLOSING_LINES = [
  'Sequencing the routing to minimise transit time...',
  'Verifying seasonal weather conditions for travel dates...',
  'Applying margin optimisation across the package...',
  'Final integrity check — assembling your journey...',
];

// ── Main exported function ────────────────────────────────────────────────────
export function buildThoughtsV2(ctx: ThoughtContext): string[] {
  const out: string[] = [];

  // Opener
  out.push(...OPENER_LINES);

  // ── Region-specific thinking — ALWAYS one line per region selected ────────
  for (const slug of ctx.regions) {
    const label = REGION_LABELS[slug] || slug.replace(/-/g, ' ');
    const lines = REGION_THINKING[slug] || [];
    if (lines.length > 0) {
      out.push(lines[0]);  // first line per region
    } else {
      out.push(`Reviewing lodges in ${label}...`);
    }
  }

  // ── Add a "fact-discovery" line per region ────────────────────────────────
  for (const slug of ctx.regions) {
    const facts = REGION_FUN_FACTS[slug] || [];
    if (facts.length > 0) {
      const fact = facts[Math.floor(Math.random() * facts.length)];
      out.push(`Note: ${fact}`);
    }
  }

  // ── Travel party context ──────────────────────────────────────────────────
  if (ctx.party && PARTY_LINES[ctx.party]) out.push(PARTY_LINES[ctx.party]);

  // ── Occasion context ──────────────────────────────────────────────────────
  if (ctx.occasion && ctx.occasion !== 'none' && OCCASION_LINES[ctx.occasion]) {
    out.push(OCCASION_LINES[ctx.occasion]);
  }

  // ── Style context ─────────────────────────────────────────────────────────
  if (ctx.style && STYLE_LINES[ctx.style]) out.push(STYLE_LINES[ctx.style]);

  // ── Malaria + infants ─────────────────────────────────────────────────────
  if (ctx.infants > 0) out.push('Filtering to malaria-free regions for infant travellers...');

  // ── Budget ────────────────────────────────────────────────────────────────
  const bl = budgetLine(ctx.budget);
  if (bl) out.push(bl);

  // ── Origin-specific flight line ───────────────────────────────────────────
  if (ctx.origin) {
    const map: Record<string, string> = {
      LHR: 'Reviewing London → Johannesburg direct flights with BA, Virgin, SAA...',
      JFK: 'Sourcing New York → Johannesburg via direct (Delta) or one-stop (Doha, Dubai)...',
      LAX: 'Reviewing Los Angeles → Africa routings via Doha or Dubai...',
      FRA: 'Sourcing Frankfurt → Johannesburg with Lufthansa direct service...',
      AMS: 'Reviewing Amsterdam → Johannesburg via KLM direct...',
      DXB: 'Sourcing Dubai → Africa with Emirates daily service...',
    };
    if (map[ctx.origin]) out.push(map[ctx.origin]);
  }

  // ── Closing ───────────────────────────────────────────────────────────────
  out.push(...CLOSING_LINES);

  return out;
}

// ── Get a region fun fact for the confirmation page ──────────────────────────
export function getRegionFunFact(slug: string): string {
  const facts = REGION_FUN_FACTS[slug];
  if (!facts || facts.length === 0) return '';
  return facts[Math.floor(Math.random() * facts.length)];
}

// ── Get all fun facts for a region (for the confirming-journey panel) ────────
export function getAllRegionFunFacts(slugs: string[]): Array<{ region: string; facts: string[] }> {
  return slugs.map(slug => ({
    region: REGION_LABELS[slug] || slug,
    facts:  REGION_FUN_FACTS[slug] || [],
  }));
}
