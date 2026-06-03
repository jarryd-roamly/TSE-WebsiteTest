// ─── RULES ENGINE ─────────────────────────────────────────────────────────────
// Pure functions. Zero AI cost. Deterministic.
// Runs BEFORE the AI call — catches violations early, saves tokens.
// Also runs on the built itinerary — city-level validation.
// HANDOVER: Add new rules here only. Never inline validation in components.
// ─────────────────────────────────────────────────────────────────────────────

export type RuleSeverity = 'hard' | 'soft';

export interface RuleViolation {
  rule:      string;
  severity:  RuleSeverity;
  message:   string;
  autoFix?:  string;
}

export interface RulesInput {
  nights:        number;
  budget:        number;  // ZAR
  adults:        number;
  children:      number;
  infants:       number;
  regions:       string[];  // region slugs selected
  flightIntent:  'include' | 'own' | 'flexible';
  cities?:       Array<{ city: string; nights: number; country: string }>;
  checkinDate?:  string;
}

// ── Lookup tables ─────────────────────────────────────────────────────────────
export const MALARIA_REGIONS = new Set([
  'kruger-sabi-sand', 'okavango-delta', 'chobe-vic-falls',
  'masai-mara', 'phinda', 'bwindi', 'mozambique',
]);

export const MALARIA_FREE_REGIONS = new Set(['cape-town', 'madikwe']);

const MIN_NIGHTS: Record<string, number> = {
  'kruger-sabi-sand': 3,
  'okavango-delta':   3,
  'cape-town':        3,
  'madikwe':          2,
  'chobe-vic-falls':  2,
  'masai-mara':       3,
  'bwindi':           2,
  'phinda':           2,
  'mozambique':       3,
};

const BUDGET_FLOOR_PER_NIGHT_ZAR = 12000;
const NIGHTS_ABSOLUTE_MIN        = 3;
const NIGHTS_ABSOLUTE_MAX        = 28;
const PACKING_WARNING_AVG_NIGHTS = 2.5; // below this per city = rushed

// ── City slug mapping ─────────────────────────────────────────────────────────
export function cityToSlug(city: string): string {
  const map: Record<string, string> = {
    'kruger / sabi sand':   'kruger-sabi-sand',
    'kruger sabi sand':     'kruger-sabi-sand',
    'sabi sand':            'kruger-sabi-sand',
    'okavango delta':       'okavango-delta',
    'okavango':             'okavango-delta',
    'cape town':            'cape-town',
    'madikwe':              'madikwe',
    'victoria falls':       'chobe-vic-falls',
    'vic falls':            'chobe-vic-falls',
    'chobe':                'chobe-vic-falls',
    'chobe / victoria falls': 'chobe-vic-falls',
    'chobe / vic falls':    'chobe-vic-falls',
    'masai mara':           'masai-mara',
    'masai mara, kenya':    'masai-mara',
    'mara':                 'masai-mara',
    'bwindi':               'bwindi',
    'bwindi, uganda':       'bwindi',
    'phinda':               'phinda',
    'mozambique':           'mozambique',
  };
  return map[city.toLowerCase().trim()] ?? city.toLowerCase().replace(/[\s/,]+/g, '-');
}

// ── Main rules check ──────────────────────────────────────────────────────────
export function checkRules(input: RulesInput): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const { nights, budget, adults, children, infants, regions, flightIntent, cities, checkinDate } = input;

  // ── 1. Malaria + infants ───────────────────────────────────────────────────
  if (infants > 0) {
    const malariaExposure = regions.filter(r => MALARIA_REGIONS.has(r));
    if (malariaExposure.length > 0) {
      violations.push({
        rule: 'malaria_infants',
        severity: 'hard',
        message: `Infants cannot travel to malaria areas. Your selected regions include: ${malariaExposure.join(', ')}.`,
        autoFix: 'Switch to Madikwe or Cape Town — Big Five, malaria-free, child-friendly.',
      });
    }
    // Also check city-level if itinerary is built
    if (cities) {
      for (const c of cities) {
        const slug = cityToSlug(c.city);
        if (MALARIA_REGIONS.has(slug)) {
          violations.push({
            rule: `malaria_infants_city_${slug}`,
            severity: 'hard',
            message: `${c.city} is a malaria area and cannot be included with infants travelling.`,
            autoFix: 'Remove this destination or travel without infants.',
          });
        }
      }
    }
  }

  // ── 2. Budget floor ────────────────────────────────────────────────────────
  if (nights > 0 && budget > 0) {
    const budgetPerNight = budget / nights;
    if (budgetPerNight < BUDGET_FLOOR_PER_NIGHT_ZAR) {
      const minBudget = BUDGET_FLOOR_PER_NIGHT_ZAR * nights;
      violations.push({
        rule: 'budget_floor',
        severity: 'hard',
        message: `Budget of R${budget.toLocaleString()} for ${nights} nights is R${Math.round(budgetPerNight).toLocaleString()}/night — below the R${BUDGET_FLOOR_PER_NIGHT_ZAR.toLocaleString()}/night minimum required for quality lodges.`,
        autoFix: `Minimum recommended for ${nights} nights: R${minBudget.toLocaleString()}.`,
      });
    }
  }

  // ── 3. Night count bounds ──────────────────────────────────────────────────
  if (nights < NIGHTS_ABSOLUTE_MIN) {
    violations.push({
      rule: 'nights_min',
      severity: 'hard',
      message: `${nights} night${nights !== 1 ? 's' : ''} is too short for a meaningful safari experience.`,
      autoFix: 'Minimum 3 nights. We recommend 4–7 nights as a starting point.',
    });
  }
  if (nights > NIGHTS_ABSOLUTE_MAX) {
    violations.push({
      rule: 'nights_max',
      severity: 'soft',
      message: `${nights} nights is longer than typical. Please confirm this is correct.`,
    });
  }

  // ── 4. City minimum nights ─────────────────────────────────────────────────
  if (cities) {
    for (const city of cities) {
      const slug = cityToSlug(city.city);
      const min = MIN_NIGHTS[slug] ?? 2;
      if (city.nights < min) {
        violations.push({
          rule: `min_nights_${slug}`,
          severity: 'soft',
          message: `${city.nights} night${city.nights !== 1 ? 's' : ''} in ${city.city} is too short. Minimum recommended: ${min} nights.`,
          autoFix: `Extend ${city.city} to at least ${min} nights.`,
        });
      }
    }
  }

  // ── 5. Single-night international connections ──────────────────────────────
  if (cities && flightIntent === 'include') {
    const singleNight = cities.filter(c => c.nights === 1);
    if (singleNight.length > 0) {
      violations.push({
        rule: 'one_night_intl',
        severity: 'soft',
        message: `1-night stop with international flights is not recommended: ${singleNight.map(c => c.city).join(', ')}.`,
        autoFix: 'Extend to minimum 2 nights, or remove as a transit stop.',
      });
    }
  }

  // ── 6. Over-packed itinerary warning ──────────────────────────────────────
  if (cities && cities.length >= 3) {
    const avgNights = nights / cities.length;
    if (avgNights < PACKING_WARNING_AVG_NIGHTS) {
      violations.push({
        rule: 'over_packed',
        severity: 'soft',
        message: `${cities.length} destinations in ${nights} nights averages ${avgNights.toFixed(1)} nights per stop — this will feel rushed.`,
        autoFix: 'Consider dropping one destination to allow more depth.',
      });
    }
  }

  // ── 7. Adult count sanity ──────────────────────────────────────────────────
  if (adults < 1) {
    violations.push({ rule: 'adults_min', severity: 'hard', message: 'At least 1 adult traveller required.' });
  }
  if (adults > 12) {
    violations.push({
      rule: 'group_size',
      severity: 'soft',
      message: `Groups of ${adults} may exceed single-property capacity. Your specialist will advise on camp buyouts.`,
    });
  }

  return violations;
}

// ── Convenience helpers ───────────────────────────────────────────────────────
export function hasHardViolations(violations: RuleViolation[]): boolean {
  return violations.some(v => v.severity === 'hard');
}

export function hardViolations(violations: RuleViolation[]): RuleViolation[] {
  return violations.filter(v => v.severity === 'hard');
}

export function softViolations(violations: RuleViolation[]): RuleViolation[] {
  return violations.filter(v => v.severity === 'soft');
}
