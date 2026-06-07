// ─── THE PRICING ENGINE ───────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for all margin maths. Pure functions. No React, no DB.
// Every price the traveller ever sees, and every margin TSE ever books, is
// computed here. If margin logic is not in this file, it is a bug.
//
// Built on lib/fx.ts for currency handling. Consumed by:
//   - /api/itinerary-margin-audit  (the per-itinerary audit/demo tool)
//   - app/page.tsx                 (checkout component build)
//   - /admin/pricing-audit         (the investor demo screen)
// ──────────────────────────────────────────────────────────────────────────────

export type Pillar = 'hotel' | 'flight' | 'transfer' | 'activity' | 'upgrade';

// Where a price came from — drives the "data gaps" report.
export type PriceSource =
  | 'contract'        // signed supplier rate — trustworthy
  | 'supplier_data'   // supplier rate sheet — trustworthy
  | 'KB'              // knowledge base
  | 'AI_inferred'     // extrapolated — needs review
  | 'fallback'        // NO real rate found — engine guessed. RED FLAG.
  | 'estimate';       // rough estimate (e.g. budget × fraction). AMBER FLAG.

export interface RawLine {
  pillar:     Pillar;
  label:      string;
  location?:  string;
  netZar:     number;          // true net cost in ZAR, already × nights/qty
  displayZar?: number;         // if a real display rate exists, pass it; else engine applies margin
  nights?:    number;
  qty?:       number;
  source?:    PriceSource;
}

export interface MarginConfig {        // multipliers: 1.15 = 15% margin
  hotels: number; flights: number; transfers: number; activities: number;
}

export interface FloorConfig {         // minimum acceptable multiplier per pillar
  hotels: number; flights: number; transfers: number; activities: number;
}

// Default floors — a margin below this fires an alarm in the audit.
export const DEFAULT_FLOORS: FloorConfig = {
  hotels: 1.10, flights: 1.05, transfers: 1.12, activities: 1.12,
};

function multiplierFor(pillar: Pillar, m: MarginConfig): number {
  switch (pillar) {
    case 'hotel':    return m.hotels;
    case 'flight':   return m.flights;
    case 'transfer': return m.transfers;
    case 'activity': return m.activities;
    case 'upgrade':  return m.hotels;   // upgrades inherit hotel margin
  }
}

export interface PricedLine {
  pillar:      Pillar;
  label:       string;
  location?:   string;
  nights?:     number;
  netZar:      number;
  displayZar:  number;
  marginZar:   number;
  marginPct:   number;        // (display − net) / display × 100
  source:      PriceSource;
  dataGap:     boolean;       // true if net was guessed / missing
  floorBreach: boolean;       // true if implied margin below the pillar floor
}

export function priceLine(raw: RawLine, margins: MarginConfig, floors: FloorConfig = DEFAULT_FLOORS): PricedLine {
  const mult   = multiplierFor(raw.pillar, margins);
  const source = raw.source ?? 'supplier_data';
  const net    = Math.max(0, Math.round(raw.netZar || 0));

  // If a real display rate exists, honour it (real-world margin). Else apply pillar margin.
  const display = raw.displayZar && raw.displayZar > 0
    ? Math.round(raw.displayZar)
    : Math.round(net * mult);

  const marginZar = display - net;
  const marginPct = display > 0 ? Math.round((marginZar / display) * 1000) / 10 : 0;

  const floorMult: Record<Pillar, number> = {
    hotel: floors.hotels, flight: floors.flights, transfer: floors.transfers,
    activity: floors.activities, upgrade: floors.hotels,
  };
  const impliedMult = net > 0 ? display / net : mult;
  const floorBreach = net > 0 && impliedMult < floorMult[raw.pillar];
  const dataGap     = net <= 0 || source === 'fallback' || source === 'estimate';

  return {
    pillar: raw.pillar, label: raw.label, location: raw.location, nights: raw.nights,
    netZar: net, displayZar: display, marginZar, marginPct, source, dataGap, floorBreach,
  };
}

export interface PillarBreakdown {
  pillar: Pillar; netZar: number; displayZar: number; marginZar: number; marginPct: number; lines: number;
}

export interface UpsellCandidate {
  label:     string;
  pillar:    Pillar;
  netZar:    number;
  displayZar?: number;
  source?:   PriceSource;
}

export interface UpsellSuggestion {
  label:        string;
  pillar:       Pillar;
  addsDisplay:  number;
  addsMargin:   number;
  marginPct:    number;
}

export interface ItineraryAudit {
  lines:            PricedLine[];
  byPillar:         PillarBreakdown[];
  totals:           { netZar: number; displayZar: number; marginZar: number; blendedMarginPct: number };
  budget: {
    budgetZar:      number;
    displayZar:     number;
    utilisationPct: number;     // display / budget × 100
    headroomZar:    number;     // budget − display (0 if over)
    overBudgetZar:  number;     // display − budget (0 if under)
    status:         'under' | 'on_target' | 'over';
  };
  headroomMarginAtBlend: number; // headroom × blended margin = money left on the table
  floorBreaches:    PricedLine[];
  dataGaps:         PricedLine[];
  upsells:          UpsellSuggestion[];
  generatedAt:      string;
}

const ON_TARGET_LOW = 0.92;   // 92–105% of budget = "on target"
const ON_TARGET_HIGH = 1.05;

export function auditItinerary(params: {
  lines:      RawLine[];
  budgetZar:  number;
  margins:    MarginConfig;
  floors?:    FloorConfig;
  candidates?: UpsellCandidate[];   // optional: available upgrades / extra nights to fill headroom
}): ItineraryAudit {
  const floors = params.floors ?? DEFAULT_FLOORS;
  const priced = params.lines.map(l => priceLine(l, params.margins, floors));

  const totals = priced.reduce(
    (a, l) => ({ netZar: a.netZar + l.netZar, displayZar: a.displayZar + l.displayZar, marginZar: a.marginZar + l.marginZar }),
    { netZar: 0, displayZar: 0, marginZar: 0 }
  );
  const blendedMarginPct = totals.displayZar > 0
    ? Math.round((totals.marginZar / totals.displayZar) * 1000) / 10
    : 0;

  // Per-pillar breakdown
  const pillars: Pillar[] = ['hotel', 'flight', 'transfer', 'activity', 'upgrade'];
  const byPillar: PillarBreakdown[] = pillars.map(p => {
    const ls = priced.filter(l => l.pillar === p);
    const net = ls.reduce((s, l) => s + l.netZar, 0);
    const disp = ls.reduce((s, l) => s + l.displayZar, 0);
    const mar = disp - net;
    return { pillar: p, netZar: net, displayZar: disp, marginZar: mar, marginPct: disp > 0 ? Math.round(mar / disp * 1000) / 10 : 0, lines: ls.length };
  }).filter(b => b.lines > 0);

  // Budget analysis
  const budgetZar = Math.max(0, Math.round(params.budgetZar || 0));
  const utilisationPct = budgetZar > 0 ? Math.round((totals.displayZar / budgetZar) * 1000) / 10 : 0;
  const headroomZar   = Math.max(0, budgetZar - totals.displayZar);
  const overBudgetZar = Math.max(0, totals.displayZar - budgetZar);
  const ratio = budgetZar > 0 ? totals.displayZar / budgetZar : 1;
  const status: 'under' | 'on_target' | 'over' =
    ratio > ON_TARGET_HIGH ? 'over' : ratio >= ON_TARGET_LOW ? 'on_target' : 'under';

  // Money left on the table = headroom captured at current blended margin
  const headroomMarginAtBlend = Math.round(headroomZar * (blendedMarginPct / 100));

  // Upsell optimiser — greedy by margin rand, fill headroom without breaching budget
  const upsells: UpsellSuggestion[] = [];
  if (headroomZar > 0 && params.candidates?.length) {
    const ranked = params.candidates
      .map(c => priceLine({ pillar: c.pillar, label: c.label, netZar: c.netZar, displayZar: c.displayZar, source: c.source }, params.margins, floors))
      .sort((a, b) => b.marginZar - a.marginZar);
    let spent = 0;
    for (const c of ranked) {
      if (spent + c.displayZar <= headroomZar) {
        upsells.push({ label: c.label, pillar: c.pillar, addsDisplay: c.displayZar, addsMargin: c.marginZar, marginPct: c.marginPct });
        spent += c.displayZar;
      }
    }
  }

  return {
    lines: priced,
    byPillar,
    totals: { ...totals, blendedMarginPct },
    budget: { budgetZar, displayZar: totals.displayZar, utilisationPct, headroomZar, overBudgetZar, status },
    headroomMarginAtBlend,
    floorBreaches: priced.filter(l => l.floorBreach),
    dataGaps:      priced.filter(l => l.dataGap),
    upsells,
    generatedAt: new Date().toISOString(),
  };
}
