// ─── BUILD THOUGHTS — v3 ──────────────────────────────────────────────────────
// Generates rolling "thinking" text during the cinematic spinner.
// v3: Smart context-aware selection — no family lines without children,
//     month-specific seasonal commentary, multi-region logistics,
//     ID→slug mapping so regions work regardless of format.
// ─────────────────────────────────────────────────────────────────────────────

interface ThoughtContext {
  regions:      string[];   // region IDs ('kruger') or slugs ('kruger-sabi-sand')
  nights:       number;
  adults:       number;
  children:     number;
  infants:      number;
  budget:       number;     // ZAR
  origin:       string;     // LHR, JFK, etc.
  occasion?:    string;     // 'honeymoon' | 'anniversary' | 'family' | etc.
  checkinDate?: string;     // 'YYYY-MM-DD' specific date
  flexMonth?:   string;     // 'YYYY-MM' month selection
  // Brief mode only
  style?:       string;
  party?:       string;
  briefText?:   string;
  themeTags?:   string[];
}

// ── ID → slug normalisation ───────────────────────────────────────────────────
// page.tsx passes region IDs ('kruger', 'chobe'), buildThoughts uses slugs
const ID_TO_SLUG: Record<string, string> = {
  'kruger':     'kruger-sabi-sand',
  'okavango':   'okavango-delta',
  'cape-town':  'cape-town',
  'madikwe':    'madikwe',
  'chobe':      'chobe-vic-falls',
  'masai-mara': 'masai-mara',
  'bwindi':     'bwindi',
  'phinda':     'phinda',
};

function toSlug(id: string): string {
  return ID_TO_SLUG[id] || id;
}

// ── Region display labels ─────────────────────────────────────────────────────
const REGION_LABELS: Record<string, string> = {
  'kruger-sabi-sand': 'Sabi Sand',
  'okavango-delta':   'Okavango Delta',
  'cape-town':        'Cape Town',
  'madikwe':          'Madikwe',
  'chobe-vic-falls':  'Victoria Falls / Chobe',
  'masai-mara':       'Masai Mara',
  'bwindi':           'Bwindi',
  'phinda':           'Phinda',
};

// ── Region fun facts ──────────────────────────────────────────────────────────
const REGION_FUN_FACTS: Record<string, string[]> = {
  'kruger-sabi-sand': [
    'Sabi Sand has the highest leopard density of any private reserve on Earth.',
    'Singita\'s traversing rights cover 13,000 hectares — larger than Manhattan.',
    'Private vehicles can off-road for sightings here. Most national parks cannot.',
  ],
  'okavango-delta': [
    'The Okavango is the largest inland delta in the world.',
    '95% of the Delta is private concessions — low vehicle density guaranteed.',
    'Wild dog populations here are growing — the only major African predator on the rise.',
  ],
  'cape-town': [
    'Table Mountain is one of the New Seven Wonders of Nature.',
    'The Cape Peninsula has more plant species than the entire United Kingdom.',
    'Cape Town has more hours of sunshine annually than most Mediterranean cities.',
  ],
  'madikwe': [
    'Madikwe is malaria-free — no prophylactics required.',
    'The reserve was created from former cattle farmland — Africa\'s largest conservation success.',
    'Wild dogs and rhinos coexist here — two of Africa\'s most endangered species.',
  ],
  'chobe-vic-falls': [
    'Victoria Falls is twice the height of Niagara and twice the width.',
    'Chobe has the highest elephant concentration in Africa — over 50,000 individuals.',
    'The local name for the Falls is Mosi-oa-Tunya — the smoke that thunders.',
  ],
  'masai-mara': [
    '1.5 million wildebeest cross the Mara River each year between July and October.',
    'The Mara is home to over 22 lion prides — the highest density in Africa.',
    'Hot air balloon safaris depart at first light, landing for champagne breakfast.',
  ],
  'bwindi': [
    'Half the world\'s remaining mountain gorillas live in Bwindi.',
    'Permits are limited to 8 trekkers per gorilla family per day.',
    'Bwindi means "place of darkness" in the local language — ancient and otherworldly.',
  ],
};

// ── Region thinking lines ─────────────────────────────────────────────────────
// Structure: general lines first, conditional (family/children) lines last
// Smart picker selects based on profile

interface RegionLines {
  general:    string[];
  withKids?:  string[];   // only shown if children > 0
  malaria?:   string;     // shown if infants > 0 and region has malaria
  romantic?:  string[];   // shown for honeymoon/anniversary
}

const REGION_THINKING: Record<string, RegionLines> = {
  'kruger-sabi-sand': {
    general:   [
      'Reviewing leopard sighting data for the past 90 days in Sabi Sand...',
      'Cross-referencing 14 private reserve concession maps...',
      'Calibrating game vehicle ratios — six is the private reserve maximum...',
      'Checking traversing rights and off-road access across concession boundaries...',
    ],
    romantic:  [
      'Identifying lodges with private outdoor showers and sundeck bush dinners...',
    ],
    withKids:  [
      'Confirming minimum age requirements — some lodges restrict under-12 on drives...',
    ],
  },
  'okavango-delta': {
    general:   [
      'Mapping mokoro routes through the Delta channels for water-based activities...',
      'Reviewing wild dog pack locations — three packs active this quarter...',
      'Checking internal charter availability for camp-to-camp transfers...',
      'Confirming flood level forecasts — affects water-based activity access...',
    ],
    romantic:  [
      'Sourcing private island camps and exclusive-use options in the Delta...',
    ],
    withKids:  [
      'Reviewing minimum age for mokoro activities and walking safaris...',
    ],
    malaria:   'Recommending malaria prophylactics for Delta travel...',
  },
  'cape-town': {
    general:   [
      'Reviewing boutique properties along the Atlantic Seaboard...',
      'Sequencing winelands, peninsula, and city experiences across available nights...',
      'Sourcing private transfer options from the airport to preferred properties...',
      'Checking Table Mountain accessibility and cable car availability...',
    ],
    romantic:  [
      'Identifying cliffside suites with ocean views and private terraces...',
    ],
    withKids:  [
      'Confirming family suites and connecting room configurations in Cape Town...',
    ],
  },
  'madikwe': {
    general:   [
      'Reviewing wild dog and rhino sighting patterns — both resident species here...',
      'Confirming road transfer timing from Johannesburg Tambo — three hours direct...',
      'Verifying malaria-free zone boundaries and medical facilities nearby...',
      'Cross-checking Big Five sighting density for the current season...',
    ],
    romantic:  [
      'Identifying private plunge pool suites and bush dinner options in Madikwe...',
    ],
    withKids:  [
      'Confirming family-friendly camps with dedicated children\'s programmes and guides...',
    ],
  },
  'chobe-vic-falls': {
    general:   [
      'Reviewing sunset cruise availability on the Zambezi River...',
      'Sourcing gorge walk and helicopter flip packages at the Falls...',
      'Confirming Zambia ↔ Zimbabwe border crossing logistics and timing...',
      'Coordinating Chobe elephant herds — late afternoon concentrations...',
    ],
    romantic:  [
      'Sourcing private Devil\'s Pool access and candlelit Falls dinner options...',
    ],
    withKids:  [
      'Reviewing age requirements for gorge activities — some have minimum restrictions...',
    ],
  },
  'masai-mara': {
    general:   [
      'Tracking Great Migration progress through the Mara-Serengeti corridor...',
      'Reviewing river crossing hotspot access — Mara River and Talek...',
      'Sourcing balloon operators with aviation safety certifications...',
      'Checking conservancy access — Olare Motorogi and Mara North available...',
    ],
    romantic:  [
      'Identifying intimate tented camps with private Mara views and butler service...',
    ],
    withKids:  [
      'Confirming conservancy camps suitable for young travellers on game drives...',
    ],
  },
  'bwindi': {
    general:   [
      'Confirming gorilla trekking permit availability — limited to 8 per family group per day...',
      'Reviewing forest lodge locations relative to habituated gorilla families...',
      'Coordinating Entebbe arrival and Kigali departure transfer options...',
      'Assessing trek difficulty levels against the group\'s fitness profile...',
    ],
  },
};

// ── Pick best region line based on profile ────────────────────────────────────
function pickRegionLine(slug: string, ctx: ThoughtContext): string {
  const entry = REGION_THINKING[slug];
  const label = REGION_LABELS[slug] || slug.replace(/-/g, ' ');

  if (!entry) return `Reviewing lodge options in ${label}...`;

  const hasKids     = (ctx.children || 0) > 0 || (ctx.infants || 0) > 0;
  const isRomantic  = ['honeymoon', 'anniversary'].includes(ctx.occasion || '');
  const isFamilyOcc = ctx.occasion === 'family';

  // Priority: occasion-specific > children-specific > general
  if ((isRomantic) && entry.romantic?.length) return entry.romantic[0];
  if ((hasKids || isFamilyOcc) && entry.withKids?.length) return entry.withKids[0];
  return entry.general[0] || `Reviewing lodge options in ${label}...`;
}

// Pick a second distinct line for a region (for longer itineraries)
function pickRegionLine2(slug: string, ctx: ThoughtContext): string | null {
  const entry = REGION_THINKING[slug];
  if (!entry || entry.general.length < 2) return null;
  return entry.general[1];
}

// ── Month-aware seasonal lines ────────────────────────────────────────────────
function getMonthNumber(ctx: ThoughtContext): number | null {
  if (ctx.checkinDate) {
    const m = new Date(ctx.checkinDate).getMonth() + 1;
    return isNaN(m) ? null : m;
  }
  if (ctx.flexMonth) {
    const parts = ctx.flexMonth.split('-');
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      return isNaN(m) ? null : m;
    }
  }
  return null;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getSeasonalLine(ctx: ThoughtContext, slugs: string[]): string | null {
  const month = getMonthNumber(ctx);
  if (!month) return 'Verifying seasonal wildlife conditions for travel dates...';

  const name = MONTH_NAMES[month - 1];

  // Check if Masai Mara in selection — migration timing is critical
  if (slugs.includes('masai-mara')) {
    if (month >= 7 && month <= 10) return `${name} is peak Migration season — confirming river crossing probability...`;
    if (month >= 11 || month <= 3) return `${name}: resident wildlife excellent, Migration in Serengeti. Confirming best corridors...`;
  }

  // General SA/Botswana seasonal lines
  if (month >= 6 && month <= 9) {
    return `${name} is peak dry season — maximum wildlife concentration around water sources...`;
  }
  if (month === 10) {
    return `October is build-up month — hot, dramatic skies, exceptional predator activity before rains...`;
  }
  if (month === 5) {
    return `May: dry season just starting — vegetation thinning, wildlife beginning to concentrate...`;
  }
  if (month >= 11 || month <= 2) {
    return `${name} is green season — lush landscapes, excellent birding, competitive rates on some properties...`;
  }
  if (month >= 3 && month <= 4) {
    return `${name}: shoulder season — tail end of rains, uncrowded reserves, lower vehicle density...`;
  }
  return `Verifying seasonal wildlife conditions for ${name} travel...`;
}

// ── Multi-region logistics lines ─────────────────────────────────────────────
function getLogisticsLines(slugs: string[]): string[] {
  if (slugs.length < 2) return [];

  const out: string[] = [];
  const has = (s: string) => slugs.includes(s);

  // Specific combinations
  if (has('kruger-sabi-sand') && has('madikwe')) {
    out.push('Both Sabi Sand and Madikwe accessible from Johannesburg — sequencing road and air transfers...');
  } else if (has('kruger-sabi-sand') && has('okavango-delta')) {
    out.push('Coordinating Sabi Sand → Kasane charter routing to minimise transit hours...');
  } else if (has('okavango-delta') && has('chobe-vic-falls')) {
    out.push('Classic Botswana circuit — internal charter from Delta to Kasane confirmed...');
  } else if (has('kruger-sabi-sand') && has('cape-town')) {
    out.push('Sequencing bush-before-beach — Sabi Sand first, Cape Town extension to close...');
  } else if (has('madikwe') && has('cape-town')) {
    out.push('Malaria-free combination — Madikwe and Cape Town, both excellent year-round...');
  } else if (slugs.length >= 3) {
    out.push(`Mapping the optimal routing sequence across ${slugs.length} destinations to minimise transit time...`);
  } else {
    out.push('Sequencing the routing to minimise total transit time between destinations...');
  }

  return out;
}

// ── Universal openers ─────────────────────────────────────────────────────────
const OPENER_LINES = [
  'Reading the brief...',
  'Cross-checking specialist Knowledge Base entries...',
  'Pulling availability across preferred suppliers...',
];

// ── Occasion lines ────────────────────────────────────────────────────────────
const OCCASION_LINES: Record<string, string> = {
  honeymoon:   'Filtering for private, romantic retreats with exclusive-use options...',
  anniversary: 'Prioritising properties known for milestone moments and personal touches...',
  birthday:    'Looking for memorable, story-worthy lodges with special occasion service...',
  babymoon:    'Filtering strictly to malaria-free, low-altitude, relaxed-pace options...',
  retirement:  'Sourcing premium properties with relaxed pacing and suite-level service...',
  family:      'Prioritising family-friendly properties with dedicated guides and programmes...',
  adventure:   'Sourcing walking safaris, horseback rides, and helicopter excursion options...',
  'bucket-list': 'Identifying the top-tier signature experiences across each destination...',
  'returning':   'You\'ve been before — identifying new properties and deeper experiences...',
};

// ── Style lines ───────────────────────────────────────────────────────────────
const STYLE_LINES: Record<string, string> = {
  adventure:    'Sourcing walking safaris, horseback, fly-camping and helicopter add-ons...',
  photography:  'Reviewing photography-host guides and hide access across the shortlist...',
  conservation: 'Identifying lodges with active research programmes and rhino projects...',
  romantic:     'Filtering for private decks, outdoor showers, and exclusive-use camps...',
  luxury:       'Including butler service, helicopter transfers, and wine pairing dinners...',
  wildlife:     'Optimising for predator density and Big Five sighting concentration...',
  cultural:     'Including community visits, heritage experiences, and local craft programmes...',
};

// ── Budget-aware lines ────────────────────────────────────────────────────────
function getBudgetLine(budget: number): string | null {
  if (budget <= 0)      return null;
  if (budget < 100000)  return 'Calibrating value-led options without compromising core quality...';
  if (budget < 250000)  return 'Reviewing well-regarded properties with strong Trustpilot scores...';
  if (budget < 600000)  return 'Including signature lodges across our contracted supplier network...';
  if (budget < 1200000) return 'Considering exclusive-use camps and private helicopter transfers...';
  return 'Reviewing the most exclusive properties — private islands, full-house buyouts, ultra-premium suites...';
}

// ── Origin flight lines ───────────────────────────────────────────────────────
const ORIGIN_LINES: Record<string, string> = {
  LHR: 'Reviewing London → Johannesburg direct options — BA, Virgin, SAA available...',
  LGW: 'Sourcing London Gatwick → Johannesburg routing via preferred carriers...',
  MAN: 'Reviewing Manchester → Johannesburg via London or direct options...',
  JFK: 'Sourcing New York → Johannesburg via Delta direct or one-stop through Doha or Dubai...',
  LAX: 'Reviewing Los Angeles → Africa routing via Doha or Dubai hubs...',
  ORD: 'Routing Chicago → Africa — one-stop typically via Washington or London...',
  FRA: 'Sourcing Frankfurt → Johannesburg with Lufthansa direct service...',
  AMS: 'Reviewing Amsterdam → Johannesburg via KLM daily service...',
  DXB: 'Sourcing Dubai → Africa with Emirates direct daily service...',
  SYD: 'Reviewing Sydney → Africa routing via Dubai, Singapore or Johannesburg direct...',
  SIN: 'Sourcing Singapore → Africa with Singapore Airlines via Johannesburg...',
};

// ── Closing lines ─────────────────────────────────────────────────────────────
const CLOSING_LINES = [
  'Applying margin optimisation across the full package...',
  'Final integrity check — assembling your journey...',
];

// ── Main exported function ────────────────────────────────────────────────────
export function buildThoughts(ctx: ThoughtContext): string[] {
  const out: string[] = [];

  // Normalise region IDs to slugs
  const slugs = (ctx.regions || [])
    .filter(r => r !== 'inspire-me')
    .map(toSlug);

  // ── Openers ───────────────────────────────────────────────────────────────
  out.push(...OPENER_LINES);

  // ── Per-region primary thinking line ─────────────────────────────────────
  for (const slug of slugs) {
    out.push(pickRegionLine(slug, ctx));
  }

  // ── Per-region fun fact ───────────────────────────────────────────────────
  for (const slug of slugs) {
    const facts = REGION_FUN_FACTS[slug] || [];
    if (facts.length) {
      out.push(`Note: ${facts[Math.floor(Math.random() * facts.length)]}`);
    }
  }

  // ── For longer trips (10n+), add a second regional detail line ───────────
  if ((ctx.nights || 0) >= 10 && slugs.length > 0) {
    const extra = pickRegionLine2(slugs[0], ctx);
    if (extra) out.push(extra);
  }

  // ── Multi-region logistics ────────────────────────────────────────────────
  out.push(...getLogisticsLines(slugs));

  // ── Occasion / theme ─────────────────────────────────────────────────────
  const occ = ctx.occasion?.toLowerCase().replace(' ', '-');
  if (occ && occ !== 'none' && OCCASION_LINES[occ]) {
    out.push(OCCASION_LINES[occ]);
  }

  // ── Style ─────────────────────────────────────────────────────────────────
  if (ctx.style && STYLE_LINES[ctx.style]) {
    out.push(STYLE_LINES[ctx.style]);
  }

  // ── Infants — always call out malaria if relevant ─────────────────────────
  const malariaRegions = ['kruger-sabi-sand','okavango-delta','chobe-vic-falls','masai-mara','bwindi'];
  if ((ctx.infants || 0) > 0 && slugs.some(s => malariaRegions.includes(s))) {
    out.push('Filtering to minimise malaria exposure for infant travellers...');
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  const bl = getBudgetLine(ctx.budget || 0);
  if (bl) out.push(bl);

  // ── Seasonal commentary ───────────────────────────────────────────────────
  const seasonal = getSeasonalLine(ctx, slugs);
  if (seasonal) out.push(seasonal);

  // ── International flights ─────────────────────────────────────────────────
  const originKey = (ctx.origin || '').toUpperCase();
  if (ORIGIN_LINES[originKey]) out.push(ORIGIN_LINES[originKey]);

  // ── Closing ───────────────────────────────────────────────────────────────
  out.push(...CLOSING_LINES);

  return out;
}

// ── Helper exports ─────────────────────────────────────────────────────────────
export function getRegionFunFact(slug: string): string {
  const facts = REGION_FUN_FACTS[toSlug(slug)];
  if (!facts || !facts.length) return '';
  return facts[Math.floor(Math.random() * facts.length)];
}

export function getAllRegionFunFacts(slugs: string[]): Array<{ region: string; facts: string[] }> {
  return slugs.map(id => {
    const slug = toSlug(id);
    return { region: REGION_LABELS[slug] || slug, facts: REGION_FUN_FACTS[slug] || [] };
  });
}

// Legacy alias used by some older call sites
export { buildThoughts as buildThoughtsV2 };
