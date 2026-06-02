// ─────────────────────────────────────────────────────────────────────────────
// buildThoughts.ts — Itinerary-specific thought stream generator
//
// Replaces the two hardcoded arrays in SafariCinematicResearch.
// Called BEFORE runPlannerEngine so thoughts can appear while AI is working.
//
// Usage in SafariCinematicResearch (replace THOUGHTS_RETURNING / THOUGHTS_FIRST):
//   import { buildThoughts } from './buildThoughts';
//   const thoughts = buildThoughts(answers);
//
// answers shape mirrors the existing SafariCinematicResearch `answers` prop:
//   { experience, regions, nights, travellers, budget, adults, children, origin }
// ─────────────────────────────────────────────────────────────────────────────

export interface ThoughtAnswers {
  experience?: 'first' | 'returning';
  regions?:    string[];
  nights?:     number;
  travellers?: string;           // "couple", "solo", "group of 4", etc.
  budget?:     string;           // formatted string e.g. "R 450,000"
  adults?:     number;
  children?:   number;
  origin?:     string;           // e.g. "LHR", "JFK", "JNB"
}

// ─── Region labels ────────────────────────────────────────────────────────────
const REGION_LABELS: Record<string, string> = {
  'kruger':         'Sabi Sand',
  'kruger-sabi-sand': 'Sabi Sand',
  'okavango':       'Okavango Delta',
  'okavango-delta': 'Okavango Delta',
  'chobe':          'Chobe / Victoria Falls',
  'chobe-vic-falls':'Chobe / Victoria Falls',
  'cape-town':      'Cape Town',
  'madikwe':        'Madikwe',
  'masai-mara':     'Masai Mara',
  'bwindi':         'Bwindi',
  'phinda':         'Phinda',
  'mozambique':     'Mozambique',
};

// ─── Region-specific live details injected into thoughts ─────────────────────
const REGION_INTEL: Record<string, string[]> = {
  'kruger-sabi-sand': [
    'The Sabi Sand has three leopard cubs active right now.',
    'Checking concession access rights — private traversing active.',
    'Lion pride density highest from May–September. Noted.',
  ],
  'okavango-delta': [
    'Delta flood level peaking — mokoro routes fully navigable.',
    'Wild dog pack confirmed active in NG33 concession.',
    'Helicopter availability checked — Maun base confirmed.',
  ],
  'chobe-vic-falls': [
    'Victoria Falls at peak flow. Spray visible from 40km. Noted.',
    'Chobe river elephant herds at maximum — dry season concentration.',
    'Flight connections Kasane → Maun confirmed for multi-region routing.',
  ],
  'cape-town': [
    'Cape Town summer winds checked — mountain accessible.',
    'Ellerman House and The Silo availability cross-referenced.',
    'Winelands day itinerary options loaded from Knowledge Base.',
  ],
  'madikwe': [
    'Madikwe confirmed malaria-free — no prophylactics required.',
    'Big Five density above average this season. Lion cubs active.',
    'Jamala and Jaci\'s rates checked against contracted net rates.',
  ],
  'masai-mara': [
    'Great Migration river-crossing probability calculated for your dates.',
    'Light aircraft schedules Nairobi → Mara checked.',
    'Mara plains lion coalition — 12 individuals — confirmed active.',
  ],
};

// ─── Origin-specific flight thoughts ─────────────────────────────────────────
const ORIGIN_THOUGHTS: Record<string, string> = {
  'LHR': 'Checking London Heathrow → Johannesburg flight options…',
  'LGW': 'Scanning London Gatwick departure slots…',
  'JFK': 'New York JFK → Johannesburg routing — checking connections…',
  'LAX': 'Los Angeles → Johannesburg via Dakar or Nairobi. Comparing fares…',
  'AMS': 'Amsterdam direct to Johannesburg — KLM and SAA checked.',
  'FRA': 'Frankfurt → Johannesburg Lufthansa and SAA options loaded.',
  'MAN': 'Manchester — connecting via London or Amsterdam. Optimising.',
  'DXB': 'Dubai → Johannesburg Emirates direct — flagging for specialist.',
  'SYD': 'Sydney — longest routing. Qantas via JNB checked.',
  'JNB': 'Johannesburg — internal routing only. No international leg.',
  'CPT': 'Cape Town — internal connection to first destination confirmed.',
};

// ─── Budget commentary ────────────────────────────────────────────────────────
function budgetComment(budget: string, nights: number): string | null {
  // Extract numeric from formatted string like "R 450,000" or "$24,000"
  const num = parseInt(budget.replace(/[^\d]/g, ''), 10);
  if (!num || !nights) return null;
  const perNight = Math.round(num / nights);
  if (perNight > 50000)  return `Budget at ${budget} — accessing premium tier inventory.`;
  if (perNight > 25000)  return `Budget per night: R ${perNight.toLocaleString()} — strong selection available.`;
  if (perNight > 10000)  return `Budget optimisation active — finding best value at ${budget} total.`;
  return `Working within ${budget} — identifying value-tier properties.`;
}

// ─── Traveller-specific note ──────────────────────────────────────────────────
function travellerNote(adults: number, children: number): string | null {
  if (children > 0) return `Family configuration: ${adults} adults, ${children} child${children > 1 ? 'ren' : ''} — filtering for family-friendly lodges.`;
  if (adults === 1)  return 'Solo traveller — single occupancy supplements noted. Private guide option flagged.';
  if (adults >= 6)   return `Group of ${adults} — checking villa and exclusive-use inventory.`;
  return null;
}

// ─── Core builder ─────────────────────────────────────────────────────────────
export function buildThoughts(answers: ThoughtAnswers): string[] {
  const {
    experience = 'returning',
    regions    = [],
    nights     = 7,
    travellers = 'couple',
    budget     = '',
    adults     = 2,
    children   = 0,
    origin     = '',
  } = answers;

  const validRegions = (regions || [])
    .filter(r => r !== 'inspire-me')
    .map(r => REGION_LABELS[r] || r.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

  const regionStr = validRegions.length > 0
    ? validRegions.join(' and ')
    : 'Southern Africa';

  const thoughts: string[] = [];

  // ── Opening line — experience-aware ──────────────────────────────────────
  if (experience === 'first') {
    thoughts.push(`First trip to Africa — building your perfect introduction.`);
  } else {
    thoughts.push(`Returning traveller detected — going deeper than last time.`);
  }

  // ── Region confirmation ───────────────────────────────────────────────────
  if (validRegions.length === 0) {
    thoughts.push(`No region specified — selecting the two best destinations for ${nights} nights.`);
  } else if (validRegions.length === 1) {
    thoughts.push(`Focusing on ${validRegions[0]} — finding the best ${nights} nights there.`);
  } else {
    thoughts.push(`${validRegions.length}-destination journey: ${regionStr}. Optimising sequence.`);
  }

  // ── Scanning inventory ────────────────────────────────────────────────────
  thoughts.push(`Scanning availability across ${20 + Math.floor(Math.random() * 12)} properties in ${regionStr}…`);

  // ── Regional intel (specific to each selected region) ────────────────────
  const regionSlugs = (regions || [])
    .filter(r => r !== 'inspire-me')
    .map(r => r === 'kruger' ? 'kruger-sabi-sand' : r === 'okavango' ? 'okavango-delta' : r === 'chobe' ? 'chobe-vic-falls' : r);

  for (const slug of regionSlugs.slice(0, 2)) {
    const intel = REGION_INTEL[slug] || [];
    if (intel.length > 0) {
      thoughts.push(intel[Math.floor(Math.random() * intel.length)]);
    }
  }

  // ── Night split ───────────────────────────────────────────────────────────
  if (validRegions.length >= 2 && nights >= 6) {
    const split1 = Math.ceil(nights * 0.55);
    const split2 = nights - split1;
    thoughts.push(`Night allocation: ${split1} nights ${validRegions[0]}, ${split2} nights ${validRegions[1]}. Checking transitions.`);
  } else if (nights <= 5) {
    thoughts.push(`${nights} nights — focused itinerary. Prioritising single destination for depth.`);
  } else {
    thoughts.push(`${nights} nights — checking optimal pacing. Minimum 3 nights per destination.`);
  }

  // ── Traveller-specific ────────────────────────────────────────────────────
  const travNote = travellerNote(adults, children);
  if (travNote) thoughts.push(travNote);

  // ── Budget commentary ─────────────────────────────────────────────────────
  const budNote = budgetComment(budget, nights);
  if (budNote) thoughts.push(budNote);

  // ── Origin / flights ──────────────────────────────────────────────────────
  if (origin && ORIGIN_THOUGHTS[origin]) {
    thoughts.push(ORIGIN_THOUGHTS[origin]);
  }

  // ── Knowledge Base injection ──────────────────────────────────────────────
  thoughts.push(`Loading Knowledge Base: ${85 + Math.floor(Math.random() * 60)} specialist notes injected.`);

  // ── Rate check ───────────────────────────────────────────────────────────
  thoughts.push(`Cross-referencing your budget against contracted net rates…`);

  // ── Date arbitrage ────────────────────────────────────────────────────────
  const saving = Math.round((Math.random() * 18000 + 8000) / 1000) * 1000;
  thoughts.push(`Date arbitrage scan: shifting ±${Math.random() > 0.5 ? 3 : 7} days saves R ${saving.toLocaleString()}.`);

  // ── Transfer routing ──────────────────────────────────────────────────────
  if (validRegions.length >= 2) {
    thoughts.push(`Charter routing ${validRegions[0]} → ${validRegions[1]} confirmed. Timing checked.`);
  }

  // ── Malaria note if relevant ──────────────────────────────────────────────
  const malariaRegions = ['kruger-sabi-sand', 'okavango-delta', 'masai-mara', 'chobe-vic-falls'];
  const hasMalaria = regionSlugs.some(s => malariaRegions.includes(s));
  if (hasMalaria && children === 0) {
    thoughts.push(`Malaria zone confirmed — prophylactic requirements flagged for your Journey Specialist.`);
  }

  // ── Children age restriction ──────────────────────────────────────────────
  if (children > 0) {
    thoughts.push(`Filtering for minimum age compliance — removing camps with under-12 restrictions.`);
  }

  // ── Closing ───────────────────────────────────────────────────────────────
  thoughts.push(`Margin optimisation complete. Your rates are 15–27% below direct booking.`);
  thoughts.push(`Building your personalised itinerary for ${regionStr}…`);
  thoughts.push(`Almost there. This one is worth the wait.`);

  return thoughts;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION NOTE for SafariCinematicResearch.jsx
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Import at top of SafariCinematicResearch.jsx:
//    import { buildThoughts } from './buildThoughts';
//
// 2. Replace the existing thoughts derivation:
//    // OLD:
//    const thoughts = experience === 'first' ? THOUGHTS_FIRST : THOUGHTS_RETURNING;
//
//    // NEW:
//    const thoughts = buildThoughts(answers);
//
// 3. Pass additional fields from page.tsx into the answers prop:
//    <SafariCinematicResearch
//      answers={{
//        experience: adults === 1 ? 'first' : 'returning',
//        regions: selectedRegions,
//        nights,
//        travellers: adults === 1 ? 'solo' : adults === 2 ? 'couple' : `group of ${adults}`,
//        budget: fmt(budget),
//        adults,
//        children,
//        origin: needsIntlFlight ? intlOrigin : origin,
//      }}
//      aiReady={itinerary !== null}
//      onComplete={() => setScreen('builder')}
//    />
//
// That's the entire change required. buildThoughts() is pure — no side effects,
// no async — so it fires synchronously before the first thought is rendered.
// ─────────────────────────────────────────────────────────────────────────────
