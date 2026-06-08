/**
 * lib/transferGuardrails.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Connection validation, route corrections, and airstrip mappings.
 * Import this into transfers.ts and page.tsx.
 *
 * RULES ENCODED HERE:
 * 1. Min connection time at MQP/HDS/SZK between FedAir and commercial: 45 min
 * 2. Min connection time at MUB/BBK between Mack Air and commercial:   60 min
 * 3. VFA airport arrival = road transfer only. No flights. No helicopter.
 * 4. No helicopter at ANY airport → lodge leg.
 * 5. Phantom routes removed (VFA→HDS, VFA→SZK, MUB→VFA direct).
 * 6. Lodge → airstrip mapping (correct airstrip per property).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Time utilities ────────────────────────────────────────────────────────────

/** Parse "HH:MM" into total minutes from midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Return true if connection is valid (arrival + buffer ≤ departure) */
export function connectionIsValid(
  arrivalTime:  string,   // "HH:MM" e.g. "15:40"
  departureTime: string,  // "HH:MM" e.g. "13:30"
  minBufferMinutes = 45,
): boolean {
  return timeToMinutes(arrivalTime) + minBufferMinutes <= timeToMinutes(departureTime);
}

// ── Minimum connection buffers by airport ─────────────────────────────────────
export const MIN_CONNECTION_MINUTES: Record<string, number> = {
  MQP: 45,   // Kruger Mpumalanga — FedAir has own apron, manageable
  HDS: 45,   // Hoedspruit — smaller, same buffer
  SZK: 45,   // Skukuza — same
  MUB: 60,   // Maun — Mack Air on separate apron, 60 min confirmed
  BBK: 60,   // Kasane — same rule as Maun
  JNB: 90,   // OR Tambo international connection (domestic → international)
  VFA: 30,   // Victoria Falls — road transfer only (not used for flights)
};

// ── Phantom routes — these must NEVER appear in any option ────────────────────
// Format: 'DEP-ARR' (IATA→IATA)
export const PHANTOM_ROUTES = new Set([
  'VFA-HDS',   // No Airlink flight — remove Options 3-of-4 (Image 5)
  'VFA-SZK',   // No Airlink flight — remove Options 4-of-4 (Image 6)
  'VFA-MUB',   // No direct — must connect via JNB
  'MUB-VFA',   // No direct — must connect via JNB
  'LVI-JNB',   // Route all Zimbabwe through VFA, not LVI
  'JNB-LVI',   // Same — all through VFA
]);

/**
 * Validate that a two-leg combination is physically possible.
 * Returns an error string if invalid, null if valid.
 *
 * Usage:
 *   const err = validateLegCombination(commercialArrival, bushDeparture, 'MQP');
 *   if (err) skip this option / show warning
 */
export function validateLegCombination(
  firstLegArrivalTime:  string,  // "HH:MM" — when first aircraft lands
  secondLegDepartureTime: string, // "HH:MM" — when second aircraft departs
  connectionAirport: string,
): string | null {
  const minBuffer = MIN_CONNECTION_MINUTES[connectionAirport] ?? 45;
  if (!connectionIsValid(firstLegArrivalTime, secondLegDepartureTime, minBuffer)) {
    const arrMins = timeToMinutes(firstLegArrivalTime);
    const depMins = timeToMinutes(secondLegDepartureTime);
    const gapMins = depMins - arrMins;
    if (gapMins < 0) {
      return `❌ Impossible: ${secondLegDepartureTime} departure is ${Math.abs(gapMins)} min BEFORE ${firstLegArrivalTime} arrival at ${connectionAirport}`;
    }
    return `❌ Too tight: only ${gapMins} min at ${connectionAirport} — minimum is ${minBuffer} min`;
  }
  return null; // valid
}

/**
 * Filter a list of route combinations, removing any that:
 * - Use phantom routes
 * - Have impossible connections
 * - Include helicopter on an airport→lodge leg
 */
export interface RouteLeg {
  dep:      string;  // IATA
  arr:      string;  // IATA
  carrier:  string;  // 'airlink' | 'fedair' | 'mack-air' | 'fastjet' | 'road' | 'helicopter'
  depTime?: string;  // "HH:MM" or undefined for unscheduled
  arrTime?: string;  // "HH:MM" or undefined
  isAirportTransfer?: boolean; // true = this leg is airport → lodge
}

export function filterValidCombinations(combinations: RouteLeg[][]): RouteLeg[][] {
  return combinations.filter((legs) => {
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      // 1. Reject phantom routes
      const routeKey = `${leg.dep}-${leg.arr}`;
      if (PHANTOM_ROUTES.has(routeKey)) return false;

      // 2. Reject helicopter on airport→lodge legs
      if (leg.isAirportTransfer && leg.carrier === 'helicopter') return false;

      // 3. Connection time validation with next leg
      if (i < legs.length - 1) {
        const next = legs[i + 1];
        const connectionAirport = leg.arr; // where we connect

        // Only validate if both times are known
        if (leg.arrTime && next.depTime) {
          const err = validateLegCombination(leg.arrTime, next.depTime, connectionAirport);
          if (err) return false;
        }
      }
    }
    return true;
  });
}

// ── Correct airstrip per lodge ────────────────────────────────────────────────
// Key = lodge slug or name fragment (lowercase, partial match)
// Value = { iata: string, label: string }
export const LODGE_AIRSTRIP_MAP: Record<string, { iata: string; label: string }> = {
  // Sabi Sand — Singita / Ebony side
  'singita-boulders':   { iata: 'SZK', label: 'Skukuza Airport' },
  'singita-ebony':      { iata: 'SZK', label: 'Skukuza Airport' },
  'singita-sweni':      { iata: 'HDS', label: 'Hoedspruit Airport' },
  'singita-lebombo':    { iata: 'HDS', label: 'Hoedspruit Airport' },

  // Lion Sands — served by SZK
  'lion-sands':         { iata: 'SZK', label: 'Skukuza Airport' },
  'ivory-lodge':        { iata: 'SZK', label: 'Skukuza Airport' },
  'river-lodge':        { iata: 'SZK', label: 'Skukuza Airport' },
  'tinga':              { iata: 'SZK', label: 'Skukuza Airport' },

  // Dulini — served by ULX (Ulusaba Private Game Reserve airstrip)
  'dulini':             { iata: 'ULX', label: 'Ulusaba airstrip' },
  'dulini-leadwood':    { iata: 'ULX', label: 'Ulusaba airstrip' },
  'dulini-river':       { iata: 'ULX', label: 'Ulusaba airstrip' },

  // Ulusaba — own airstrip ULX
  'ulusaba':            { iata: 'ULX', label: 'Ulusaba airstrip' },

  // Londolozi — SSX (Londolozi private)
  'londolozi':          { iata: 'SSX', label: 'Londolozi airstrip' },
  'londolozi-founders': { iata: 'SSX', label: 'Londolozi airstrip' },
  'londolozi-pioneer':  { iata: 'SSX', label: 'Londolozi airstrip' },
  'londolozi-varty':    { iata: 'SSX', label: 'Londolozi airstrip' },

  // Chitwa Chitwa — ASS (Arathusa airstrip)
  'chitwa-chitwa':      { iata: 'ASS', label: 'Arathusa airstrip' },

  // Royal Malewane — HDS
  'royal-malewane':     { iata: 'HDS', label: 'Hoedspruit Airport' },
  'safari-lodge':       { iata: 'HDS', label: 'Hoedspruit Airport' },

  // Sabi Sabi — MQP or SZK
  'sabi-sabi-earth':    { iata: 'SZK', label: 'Skukuza Airport' },
  'sabi-sabi-bush':     { iata: 'SZK', label: 'Skukuza Airport' },
  'sabi-sabi-little':   { iata: 'SZK', label: 'Skukuza Airport' },

  // Tswalu
  'tswalu':             { iata: 'GNS', label: 'Louwna airstrip' },

  // Madikwe
  'madikwe':            { iata: 'MAD', label: 'Madikwe airstrip' },

  // Cape Town
  'ellerman':           { iata: 'CPT', label: 'Cape Town International' },
  'the-silo':           { iata: 'CPT', label: 'Cape Town International' },

  // Okavango — Mack Air to camp
  'andBeyond-xaranna':  { iata: 'CAMP', label: 'Xaranna private airstrip' },
  'andBeyond-sandibe':  { iata: 'CAMP', label: 'Sandibe private airstrip' },
  'eagle-island':       { iata: 'CAMP', label: 'Eagle Island airstrip' },
  'kanana':             { iata: 'CAMP', label: 'Kanana airstrip' },

  // Victoria Falls
  'victoria-falls-island-treehouse': { iata: 'VFA', label: 'Victoria Falls Airport' },
  'singita-pamushana':               { iata: 'VFA', label: 'Victoria Falls Airport' },
};

/** Look up the correct airstrip for a lodge by its slug (partial match) */
export function getLodgeAirstrip(lodgeSlug: string): { iata: string; label: string } | null {
  const slug = lodgeSlug.toLowerCase().replace(/\s+/g, '-');

  // Exact match first
  if (LODGE_AIRSTRIP_MAP[slug]) return LODGE_AIRSTRIP_MAP[slug];

  // Partial match
  for (const [key, val] of Object.entries(LODGE_AIRSTRIP_MAP)) {
    if (slug.includes(key) || key.includes(slug)) return val;
  }

  return null;
}

// ── VFA airport transfer rule ─────────────────────────────────────────────────
/**
 * The ONLY valid transfer from VFA Airport to a Vic Falls lodge is a road transfer.
 * Duration: 20-30 minutes. No exceptions.
 *
 * If a lodgeSlug is provided and the lodge is more than 30 minutes from VFA,
 * the specialist must confirm the correct road transfer duration.
 */
export const VFA_AIRPORT_TRANSFER = {
  carrier:    'road',
  label:      'Private road transfer',
  dep:        'VFA',
  arr:        'Lodge',
  durationMin: 20,
  durationMax: 30,
  note:       'VFA airport 20 min from Victoria Falls town. Most lodges include airport collection — confirm at booking.',
  isAirportTransfer: true,
} as const;

/**
 * For any leg that is VFA→Lodge (arrival at Vic Falls),
 * always return only this road transfer. Never flights, never helicopter.
 */
export function getVFAArrivalTransfer() {
  return [VFA_AIRPORT_TRANSFER];
}

// ── Logo fallback helper ──────────────────────────────────────────────────────
/**
 * Normalise a carrier code to match the airlines table IATA codes.
 * Some route entries use non-standard codes — this maps them.
 */
export const CARRIER_CODE_MAP: Record<string, string> = {
  'fastjet':        'FN',
  'fastjet-zim':    'FN',
  'mack-air':       'MK',
  'mack':           'MK',
  'wilderness-air': 'WA',
  'wilderness':     'WA',
  'fedair':         'FA',
  'federal-air':    'FA',
  'airlink':        '4Z',
  'cemair':         '5Z',
  'flysafair':      'FR',
  'saa':            'SA',
};

export function resolveCarrierIata(carrierSlug: string): string {
  return CARRIER_CODE_MAP[carrierSlug.toLowerCase()] ?? carrierSlug.toUpperCase();
}
