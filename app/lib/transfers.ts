// ═══════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — Transfer Routing Module  (lib/transfers.ts)
// Model: a transfer = COMMERCIAL FLIGHT (Duffel-live where possible)
//                      + LAST-MILE (FedAir / MackAir / road / charter — fixed fares).
// All fares in ZAR unless noted USD (converted at the supplied usdToZar rate).
// Built from the confirmed routing table — every lodge mapped, no guesses.
// ═══════════════════════════════════════════════════════════════════════════

export type AirportCode = 'CPT'|'JNB'|'SZK'|'MQP'|'HDS'|'MUB'|'VFA'|'LVI'|'BBK'|'MADIKWE';
export type Currency2 = 'ZAR'|'USD';

export type LastMile = {
  mode: 'fedair'|'mackair'|'wilderness'|'road'|'charter'|'none';
  label: string;
  fromAirport: AirportCode;   // the airport the COMMERCIAL leg must target for this option
  fare: number;               // per-person unless perCharter=true
  currency: Currency2;
  durationMin: number;
  perCharter?: boolean;       // flat fare for the whole party (charters)
  recommended?: boolean;
  note?: string;
};

// INVARIANT enforced across this module:
//   For ANY chosen last-mile option, the commercial flight leg MUST target
//   option.fromAirport. The two are a bound pair — never price a commercial leg
//   to a different airport than the selected last-mile starts from, or you
//   double-count (e.g. commercial→SZK + a JNB-direct hop) or leave a gap.
//   Use commercialTargetForOption(option) to get the correct commercial target.

// ── PER-PROPERTY LAST-MILE (Kruger only — different airports per lodge) ──────
// Keyed by exact supplier name. Each lodge lists its airport options.
export const PROPERTY_LASTMILE: Record<string, LastMile[]> = {
  // Sabi Sand cluster → SZK (closest) or MQP
  'Singita Boulders Lodge':  szkMqp(),
  'Singita Ebony Lodge':     szkMqp(),
  'Ulusaba Rock Lodge':      szkMqp(),
  'Sabi Sabi Earth Lodge':   szkMqp(),
  'Londolozi Tree Camp':     szkMqp(),
  'Londolozi Varty Camp':    szkMqp(),
  'Chitwa Chitwa Game Lodge':szkMqp(),
  'Dulini Lodge':            szkMqp(),
  'Lion Sands Ivory Lodge':  szkMqp(),
  // Satara/central → HDS or MQP
  'Singita Lebombo Lodge':   hdsMqp(),
  'Singita Sweni Lodge':     hdsMqp(),
};

function szkMqp(): LastMile[] {
  return [
    { mode:'fedair', label:'FedAir from Skukuza (SZK)', fromAirport:'SZK', fare:3000, currency:'ZAR', durationMin:10, recommended:true,  note:'Shortest hop. FedAir lounge at SZK.' },
    { mode:'fedair', label:'FedAir from Kruger Mpumalanga (MQP)', fromAirport:'MQP', fare:3750, currency:'ZAR', durationMin:20, recommended:false, note:'Alternative if routing via MQP is cheaper on the commercial leg.' },
  ];
}
function hdsMqp(): LastMile[] {
  return [
    { mode:'fedair', label:'FedAir from Hoedspruit (HDS)', fromAirport:'HDS', fare:3000, currency:'ZAR', durationMin:20, recommended:true,  note:'FedAir lounge at HDS.' },
    { mode:'fedair', label:'FedAir from Kruger Mpumalanga (MQP)', fromAirport:'MQP', fare:5000, currency:'ZAR', durationMin:40, recommended:false },
  ];
}

// Kruger fallback when a lodge name isn't in PROPERTY_LASTMILE
export const KRUGER_FALLBACK_LASTMILE: LastMile[] = [
  { mode:'fedair', label:'FedAir from Skukuza (SZK)', fromAirport:'SZK', fare:3000, currency:'ZAR', durationMin:10, recommended:true,  note:'Default Sabi Sand routing.' },
  { mode:'fedair', label:'FedAir from JNB direct',     fromAirport:'JNB', fare:7500, currency:'ZAR', durationMin:60, recommended:false, note:'Direct FedAir from O.R. Tambo to the lodge airstrip.' },
];

// ── REGION-LEVEL LAST-MILE (Madikwe / Okavango / Vic Falls) ──────────────────
// Vic Falls is per-property (3 airport catchments); the rest are uniform.

export const VICFALLS_AIRPORT: Record<string, AirportCode> = {
  'Ilala Lodge Hotel':'VFA','Matetsi Victoria Falls':'VFA','The Elephant Camp':'VFA',
  'Victoria Falls River Lodge Island Suite':'VFA','Victoria Falls Safari Club':'VFA',
  'Anantara Stanley and Livingstone':'VFA','Bushtracks Africa Victoria Falls':'VFA',
  'Old Drift Lodge':'VFA',
  'Royal Chundu Island Lodge':'LVI','Thorntree River Lodge':'LVI','Tongabezi Lodge':'LVI',
  'Chobe Chilwero':'BBK',
};

// Last-mile for the three Vic Falls airports
export function vicFallsLastMile(airport: AirportCode): LastMile[] {
  if (airport === 'BBK') return [
    { mode:'mackair', label:'MackAir from Kasane (BBK)', fromAirport:'BBK', fare:200, currency:'USD', durationMin:30, recommended:true, note:'Light aircraft from Kasane to the Chobe lodge.' },
  ];
  // VFA / LVI: private road transfer from the airport (short)
  return [
    { mode:'road', label:`Private transfer from ${airport}`, fromAirport:airport, fare:1800, currency:'ZAR', durationMin:20, recommended:true, note:'Airport 15–20 min from the lodges. Private vehicle.' },
  ];
}

// Madikwe — FedAir from JNB, or charter, or road (not recommended)
export const MADIKWE_LASTMILE: LastMile[] = [
  { mode:'fedair',  label:'FedAir JNB → Madikwe', fromAirport:'JNB', fare:6250, currency:'ZAR', durationMin:75, recommended:true,  note:'Daily 10h00 & 13h00; returns 11h30 & 14h30.' },
  { mode:'charter', label:'Private charter ex JNB', fromAirport:'JNB', fare:50000, currency:'ZAR', durationMin:60, perCharter:true, recommended:false, note:'Flat rate per charter, up to 6 guests.' },
  { mode:'road',    label:'Road transfer from JNB', fromAirport:'JNB', fare:3500, currency:'ZAR', durationMin:270, recommended:false, note:'4.5 hours. Not recommended for most guests.' },
];

// Okavango — MUB + MackAir (all lodges), Wilderness Air +15% alt
export const OKAVANGO_LASTMILE: LastMile[] = [
  { mode:'mackair',    label:'MackAir from Maun (MUB)', fromAirport:'MUB', fare:200, currency:'USD', durationMin:30, recommended:true,  note:'Light aircraft to the Delta camp airstrip.' },
  { mode:'wilderness', label:'Wilderness Air from Maun (MUB)', fromAirport:'MUB', fare:230, currency:'USD', durationMin:30, recommended:false, note:'+15% vs MackAir. Mixed reviews.' },
];

// ── REGION → COMMERCIAL ARRIVAL AIRPORT(S) ───────────────────────────────────
// Which airport the Duffel commercial leg targets, per region.
export const REGION_COMMERCIAL_AIRPORTS: Record<string, AirportCode[]> = {
  'kruger-sabi-sand': ['SZK','MQP','HDS'],
  'okavango-delta':   ['MUB'],
  'madikwe':          ['JNB'],   // commercial to JNB, then FedAir
  'chobe-vic-falls':  ['VFA','LVI','BBK'],
  'cape-town':        ['CPT'],   // arrival city; no inter-region flight needed
};

// ── INTER-REGION COMMERCIAL CARRIERS & ESTIMATES (where Duffel gaps) ─────────
// Budget-carrier estimates relative to the Airlink Duffel fare (inclusion_source:'estimated').
export const CARRIER_ADJUST: Record<string, number> = {
  'cemair':   0.90,   // 10% less than Airlink
  'flysafair':0.75,   // 25% less than Airlink
  'fastjet':  1.05,   // 5% more than Airlink (well-timed VFA daily)
};

// ── VFA ↔ OKAVANGO special (charter or MackAir via Kasane) ───────────────────
export const VFA_OKAVANGO: LastMile[] = [
  { mode:'charter', label:'Private charter VFA ↔ Okavango', fromAirport:'VFA', fare:150000, currency:'ZAR', durationMin:90, perCharter:true, recommended:false, note:'Flat per charter, direct.' },
  { mode:'mackair', label:'MackAir via Kasane (BBK)', fromAirport:'BBK', fare:450, currency:'USD', durationMin:120, recommended:true, note:'Via Kasane — most cost-effective.' },
];

// ── RESOLVER ─────────────────────────────────────────────────────────────────
// Returns the last-mile options for a given booked lodge + its region.
export function lastMileFor(propertyName: string, regionSlug: string): LastMile[] {
  if (regionSlug === 'kruger-sabi-sand') {
    return PROPERTY_LASTMILE[propertyName] ?? KRUGER_FALLBACK_LASTMILE;
  }
  if (regionSlug === 'madikwe')        return MADIKWE_LASTMILE;
  if (regionSlug === 'okavango-delta') return OKAVANGO_LASTMILE;
  if (regionSlug === 'chobe-vic-falls') {
    const ap = VICFALLS_AIRPORT[propertyName] ?? 'VFA';
    return vicFallsLastMile(ap);
  }
  return []; // cape-town: no last-mile flight (city transfer handled elsewhere)
}

// Convert a LastMile fare to ZAR for the engine.
export function lastMileZar(lm: LastMile, usdToZar: number, pax: number): number {
  const base = lm.currency === 'USD' ? lm.fare * usdToZar : lm.fare;
  return lm.perCharter ? Math.round(base) : Math.round(base * pax);
}

// The commercial leg target is ALWAYS the chosen last-mile's fromAirport.
// This is the single source of truth that prevents flight/last-mile mismatch.
export function commercialTargetForOption(option: LastMile): AirportCode {
  return option.fromAirport;
}

// Default commercial target for a lodge = its RECOMMENDED last-mile's airport.
// Used to pre-search the Duffel leg before the traveller changes the last-mile.
export function defaultCommercialTarget(propertyName: string, regionSlug: string): AirportCode | null {
  const lm = lastMileFor(propertyName, regionSlug);
  const rec = lm.find(l => l.recommended) ?? lm[0];
  return rec ? rec.fromAirport : (REGION_COMMERCIAL_AIRPORTS[regionSlug]?.[0] ?? null);
}

// A complete priced transfer = commercial leg (to option.fromAirport) + this last-mile.
// The caller supplies the commercial fare (from Duffel/estimate) to that airport;
// this helper just enforces the pairing and sums correctly.
export function priceTransfer(option: LastMile, commercialFareZar: number, usdToZar: number, pax: number): {
  commercialZar: number; lastMileZar: number; totalZar: number; targetAirport: AirportCode;
} {
  const lm = lastMileZar(option, usdToZar, pax);
  return {
    commercialZar: Math.round(commercialFareZar),
    lastMileZar: lm,
    totalZar: Math.round(commercialFareZar) + lm,
    targetAirport: option.fromAirport,
  };
}
