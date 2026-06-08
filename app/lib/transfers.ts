// ═══════════════════════════════════════════════════════════════════════════
// TSE TRANSFER ROUTING MODULE  (lib/transfers.ts)  — v2
//
// Model: every inter-regional transfer = EXIT LEG (lodge → hub airport)
//                                      + COMMERCIAL LEG (hub → hub, Duffel-live)
//                                      + ARRIVAL LAST-MILE (hub → lodge)
//
// Routing authority: BCC_Routing_KB_Draft_v1 (June 2026) + TSE KB entries
// Operator priority: Priority 1 direct commercial > Priority 2 FedAir/charter > Priority 3 road
//
// FedAir baggage: standard 20kg, hard cases permitted. X Class = 32kg + hard case, +25%.
// Delta charter operators: 20kg SOFT BAG STRICTLY enforced. No hard cases. No exceptions.
//
// All fares ZAR unless currency:'USD' (converted at caller-supplied usdToZar rate).
// Fares marked indicative — confirmed by specialist / Duffel at booking.
// ═══════════════════════════════════════════════════════════════════════════

import { filterValidCombinations, PHANTOM_ROUTES, ROUTES_TO_REMOVE } from './transferGuardrails';
export type AirportCode =
  | 'CPT'   // Cape Town International
  | 'JNB'   // O.R. Tambo, Johannesburg (FedAir terminal: Atlas Rd entrance)
  | 'HDS'   // Hoedspruit Eastgate (Timbavati/Klaserie/northern Sabi)
  | 'MQP'   // Kruger Mpumalanga International (western/southern Sabi)
  | 'SZK'   // Skukuza (inside Kruger NP — Lion Sands; FedAir Lowveld Shuttle)
  | 'MUB'   // Maun International (Okavango Delta gateway)
  | 'BBK'   // Kasane International (Chobe/Botswana; Wilderness Air + Mack Air hub)
  | 'VFA'   // Victoria Falls International (Zimbabwe side)
  | 'LVI'   // Harry Mwanga Nkumbula / Livingstone (Zambia side)
  | 'GBE'   // Gaborone International (28km from Madikwe — niche charter option)
  | 'MADIKWE'; // FedAir private airstrip (West and East — confirm with lodge)

export type Currency2 = 'ZAR' | 'USD';

export type LastMile = {
  mode:        'fedair' | 'mackair' | 'wilderness' | 'road' | 'charter' | 'none';
  label:       string;
  fromAirport: AirportCode;  // commercial leg MUST target this airport
  fare:        number;       // per-person unless perCharter=true
  currency:    Currency2;
  durationMin: number;
  perCharter?: boolean;      // flat fare for whole party
  recommended?: boolean;
  note?:       string;
};

// ── AIRSTRIP CODES used in FedAir Lowveld schedule ───────────────────────────
// SSX = Singita (Boulders, Ebony)      ASS = Arathusa (Chitwa Chitwa)
// SAT = Satara (Lebombo, Sweni)        GSS = Sabi Sabi (Earth Lodge)
// LDZ = Londolozi (Tree Camp, Varty)   SZK = Skukuza (Lion Sands)
// ULS = Ulusaba (and Dulini)           MAD/MWD = Madikwe (West & East)
// HDS = Hoedspruit Eastgate            MQP = Kruger Mpumalanga Intl

// ── PER-PROPERTY LAST-MILE — Kruger / Sabi Sand ──────────────────────────────
// Each lodge entry lists all viable airport options so the engine can surface
// multi-option transfer cards. Recommended=true is the default routing;
// others are shown as alternatives in the UI.
//
// FedAir Lowveld Shuttle (effective 18 May 2026):
//   Lodge→MQP:  dep 09:00 arr 10:35  (flt 301 series)
//   MQP→Lodge:  dep 13:00 arr 15:00  (flt 302 series)
//   Lodge→HDS/SZK and inter-lodge: see 3xxx series schedules
//
// KEY PRINCIPLE: always prefer direct commercial CPT/JNB→HDS or CPT/JNB→MQP
// over routing via JNB when the commercial leg already lands at the correct hub.
// FedAir lodge hop then connects the last mile. Avoids unnecessary JNB transit.

function szkOptions(): LastMile[] {
  // SZK = Lion Sands. Airlink flies SZK→CPT direct (2h45).
  // FedAir Lowveld Shuttle connects SZK↔MQP↔HDS (flt 3101/3102/3401 series).
  return [
    {
      mode: 'fedair', label: 'FedAir Lowveld Shuttle → Skukuza (SZK)',
      fromAirport: 'SZK', fare: 3000, currency: 'ZAR', durationMin: 10,
      recommended: true,
      note: 'FedAir flt 3101: dep lodge 09:00 arr SZK ~09:10. Airlink SZK→CPT direct 2x daily. FedAir atlas Rd terminal JNB for JNB connections.',
    },
    {
      mode: 'fedair', label: 'FedAir Lowveld Shuttle → Kruger Mpumalanga (MQP)',
      fromAirport: 'MQP', fare: 3750, currency: 'ZAR', durationMin: 35,
      recommended: false,
      note: 'FedAir flt 301: dep lodge 09:00 arr MQP 10:35. Airlink/FlySafair MQP→CPT direct or MQP→JNB→onward. Use when MQP commercial fare beats SZK routing.',
    },
    {
      mode: 'road', label: 'Road transfer to MQP',
      fromAirport: 'MQP', fare: 2800, currency: 'ZAR', durationMin: 150,
      recommended: false,
      note: '2–2.5 hrs from western Sabi Sands to MQP. Not preferred — wastes safari morning. Use only if FedAir unavailable.',
    },
  ];
}

function ssx_ldz_uls(): LastMile[] {
  // Singita (SSX), Londolozi (LDZ), Ulusaba (ULS) — FedAir direct services available
  // plus Lowveld Shuttle to MQP/HDS as alternatives
  return [
    {
      mode: 'fedair', label: 'FedAir Lowveld Shuttle → Kruger Mpumalanga (MQP)',
      fromAirport: 'MQP', fare: 4000, currency: 'ZAR', durationMin: 20,
      recommended: true,
      note: 'FedAir flt 302 series: lodge→MQP dep 09:00 arr 10:35. Airlink MQP→CPT direct 2x daily or MQP→JNB for connections.',
    },
    {
      mode: 'fedair', label: 'FedAir Lowveld Shuttle → Hoedspruit (HDS)',
      fromAirport: 'HDS', fare: 3750, currency: 'ZAR', durationMin: 25,
      recommended: false,
      note: 'FedAir flt 3402/3412 series connect MQP↔HDS. Airlink HDS→CPT 2x daily. Good if HDS commercial fare is more favourable.',
    },
    {
      mode: 'road', label: 'Road transfer to MQP',
      fromAirport: 'MQP', fare: 2800, currency: 'ZAR', durationMin: 150,
      recommended: false,
      note: '2–2.5 hrs. Not preferred — loses safari time. Use only if no FedAir availability.',
    },
  ];
}

function hdsMqp(): LastMile[] {
  // Singita Lebombo (SAT), Singita Sweni (SAT) — N'wanetsi area, HDS is natural gateway
  return [
    {
      mode: 'fedair', label: 'FedAir Lowveld Shuttle → Hoedspruit (HDS)',
      fromAirport: 'HDS', fare: 3000, currency: 'ZAR', durationMin: 20,
      recommended: true,
      note: 'FedAir flt 3401/3402 series. Airlink HDS→CPT 2x daily (08:00, 14:00). CemAir 1x daily.',
    },
    {
      mode: 'fedair', label: 'FedAir Lowveld Shuttle → Kruger Mpumalanga (MQP)',
      fromAirport: 'MQP', fare: 5000, currency: 'ZAR', durationMin: 40,
      recommended: false,
      note: 'Further than HDS for central Kruger lodges. Use if MQP commercial fare is significantly better.',
    },
  ];
}

export const PROPERTY_LASTMILE: Record<string, LastMile[]> = {
  // SZK cluster (Lion Sands — Skukuza airstrip)
  'Lion Sands Ivory Lodge':         szkOptions(),

  // SSX / Sabi Sands western cluster — Singita direct service + MQP Lowveld
  'Singita Boulders Lodge':         ssx_ldz_uls(),
  'Singita Ebony Lodge':            ssx_ldz_uls(),

  // LDZ — Londolozi direct FedAir service (flt 2011/2012)
  'Londolozi Tree Camp':            ssx_ldz_uls(),
  'Londolozi Varty Camp':           ssx_ldz_uls(),

  // ULS — Ulusaba direct FedAir service (flt 2021/2022)
  'Ulusaba Rock Lodge':             ssx_ldz_uls(),
  'Dulini Lodge':                   ssx_ldz_uls(),

  // GSS — Sabi Sabi (Flexi Lowveld Shuttle)
  'Sabi Sabi Earth Lodge':          ssx_ldz_uls(),

  // ASS — Arathusa / Chitwa Chitwa (Flexi Lowveld Shuttle)
  'Chitwa Chitwa Game Lodge':       ssx_ldz_uls(),

  // SAT — central Kruger / Satara cluster (Lebombo, Sweni)
  'Singita Lebombo Lodge':          hdsMqp(),
  'Singita Sweni Lodge':            hdsMqp(),
};

// Fallback for any Kruger lodge not explicitly mapped above
export const KRUGER_FALLBACK_LASTMILE: LastMile[] = [
  {
    mode: 'fedair', label: 'FedAir Lowveld Shuttle → Kruger Mpumalanga (MQP)',
    fromAirport: 'MQP', fare: 4000, currency: 'ZAR', durationMin: 35,
    recommended: true,
    note: 'FedAir flt 301/302 series. Dep lodge 09:00, arr MQP 10:35. MQP→CPT Airlink direct. FedAir Atlas Rd terminal for JNB connections.',
  },
  {
    mode: 'road', label: 'Road transfer to MQP',
    fromAirport: 'MQP', fare: 2800, currency: 'ZAR', durationMin: 150,
    recommended: false,
    note: '2–2.5 hrs. Reserve this for excess-luggage guests or when FedAir is unavailable.',
  },
];

// ── CAPE TOWN last-mile ───────────────────────────────────────────────────────
// Cape Town is an arrival city — commercial flight lands at CPT directly.
// No bush charter needed. Airport transfer to hotel handled by CityTransferStrip.
// This entry exists so the engine can build exit options FROM Cape Town correctly.
export const CAPE_TOWN_LASTMILE: LastMile[] = [
  {
    mode: 'none', label: 'Airport transfer to hotel',
    fromAirport: 'CPT', fare: 850, currency: 'ZAR', durationMin: 30,
    recommended: true,
    note: 'Private transfer CPT → hotel. 30 min to Waterfront / Atlantic Seaboard. Included in package.',
  },
];

// ── MADIKWE last-mile ─────────────────────────────────────────────────────────
// No commercial airport. FedAir daily shuttle from JNB is the primary option.
// Road is shown as a genuine option for excess-luggage guests — not just a warning.
// GBE (Gaborone, 28km) is a niche premium option for Botswana-side arrivals.
export const MADIKWE_LASTMILE: LastMile[] = [
  {
    mode: 'fedair', label: 'FedAir shuttle JNB → Madikwe',
    fromAirport: 'JNB', fare: 6250, currency: 'ZAR', durationMin: 60,
    recommended: true,
    note: 'Daily: dep JNB 10:00 arr 11:00, dep JNB 13:00 arr 14:00. FedAir Atlas Rd terminal OR Tambo. Standard fare 20kg, hard cases permitted. X Class 32kg + hard case (+25%).',
  },
  {
    mode: 'road', label: 'Private road transfer JNB → Madikwe',
    fromAirport: 'JNB', fare: 3500, currency: 'ZAR', durationMin: 300,
    recommended: false,
    note: '4.5–5.5 hrs via N14/N4 through Zeerust. No baggage restriction — practical for guests with hard cases or excess luggage. Avoid after dark. Confirm West vs East airstrip with lodge.',
  },
  {
    mode: 'charter', label: 'Private charter JNB → Madikwe',
    fromAirport: 'JNB', fare: 50000, currency: 'ZAR', durationMin: 60,
    perCharter: true, recommended: false,
    note: 'Flat rate per charter up to 6 pax. Useful for same-day tight connections or late-afternoon arrivals when FedAir last dep (13:00) has already departed.',
  },
  {
    mode: 'charter', label: 'Light aircraft charter via Gaborone (GBE)',
    fromAirport: 'GBE', fare: 35000, currency: 'ZAR', durationMin: 30,
    perCharter: true, recommended: false,
    note: 'Madikwe is 28km from Gaborone Airport. Niche option for guests arriving via Botswana or EU/UK routing via GBE. ⚠ Requires road transfer from GBE to Madikwe gate (~28km) with 2 border crossings (Botswana exit + SA entry at Kopfontein or Derdepoort). Allow 2–3 hours for road + border processing. Not recommended for tight connections. Air Botswana / Airlink GBE→MUB for Delta connections.',
  },
];

// ── OKAVANGO DELTA last-mile ──────────────────────────────────────────────────
// All Delta camp transfers by light aircraft from MUB (Maun) or BBK (Kasane).
// 20kg SOFT BAG strictly enforced. No hard cases. No exceptions.
// Wilderness Safaris camps: Wilderness Air (included in lodge rate — do not double-bill).
// andBeyond + independent camps: Mack Air (charged separately).
export const OKAVANGO_LASTMILE: LastMile[] = [
  {
    mode: 'mackair', label: 'Mack Air from Maun (MUB)',
    fromAirport: 'MUB', fare: 320, currency: 'USD', durationMin: 30,
    recommended: true,
    note: '20kg SOFT BAG strictly enforced. andBeyond (Xaranna, Sandibe), Eagle Island, Kanana, Nxabega — transfers charged separately. Mack Air stores excess bags at Maun free of charge.',
  },
  {
    mode: 'wilderness', label: 'Wilderness Air from Maun (MUB)',
    fromAirport: 'MUB', fare: 0, currency: 'USD', durationMin: 30,
    recommended: false,
    note: 'Wilderness Safaris camps (Mombo, Little Mombo, DumaTau, Vumbura) — transfer INCLUDED in lodge rate. Do not charge separately. 20kg SOFT BAG strictly enforced.',
  },
  {
    mode: 'mackair', label: 'Mack Air from Kasane (BBK)',
    fromAirport: 'BBK', fare: 380, currency: 'USD', durationMin: 45,
    recommended: false,
    note: 'Alternative gateway — use when guest is routing via Chobe (Kasane) before Delta, or when BBK→MUB charter is more direct than via Maun. Mack Air hub at Kasane.',
  },
];

// ── VICTORIA FALLS / CHOBE last-mile ─────────────────────────────────────────
// Three airport catchments — property determines correct airport.
// VFA: Zimbabwe side (most lodges). LVI: Zambia side (Tongabezi, Royal Chundu).
// BBK: Botswana/Chobe side (Chobe Chilwero only).
// Mack Air MKB301/302 operates BBK↔VFA daily (20 min) — the seamless Chobe↔Falls connector.

export const VICFALLS_AIRPORT: Record<string, AirportCode> = {
  // Zimbabwe side — VFA
  'Matetsi Victoria Falls':              'VFA',
  'The Elephant Camp':                   'VFA',
  'Anantara Stanley and Livingstone':    'VFA',
  'Victoria Falls River Lodge Island Suite': 'VFA',
  'Victoria Falls Safari Club':          'VFA',
  'Old Drift Lodge':                     'VFA',
  'Ilala Lodge Hotel':                   'VFA',
  'Thorntree River Lodge':               'VFA',
  'Bushtracks Africa Victoria Falls':    'VFA',
  // Zambia side — LVI (Livingstone)
  'Tongabezi Lodge':                     'LVI',
  'Royal Chundu Island Lodge':           'LVI',
  // Botswana/Chobe side — BBK (Kasane)
  'Chobe Chilwero':                      'BBK',
};

export function vicFallsLastMile(airport: AirportCode): LastMile[] {
  if (airport === 'BBK') return [
    {
      mode: 'road', label: 'Private transfer from Kasane (BBK)',
      fromAirport: 'BBK', fare: 1500, currency: 'ZAR', durationMin: 15,
      recommended: true,
      note: 'BBK airport 10–15 min from Chobe Chilwero. Private vehicle. Mack Air MKB301 also connects BBK→VFA (20 min, dep 12:00) for same-day Falls excursion.',
    },
  ];
  if (airport === 'LVI') return [
    {
      mode: 'road', label: 'Private transfer from Livingstone (LVI)',
      fromAirport: 'LVI', fare: 1800, currency: 'ZAR', durationMin: 20,
      recommended: true,
      note: 'LVI airport 15–20 min from Livingstone lodges. KAZA UniVisa (USD50) recommended for guests wanting to cross to Zimbabwe side.',
    },
  ];
  // VFA (Zimbabwe side) — default
  return [
    {
      mode: 'road', label: 'Private transfer from Victoria Falls (VFA)',
      fromAirport: 'VFA', fare: 1800, currency: 'ZAR', durationMin: 20,
      recommended: true,
      note: 'VFA airport 20 min from Victoria Falls town. Most lodges include airport collection — confirm at booking.',
    },
    {
      mode: 'charter', label: 'Helicopter arrival at lodge helipad',
      fromAirport: 'VFA', fare: 15000, currency: 'ZAR', durationMin: 8,
      recommended: false, perCharter: true,
      note: 'United Air Charters or Zambezi Helicopter Company. 8 min scenic approach over the Falls. Rate TBC — confirm with United Air Charters.',
    },
  ];
}

// ── REGION → COMMERCIAL ARRIVAL AIRPORT(S) ───────────────────────────────────
// Drives which Duffel routes to query for the commercial hub→hub leg.
export const REGION_COMMERCIAL_AIRPORTS: Record<string, AirportCode[]> = {
  'kruger-sabi-sand': ['MQP', 'HDS', 'SZK'],  // preferred order: MQP/HDS direct, SZK via Lowveld
  'okavango-delta':   ['MUB', 'BBK'],           // MUB primary, BBK if Chobe leg in itinerary
  'madikwe':          ['JNB'],                  // commercial to JNB, then FedAir or road
  'chobe-vic-falls':  ['VFA', 'LVI', 'BBK'],    // property-dependent — see VICFALLS_AIRPORT
  'cape-town':        ['CPT'],                  // commercial direct to CPT
};

// ── CARRIER ADJUSTMENTS vs Airlink baseline ───────────────────────────────────
// Used when Duffel returns no live fare — adjust the Airlink estimate proportionally.
// FlySafair: monitor — July 2025 industrial action (~12% cancellation rate). Verify before booking.
export const CARRIER_ADJUST: Record<string, number> = {
  'cemair':    0.90,   // ~10% below Airlink. CRJ/Dash 8. Good alternative.
  'flysafair': 0.75,   // ~25% below Airlink. Budget. Tue/Sat CPT→MQP only.
  'fastjet':   1.05,   // ~5% above Airlink on VFA routes. Zimbabwe carrier. Good timing.
  'saa':       1.20,   // ~20% above Airlink. Full-service. Star Alliance.
  'air botswana': 0.85,
};

// ── SPECIAL ROUTE: VFA ↔ OKAVANGO via Kasane ─────────────────────────────────
// Mack Air MKB301/302 BBK↔VFA (20 min daily) makes same-day Delta→Vic Falls possible.
// This is the ONLY reliable same-day option for this crossing.
export const VFA_OKAVANGO: LastMile[] = [
  {
    mode: 'mackair', label: 'Mack Air BBK↔VFA shuttle + Delta charter',
    fromAirport: 'BBK', fare: 450, currency: 'USD', durationMin: 120,
    recommended: true,
    note: 'MKB301 BBK→VFA dep 12:00 arr 12:20 (20 min). MKB302 VFA→BBK dep 11:00. Same-day Delta→Vic Falls only via this route. Confirm seats — limited capacity.',
  },
  {
    mode: 'charter', label: 'Private charter VFA ↔ Delta direct',
    fromAirport: 'VFA', fare: 150000, currency: 'ZAR', durationMin: 90,
    perCharter: true, recommended: false,
    note: 'Flat rate per charter, direct. Premium option for time-critical guests or small groups. Confirm with charter operator.',
  },
];

// ── INTERNAL LEGS — fallback routing text for each direction ─────────────────
// Used when buildTransferOptions falls back to a single static display option.
// These are NEVER the primary path — the lastMileFor / Duffel engine builds
// the real options. These are fallback text only.
export type InternalLeg = {
  fromLabel: string; toLabel: string;
  mode: 'scheduled' | 'charter' | 'road' | 'combo';
  provider: string; duration: string;
  estimatedCostZAR: number; aiNote: string; bufferHours: number;
  road_viable?: boolean;
};

export const INTERNAL_LEGS: Record<string, InternalLeg> = {
  // ── Cape Town departures ────────────────────────────────────────────────
  'cape-town→kruger-sabi-sand': {
    fromLabel:'Cape Town', toLabel:'Sabi Sand',
    mode:'scheduled',
    provider:'Airlink/CemAir CPT→HDS or CPT→MQP + FedAir lodge hop',
    duration:'~3h 30m door-to-door',
    estimatedCostZAR: 11500,
    aiNote:'CPT→HDS (Airlink 2x daily, 07:00/13:00, 2h45) or CPT→MQP (Airlink 2–3x daily, 07:00, 2h40). FedAir lodge hop from HDS/MQP to lodge airstrip — avoids JNB entirely. HDS for Timbavati/Klaserie/northern Sabi. MQP for Singita/Londolozi/southern Sabi. Only route via JNB if direct HDS/MQP fares are not available.',
    bufferHours: 3, road_viable: false,
  },
  'cape-town→okavango-delta': {
    fromLabel:'Cape Town', toLabel:'Okavango Delta',
    mode:'scheduled',
    provider:'Airlink CPT→MUB direct (only nonstop option)',
    duration:'~2h 30m + charter to camp',
    estimatedCostZAR: 16500,
    aiNote:'Airlink 4Z314: dep CPT 10:35 arr MUB 13:05 daily. ONLY nonstop CPT–MUB — book early (fills Jun–Sep). Wilderness Air or Mack Air charter to camp (15–45 min from MUB). Build Maun overnight for any international connection.',
    bufferHours: 3.5, road_viable: false,
  },
  'cape-town→chobe-vic-falls': {
    fromLabel:'Cape Town', toLabel:'Victoria Falls',
    mode:'scheduled',
    provider:'Airlink CPT→VFA direct (Zimbabwe) or CPT→JNB→VFA',
    duration:'~3h direct or ~4h via JNB',
    estimatedCostZAR: 13500,
    aiNote:'Option 1 (preferred): Airlink CPT→VFA direct daily ~07:30 arr ~10:25. Option 2: CPT→JNB + Airlink JNB→VFA dep 11:35 arr 13:20 — allow 2h at OR Tambo. Zambia-side lodges (Tongabezi, Royal Chundu): CPT→JNB→LVI. Chobe Chilwero: CPT→JNB→BBK.',
    bufferHours: 3, road_viable: false,
  },
  'cape-town→madikwe': {
    fromLabel:'Cape Town', toLabel:'Madikwe',
    mode:'combo',
    provider:'CPT→JNB (any carrier) + FedAir JNB→Madikwe or road',
    duration:'~4h total',
    estimatedCostZAR: 11000,
    aiNote:'Fly CPT→JNB (any carrier, from 06:00). FedAir dep JNB 10:00 or 13:00 from Atlas Rd terminal. Same-day achievable on early CPT departure catching 13:00 FedAir. Road alternative: JNB→Madikwe 4.5–5.5hrs via N14/N4 — no baggage restriction, practical for excess-luggage guests.',
    bufferHours: 4, road_viable: true,
  },

  // ── Kruger departures ───────────────────────────────────────────────────
  'kruger-sabi-sand→cape-town': {
    fromLabel:'Sabi Sand', toLabel:'Cape Town',
    mode:'scheduled',
    provider:'FedAir Lowveld Shuttle to HDS/MQP/SZK + direct commercial to CPT',
    duration:'~3h 30m door-to-door',
    estimatedCostZAR: 11500,
    aiNote:'FedAir Lowveld Shuttle dep lodge ~09:00: arr MQP 10:35 (flt 301), arr HDS via 3400 series, arr SZK via 3100 series. Direct commercial: HDS→CPT Airlink 2x daily (08:00/14:00, 2h45), SZK→CPT Airlink 2x daily, MQP→CPT Airlink 2–3x daily + FlySafair Tue/Sat. Routing via JNB is the fallback only — unnecessary connection adds 1.5hrs.',
    bufferHours: 3, road_viable: false,
  },
  'kruger-sabi-sand→okavango-delta': {
    fromLabel:'Sabi Sand', toLabel:'Okavango Delta',
    mode:'scheduled',
    provider:'FedAir to MQP/HDS + Airlink/CemAir to JNB + Airlink JNB→MUB + Wilderness Air/Mack Air to camp',
    duration:'~7h door-to-door (full travel day)',
    estimatedCostZAR: 22000,
    aiNote:'No direct Kruger→Maun routing. Exit via FedAir Lowveld Shuttle to MQP (dep 09:00 arr 10:35). MQP→JNB Airlink/CemAir multiple daily (~1h). JNB→MUB Airlink dep ~10:00 arr ~12:10 (2h10) or Air Botswana. Wilderness Air/Mack Air charter to camp from Maun. Maun overnight strongly recommended — same-day arrival is high-risk.',
    bufferHours: 7, road_viable: false,
  },
  'kruger-sabi-sand→chobe-vic-falls': {
    fromLabel:'Sabi Sand', toLabel:'Victoria Falls',
    mode:'scheduled',
    provider:'FedAir to MQP + Airlink MQP→VFA direct (Mon/Wed/Fri/Sun)',
    duration:'~3h door-to-door',
    estimatedCostZAR: 14000,
    aiNote:'Option 1 (preferred Mon/Wed/Fri/Sun): FedAir lodge→MQP dep 09:00, Airlink 4Z476 MQP→VFA dep 11:35 arr 13:25 (1h50 direct). No JNB connection. Option 2 (Tue/Thu/Sat): MQP→JNB + Airlink JNB→VFA dep 11:35 arr 13:20 — allow 2h at OR Tambo. VFA→Kasane (Chobe): road 1–1.5h or Mack Air MKB302 VFA→BBK dep 11:00 arr 11:20.',
    bufferHours: 3, road_viable: false,
  },
  'kruger-sabi-sand→madikwe': {
    fromLabel:'Sabi Sand', toLabel:'Madikwe',
    mode:'scheduled',
    provider:'FedAir Lowveld Shuttle to MQP + Airlink MQP→JNB + FedAir JNB→Madikwe',
    duration:'~4h door-to-door',
    estimatedCostZAR: 10500,
    aiNote:'FedAir lodge→MQP dep 09:00 arr 10:35. MQP→JNB Airlink/CemAir multiple daily arr ~11:30. FedAir JNB→Madikwe dep 13:00 arr 14:00. Allow 2h at OR Tambo between legs.',
    bufferHours: 4, road_viable: false,
  },

  // ── Okavango departures ─────────────────────────────────────────────────
  'okavango-delta→cape-town': {
    fromLabel:'Okavango Delta', toLabel:'Cape Town',
    mode:'scheduled',
    provider:'Wilderness Air/Mack Air to MUB + Airlink MUB→CPT direct',
    duration:'~3h 30m + camp exit charter',
    estimatedCostZAR: 16500,
    aiNote:'AM charter exit to MUB (arr ~09:00–10:00). Airlink 4Z314 reverse: MUB→CPT dep ~13:30 arr ~16:00 (2h30). ONLY direct MUB→CPT option — if missed, route MUB→JNB→CPT (multiple daily). Confirm camp departure time aligns with Airlink connection.',
    bufferHours: 4, road_viable: false,
  },
  'okavango-delta→kruger-sabi-sand': {
    fromLabel:'Okavango Delta', toLabel:'Sabi Sand',
    mode:'scheduled',
    provider:'Charter to MUB + Airlink/Air Botswana MUB→JNB + FedAir/Airlink JNB→Lowveld',
    duration:'~7h door-to-door',
    estimatedCostZAR: 22000,
    aiNote:'AM charter to MUB (arr ~09:30). Airlink/Air Botswana MUB→JNB dep ~12:00 arr ~14:10 (2h10). JNB→Lowveld: FedAir dep 13:30 arr ~15:00 (lodge direct), or Airlink JNB→HDS dep 12:30/16:30, or Airlink JNB→MQP multiple daily. Alternatively: MUB→JNB→SZK Airlink 4Z daily. Maun overnight removes all connection risk.',
    bufferHours: 7, road_viable: false,
  },
  'okavango-delta→chobe-vic-falls': {
    fromLabel:'Okavango Delta', toLabel:'Victoria Falls',
    mode:'charter',
    provider:'Wilderness Air/Mack Air to BBK + Mack Air MKB302 BBK→VFA',
    duration:'~3h same-day via Kasane',
    estimatedCostZAR: 9500,
    aiNote:'Option 1 (PREFERRED — same-day possible): AM charter to Kasane (BBK) arr ~09:00–10:00. Mack Air MKB302 dep BBK 12:00 arr VFA 12:20 (20 min). Guests at Vic Falls by lunch. Option 2 (requires JNB overnight): MUB→JNB→VFA — JNB→VFA dep ~15:00 is very tight; overnight JNB usually necessary.',
    bufferHours: 3, road_viable: false,
  },
  'okavango-delta→madikwe': {
    fromLabel:'Okavango Delta', toLabel:'Madikwe',
    mode:'scheduled',
    provider:'Charter to MUB + Airlink MUB→JNB + FedAir JNB→Madikwe (overnight JNB required)',
    duration:'~5h + JNB overnight',
    estimatedCostZAR: 18000,
    aiNote:'AM charter to MUB. Airlink/Air Botswana MUB→JNB dep ~12:00 arr ~14:10. Morning JNB→MUB flights depart before FedAir returns from Madikwe — same-day is not possible on scheduled services. Overnight in Johannesburg standard. Alternative: private FedAir charter for late-day connection. Niche premium option: light aircraft Madikwe→GBE (28km), then Air Botswana GBE→MUB.',
    bufferHours: 5, road_viable: false,
  },

  // ── Victoria Falls / Chobe departures ───────────────────────────────────
  'chobe-vic-falls→cape-town': {
    fromLabel:'Victoria Falls', toLabel:'Cape Town',
    mode:'scheduled',
    provider:'Airlink VFA→CPT direct (Zimbabwe) or VFA→JNB→CPT',
    duration:'~3h direct',
    estimatedCostZAR: 13500,
    aiNote:'Option 1 (preferred): Airlink VFA→CPT direct dep ~14:20 arr ~17:30 (~3h). Option 2: VFA→JNB (dep 14:00 arr 15:45) + JNB→CPT (multiple daily) — allow 2.5h at OR Tambo minimum. Kenya Airways VFA→CPT via NBO also available for select days.',
    bufferHours: 3, road_viable: false,
  },
  'chobe-vic-falls→kruger-sabi-sand': {
    fromLabel:'Victoria Falls', toLabel:'Sabi Sand',
    mode:'scheduled',
    provider:'Airlink VFA→MQP direct (Mon/Wed/Fri/Sun) + FedAir lodge hop',
    duration:'~3h door-to-door',
    estimatedCostZAR: 15000,
    aiNote:'Option 1 (preferred Mon/Wed/Fri/Sun): Airlink 4Z476 reverse VFA→MQP dep 13:35 arr 15:25 (1h50 direct). FedAir Lowveld Shuttle MQP→lodge. Option 2 (Tue/Thu/Sat): VFA→JNB (dep 14:00 arr 15:45) + FedAir/Airlink JNB→Lowveld next morning. ',
    bufferHours: 3, road_viable: false,
  },
  'chobe-vic-falls→okavango-delta': {
    fromLabel:'Victoria Falls / Chobe', toLabel:'Okavango Delta',
    mode:'charter',
    provider:'Mack Air MKB301 VFA→BBK + charter BBK→Delta camp',
    duration:'~3h same-day via Kasane',
    estimatedCostZAR: 9500,
    aiNote:'Mack Air MKB301 VFA→BBK dep 12:00 arr 12:20 (20 min). Wilderness Air or Mack Air charter BBK→camp (15–45 min). Same-day achievable — only reliable option for this crossing. JNB routing requires overnight.',
    bufferHours: 3, road_viable: false,
  },
  'chobe-vic-falls→madikwe': {
    fromLabel:'Victoria Falls', toLabel:'Madikwe',
    mode:'scheduled',
    provider:'VFA→JNB + FedAir JNB→Madikwe (overnight JNB required)',
    duration:'~4h + JNB overnight',
    estimatedCostZAR: 16000,
    aiNote:'VFA→JNB dep 14:00 arr 15:45 (1h45). FedAir JNB→Madikwe dep next day 10:00 or 13:00. Same-day is not feasible — overnight Johannesburg is the standard recommendation. Private FedAir charter available if same-day is critical.',
    bufferHours: 4, road_viable: false,
  },

  // ── Madikwe departures ──────────────────────────────────────────────────
  'madikwe→cape-town': {
    fromLabel:'Madikwe', toLabel:'Cape Town',
    mode:'combo',
    provider:'FedAir Madikwe→JNB + any carrier JNB→CPT',
    duration:'~3h 30m',
    estimatedCostZAR: 11000,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15 or dep 14:30 arr 15:30. JNB→CPT Airlink/FlySafair/SAA/Lift multiple daily from ~12:00 (2h). Same-day achievable on 11:15 departure + midday JNB→CPT. Road alternative JNB→Madikwe 4.5–5.5h available for reverse journey.',
    bufferHours: 3.5, road_viable: true,
  },
  'madikwe→kruger-sabi-sand': {
    fromLabel:'Madikwe', toLabel:'Sabi Sand',
    mode:'combo',
    provider:'FedAir Madikwe→JNB + FedAir/Airlink JNB→Lowveld',
    duration:'~3h 30m',
    estimatedCostZAR: 10500,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15. FedAir dep JNB 13:30 arr lodge ~15:00, or Airlink JNB→HDS dep 12:30/16:30, or JNB→MQP multiple daily. Same-day Madikwe→Kruger achievable on 11:15 FedAir departure.',
    bufferHours: 3.5, road_viable: false,
  },
  'madikwe→chobe-vic-falls': {
    fromLabel:'Madikwe', toLabel:'Victoria Falls',
    mode:'combo',
    provider:'FedAir Madikwe→JNB + Airlink JNB→VFA (overnight JNB recommended)',
    duration:'~4h + overnight',
    estimatedCostZAR: 16000,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15. Airlink JNB→VFA dep 11:35 — too tight. Recommend overnight JNB and dep next morning. Private FedAir charter is the only same-day solution if critical. FedAir dep MWD 14:30 arr JNB 15:30 connects to no same-day VFA option.',
    bufferHours: 4, road_viable: false,
  },
  'madikwe→okavango-delta': {
    fromLabel:'Madikwe', toLabel:'Okavango Delta',
    mode:'combo',
    provider:'FedAir Madikwe→JNB + Airlink JNB→MUB (overnight JNB required)',
    duration:'~5h + overnight',
    estimatedCostZAR: 18000,
    aiNote:'FedAir dep MWD 11:15 arr JNB 12:15. JNB→MUB Airlink dep ~10:00 — departs before FedAir lands. Same-day not possible on scheduled services. Overnight Johannesburg is standard. Niche alternative: light aircraft charter Madikwe→GBE (Gaborone, 28km), then Air Botswana/Airlink GBE→MUB.',
    bufferHours: 5, road_viable: false,
  },
};

export function getInternalLeg(fromSlug: string, toSlug: string): InternalLeg | null {
  const fwd = `${fromSlug}→${toSlug}`;
  const rev = `${toSlug}→${fromSlug}`;
  if (INTERNAL_LEGS[fwd]) return INTERNAL_LEGS[fwd];
  if (INTERNAL_LEGS[rev]) {
    const r = INTERNAL_LEGS[rev];
    return { ...r, fromLabel: r.toLabel, toLabel: r.fromLabel };
  }
  return {
    fromLabel: fromSlug.replace(/-/g,' '),
    toLabel:   toSlug.replace(/-/g,' '),
    mode: 'scheduled', provider: 'Confirmed by Journey Specialist',
    duration: 'TBC', estimatedCostZAR: 10000,
    aiNote: 'Your Journey Specialist will recommend the best routing for this combination.',
    bufferHours: 3,
  };
}

// ── RESOLVER — last-mile options for a given lodge + region ──────────────────
export function lastMileFor(propertyName: string, regionSlug: string): LastMile[] {
  if (regionSlug === 'kruger-sabi-sand') {
    return PROPERTY_LASTMILE[propertyName] ?? KRUGER_FALLBACK_LASTMILE;
  }
  if (regionSlug === 'madikwe')         return MADIKWE_LASTMILE;
  if (regionSlug === 'okavango-delta')  return OKAVANGO_LASTMILE;
  if (regionSlug === 'chobe-vic-falls') {
    const ap = VICFALLS_AIRPORT[propertyName] ?? 'VFA';
    return vicFallsLastMile(ap);
  }
  if (regionSlug === 'cape-town')       return CAPE_TOWN_LASTMILE;
  return [];
}

// Convert a LastMile fare to ZAR for the pricing engine.
export function lastMileZar(lm: LastMile, usdToZar: number, pax: number): number {
  const base = lm.currency === 'USD' ? lm.fare * usdToZar : lm.fare;
  return lm.perCharter ? Math.round(base) : Math.round(base * pax);
}

// ── EXIT LEG (origin region → hub airport) ────────────────────────────────────
// Leaving a region: lodge → hub airport (same physical hop as arrival last-mile, reversed).
// Cape Town: direct commercial out of CPT, no exit hop needed.
export function exitLastMileFor(originLodge: string, fromRegionSlug: string): LastMile[] {
  if (fromRegionSlug === 'cape-town') return [];
  return lastMileFor(originLodge, fromRegionSlug);
}

// The hub airport reached after the exit hop — where the commercial leg departs from.
export function originHubAirport(originLodge: string, fromRegionSlug: string): AirportCode {
  if (fromRegionSlug === 'cape-town') return 'CPT';
  const ex  = exitLastMileFor(originLodge, fromRegionSlug);
  const rec = ex.find(l => l.recommended) ?? ex[0];
  return rec ? rec.fromAirport : (REGION_COMMERCIAL_AIRPORTS[fromRegionSlug]?.[0] ?? 'JNB');
}

// The commercial leg must always target the chosen last-mile's fromAirport.
export function commercialTargetForOption(option: LastMile): AirportCode {
  return option.fromAirport;
}

// Default commercial target for pre-search (before traveller selects last-mile).
export function defaultCommercialTarget(propertyName: string, regionSlug: string): AirportCode | null {
  const lm  = lastMileFor(propertyName, regionSlug);
  const rec = lm.find(l => l.recommended) ?? lm[0];
  return rec ? rec.fromAirport : (REGION_COMMERCIAL_AIRPORTS[regionSlug]?.[0] ?? null);
}

// Price a complete transfer: commercial fare (from Duffel/estimate) + last-mile.
export function priceTransfer(
  option: LastMile, commercialFareZar: number, usdToZar: number, pax: number
): { commercialZar: number; lastMileZar: number; totalZar: number; targetAirport: AirportCode } {
  const lm = lastMileZar(option, usdToZar, pax);
  return {
    commercialZar:  Math.round(commercialFareZar),
    lastMileZar:    lm,
    totalZar:       Math.round(commercialFareZar) + lm,
    targetAirport:  option.fromAirport,
  };
}
