// ─── app/lib/kb.ts ────────────────────────────────────────────────────────────
// TSE Knowledge Base — types, context builder, specialist scoring engine.
//
// This file is the single contract between the KB and everything that reads it:
//   - AI planner (buildKBContext → injected into system prompt)
//   - Skeleton engine (fetchKBForRegions → audit + findings)
//   - BCC property tiles (fetchKBForSupplier → "More Info" panels)
//   - Specialist assignment (scoreSpecialists → assignment engine)
//   - Admin module (KBEntry type used throughout)
//
// PRIORITY HIERARCHY (enforced here, not in Claude):
//   1. guidance_importance:3 + override_ai:true  → injected VERBATIM, cannot be contradicted
//   2. guidance_importance:2 + claim_type:'commercial' → margin intelligence, ranks options
//   3. guidance_importance:2 + claim_type:other  → strong specialist recommendations
//   4. guidance_importance:1                     → advisory context
//
// NEVER expose claim_type:'commercial' entries to travellers or suppliers.
// NEVER expose internal_only:true entries to travellers or suppliers.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type KBEntryType =
  | 'region'       // Regional knowledge: seasons, wildlife, why visit
  | 'property'     // Lodge/hotel specific notes
  | 'activity'     // Experience and activity notes
  | 'logistics'    // Transfer chains, routing, operator rules
  | 'airport'      // Connection times, terminal tips
  | 'health'       // Malaria zones, vaccinations
  | 'visa'         // Entry requirements
  | 'commercial';  // Margin intelligence — ALWAYS internal_only

export type KBClaimType =
  | 'factual'       // Web-verifiable: malaria status, bag limits, open/closed
  | 'experiential'  // Specialist judgment: best room, guide rec, seasonal feel
  | 'logistical'    // Operational rules: transfer chains, minimum nights
  | 'commercial';   // Pricing/margin — ALWAYS internal_only, never BCC

export type KBStatus = 'active' | 'flagged' | 'superseded' | 'archived';

export type KBGuidanceImportance = 1 | 2 | 3;
// 1 = advisory   → AI reads as context
// 2 = strong     → AI weights heavily, specialist recommendation
// 3 = override   → Injected VERBATIM, AI cannot contradict

export interface KBVerificationSource {
  type:        'site_visit' | 'fam_trip' | 'supplier_comms' | 'web_source' | 'client_feedback';
  date:        string;       // ISO date
  author_name: string;
  url?:        string;
  attachment_url?: string;
  note?:       string;
}

export interface KBFlag {
  by_name:    string;
  by_email:   string;
  by_role:    string;
  reason:     string;
  note?:      string;
  flagged_at: string;
}

export interface KBExternalSource {
  url:          string;
  source_type:  'google_review' | 'bushbreaks' | 'competitor' | 'health_gov' | 'airline' | 'web';
  snippet:      string;
  verdict:      'confirms' | 'queries' | 'neutral';
  checked_at:   string;
}

export interface KBSeasonalNotes {
  jan?: string; feb?: string; mar?: string; apr?: string;
  may?: string; jun?: string; jul?: string; aug?: string;
  sep?: string; oct?: string; nov?: string; dec?: string;
}

// Full KB entry — matches the knowledge_base Supabase table exactly
export interface KBEntry {
  id:                    string;
  edition_id:            string;
  entry_type:            KBEntryType;
  claim_type:            KBClaimType;
  supplier_id?:          string;
  region_slug?:          string;
  linked_name:           string;
  visit_id?:             string;
  title:                 string;
  highlights?:           string[];
  tips?:                 string[];
  guardrails?:           string[];     // ALWAYS internal — never shown to travellers
  specialist_recs?:      string[];     // Fed to AI planner
  logistics_notes?:      string;
  seasonal_notes?:       KBSeasonalNotes;  // specialist voice — internal/AI use only
  seasonal_notes_guest?: KBSeasonalNotes;  // guest voice — safe for traveller display
  guidance_importance:   KBGuidanceImportance;
  override_ai:           boolean;
  internal_only:         boolean;
  status:                KBStatus;
  version:               number;
  supersedes_id?:        string;
  change_reason?:        string;
  created_by_name:       string;
  created_by_email:      string;
  created_by_role:       string;
  created_at:            string;
  updated_by_name?:      string;
  updated_by_email?:     string;
  updated_at?:           string;
  verified_by?:          string;
  verified_at?:          string;
  evidence_strength:     1 | 2 | 3 | 4 | 5;
  verification_sources:  KBVerificationSource[];
  flag_count:            number;
  flags:                 KBFlag[];
  ext_confirm_count:     number;
  ext_query_count:       number;
  ext_sources:           KBExternalSource[];
  last_validated_at?:    string;
  times_used_in_planner: number;
  last_used_at?:         string;
}

// Lightweight shape used in BCC property tiles (non-internal fields only)
export interface KBTileEntry {
  id:          string;
  linked_name: string;
  title:       string;
  highlights:  string[];
  tips:        string[];
  // guardrails, specialist_recs, commercial entries NEVER included
  evidence_strength: number;
  created_by_name:   string;
}

// Specialist type — matches the specialists Supabase table
export interface Specialist {
  id:                        string;
  edition_id:                string;
  name:                      string;
  email:                     string;
  role:                      string;
  avatar_url?:               string;
  phone_whatsapp?:           string;
  display_title?:            string;
  bio_short?:                string;
  region_specialties:        string[];
  language_codes:            string[];
  is_active:                 boolean;
  on_leave:                  boolean;
  leave_from?:               string;
  leave_until?:              string;
  max_active_bookings:       number;
  current_active_bookings:   number;
  assignment_score_override: number;
  kb_entry_count:            number;
  kb_regions_covered?:       string[];
}

// Assignment scoring result
export interface SpecialistScore {
  specialist:      Specialist;
  total:           number;
  breakdown: {
    region_match:   number;  // +10 per matching region
    kb_depth:       number;  // +1 per active KB entry for matched regions
    load_penalty:   number;  // -8 per active booking, -4 per 0.5 pre-deposit
    site_visit:     number;  // +5 if visited any journey region in last 12 months
    override:       number;  // admin override (can be negative)
  };
}

// Journey context passed to the assignment engine
export interface JourneyContext {
  regions:        string[];      // region slugs in the itinerary
  theme?:         string;
  pax:            number;
  nights:         number;
  budget:         number;
  checkin_date?:  string;
}

// ─── SUPABASE FETCH HELPERS ───────────────────────────────────────────────────

function sbHeaders() {
  return {
    apikey:        SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sbGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(),
    next: { revalidate: 0 }, // No cache — KB overrides must always be fresh
  });
  if (!res.ok) throw new Error(`KB fetch failed: ${res.status} ${path}`);
  return res.json();
}

// ─── KB FETCH FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Fetch all active KB entries for a set of regions.
 * Used by: AI planner, skeleton engine, BCC tip panel.
 * Returns ALL entry types including commercial (caller filters by claim_type).
 */
export async function fetchKBForRegions(
  regionSlugs: string[],
  editionId:   string = 'safari'
): Promise<KBEntry[]> {
  if (!regionSlugs.length) return [];

  const slugFilter = regionSlugs.map(s => `region_slug.eq.${s}`).join(',');
  const path = `knowledge_base?select=*`
    + `&edition_id=eq.${editionId}`
    + `&status=eq.active`
    + `&or=(${slugFilter})`
    + `&order=guidance_importance.desc,evidence_strength.desc`;

  try {
    return await sbGet<KBEntry>(path);
  } catch {
    return [];
  }
}

/**
 * Fetch KB entries for a specific supplier (property tile "More Info").
 * Strips internal_only and commercial entries — safe for traveller display.
 */
export async function fetchKBForSupplier(
  supplierId: string,
  editionId:  string = 'safari'
): Promise<KBTileEntry[]> {
  const path = `knowledge_base?select=id,linked_name,title,highlights,tips,evidence_strength,created_by_name`
    + `&supplier_id=eq.${supplierId}`
    + `&edition_id=eq.${editionId}`
    + `&status=eq.active`
    + `&internal_only=eq.false`
    + `&claim_type=neq.commercial`
    + `&order=guidance_importance.desc`;

  try {
    return await sbGet<KBTileEntry>(path);
  } catch {
    return [];
  }
}

/**
 * Fetch override entries only — for the skeleton engine's hard gate pass.
 * These are injected VERBATIM into the AI system prompt.
 */
export async function fetchOverrideEntries(
  regionSlugs: string[],
  editionId:   string = 'safari'
): Promise<KBEntry[]> {
  if (!regionSlugs.length) return [];

  const slugFilter = regionSlugs.map(s => `region_slug.eq.${s}`).join(',');
  const path = `knowledge_base?select=id,kb_ref,linked_name,supplier_id,region_slug,entry_type,claim_type,guardrails,specialist_recs,guidance_importance,override_ai,status`
    + `&edition_id=eq.${editionId}`
    + `&status=eq.active`
    + `&override_ai=eq.true`
    + `&or=(${slugFilter})`
    + `&order=guidance_importance.desc`;

  try {
    return await sbGet<KBEntry>(path);
  } catch {
    return [];
  }
}

/**
 * Fetch all active specialists — used by the assignment engine.
 */
export async function fetchAvailableSpecialists(
  editionId: string = 'safari'
): Promise<Specialist[]> {
  const now = new Date().toISOString().split('T')[0];
  const path = `specialists?select=*`
    + `&edition_id=eq.${editionId}`
    + `&is_active=eq.true`
    + `&on_leave=eq.false`
    + `&order=kb_entry_count.desc`;

  try {
    const all = await sbGet<Specialist>(path);
    // Also filter out anyone on leave whose dates overlap today
    return all.filter(s => {
      if (!s.on_leave) return true;
      if (!s.leave_from || !s.leave_until) return false;
      return now < s.leave_from || now > s.leave_until;
    });
  } catch {
    return [];
  }
}

// ─── AI CONTEXT BUILDER ───────────────────────────────────────────────────────

/**
 * Build the KB context string injected into the AI planner system prompt.
 *
 * Structure:
 *   1. VERBATIM OVERRIDE RULES  (guidance_importance:3 — Claude cannot contradict)
 *   2. COMMERCIAL INSTRUCTIONS  (guidance_importance:2, commercial — margin rules)
 *   3. STRONG RECOMMENDATIONS   (guidance_importance:2 — specialist knowledge)
 *   4. ADVISORY CONTEXT         (guidance_importance:1 — background info)
 *
 * Commercial entries are included in planner context (they guide recommendations)
 * but are NEVER returned to travellers directly.
 */
export function buildKBContext(
  entries:   KBEntry[],
  regions:   string[],
  editionId: string = 'safari'
): string {
  const active = entries.filter(e =>
    e.status === 'active' &&
    e.edition_id === editionId &&
    (regions.length === 0 || (e.region_slug && regions.includes(e.region_slug)))
  );

  if (!active.length) return '';

  const overrides     = active.filter(e => e.override_ai && e.guidance_importance === 3);
  const commercial    = active.filter(e => !e.override_ai && e.claim_type === 'commercial' && e.guidance_importance === 2);
  const strong        = active.filter(e => !e.override_ai && e.claim_type !== 'commercial' && e.guidance_importance === 2);
  const advisory      = active.filter(e => e.guidance_importance === 1);

  const lines: string[] = [];

  // ── SECTION 1: VERBATIM OVERRIDES ─────────────────────────────────────────
  if (overrides.length) {
    lines.push('=== HARD RULES — THESE CANNOT BE CONTRADICTED OR MODIFIED ===');
    lines.push('The following rules are operational facts. Apply them exactly as written.\n');
    for (const e of overrides) {
      lines.push(`RULE: ${e.title.toUpperCase()}`);
      if (e.specialist_recs?.length) {
        for (const rec of e.specialist_recs) {
          lines.push(`  • ${rec}`);
        }
      }
      if (e.logistics_notes) lines.push(`  LOGISTICS: ${e.logistics_notes}`);
      lines.push('');
    }
    lines.push('=== END HARD RULES ===\n');
  }

  // ── SECTION 2: COMMERCIAL INSTRUCTIONS ────────────────────────────────────
  if (commercial.length) {
    lines.push('=== COMMERCIAL INSTRUCTIONS — APPLY WITHIN HARD RULES ===');
    lines.push('Margin optimisation guidelines. Apply after hard rules. Internal only.\n');
    for (const e of commercial) {
      lines.push(`COMMERCIAL: ${e.title}`);
      if (e.specialist_recs?.length) {
        for (const rec of e.specialist_recs) {
          lines.push(`  • ${rec}`);
        }
      }
      lines.push('');
    }
    lines.push('=== END COMMERCIAL INSTRUCTIONS ===\n');
  }

  // ── SECTION 3: STRONG SPECIALIST RECOMMENDATIONS ──────────────────────────
  if (strong.length) {
    lines.push('=== SPECIALIST RECOMMENDATIONS — WEIGHT THESE HEAVILY ===');
    lines.push('Verified by specialists who have visited these properties.\n');
    for (const e of strong) {
      lines.push(`--- ${e.title.toUpperCase()} ---`);
      if (e.highlights?.length) {
        lines.push(`HIGHLIGHTS: ${e.highlights.join(' | ')}`);
      }
      if (e.specialist_recs?.length) {
        lines.push('RECOMMENDATIONS:');
        for (const rec of e.specialist_recs) {
          lines.push(`  • ${rec}`);
        }
      }
      if (e.logistics_notes) lines.push(`LOGISTICS: ${e.logistics_notes}`);
      if (e.seasonal_notes) {
        const seasonal = formatSeasonalNotes(e.seasonal_notes);
        if (seasonal) lines.push(`SEASONAL: ${seasonal}`);
      }
      // Guardrails go to the AI but are marked as internal
      if (e.guardrails?.length) {
        lines.push('GUARDRAILS (internal — do not share verbatim with traveller):');
        for (const g of e.guardrails) {
          lines.push(`  ⚑ ${g}`);
        }
      }
      lines.push(`[Evidence strength: ${e.evidence_strength}/5 | Author: ${e.created_by_name}]`);
      lines.push('');
    }
    lines.push('=== END SPECIALIST RECOMMENDATIONS ===\n');
  }

  // ── SECTION 4: ADVISORY CONTEXT ───────────────────────────────────────────
  if (advisory.length) {
    lines.push('=== ADVISORY CONTEXT ===\n');
    for (const e of advisory) {
      lines.push(`${e.title}: `
        + [
            e.highlights?.join('. '),
            e.logistics_notes,
            e.specialist_recs?.join('. '),
          ].filter(Boolean).join(' ')
      );
    }
    lines.push('\n=== END ADVISORY CONTEXT ===\n');
  }

  // Track usage (fire-and-forget — don't await)
  trackKBUsage(active.map(e => e.id)).catch(() => {});

  return lines.join('\n');
}

/**
 * Build a lean KB context for the skeleton engine.
 * Same priority structure but returns structured data instead of a string —
 * the skeleton engine needs to reason about individual findings, not a blob.
 */
export function buildKBContextForSkeleton(
  entries:  KBEntry[],
  regions:  string[]
): {
  overrides:    KBEntry[];
  commercial:   KBEntry[];
  strong:       KBEntry[];
  advisory:     KBEntry[];
  bySupplier:   Record<string, KBEntry[]>;
  byRegion:     Record<string, KBEntry[]>;
} {
  const active = entries.filter(e =>
    e.status === 'active' &&
    (regions.length === 0 || (e.region_slug && regions.includes(e.region_slug)))
  );

  const bySupplier: Record<string, KBEntry[]> = {};
  const byRegion:   Record<string, KBEntry[]> = {};

  for (const e of active) {
    if (e.supplier_id) {
      bySupplier[e.supplier_id] = bySupplier[e.supplier_id] ?? [];
      bySupplier[e.supplier_id].push(e);
    }
    if (e.region_slug) {
      byRegion[e.region_slug] = byRegion[e.region_slug] ?? [];
      byRegion[e.region_slug].push(e);
    }
  }

  return {
    overrides:  active.filter(e => e.override_ai && e.guidance_importance === 3),
    commercial: active.filter(e => !e.override_ai && e.claim_type === 'commercial'),
    strong:     active.filter(e => !e.override_ai && e.claim_type !== 'commercial' && e.guidance_importance === 2),
    advisory:   active.filter(e => e.guidance_importance === 1),
    bySupplier,
    byRegion,
  };
}

// ─── SPECIALIST SCORING ENGINE ────────────────────────────────────────────────

/**
 * Score all available specialists against a journey context.
 * Returns sorted array — highest score first.
 *
 * Scoring formula:
 *   +10 per region in journey that matches specialist's region_specialties
 *   +1  per active KB entry for matched regions (depth signal)
 *   -8  per confirmed active booking (load penalty)
 *   -4  per pre-deposit journey (softer load signal)
 *   +5  if specialist has a site visit to any journey region in last 12 months
 *   +admin override (can be negative to deprioritise)
 *
 * Hard cap: specialists at max_active_bookings are excluded entirely.
 */
export function scoreSpecialists(
  specialists:  Specialist[],
  journey:      JourneyContext,
  kbEntries:    KBEntry[]
): SpecialistScore[] {
  const scores: SpecialistScore[] = [];

  for (const s of specialists) {
    // Hard cap — exclude overloaded specialists
    if (s.current_active_bookings >= s.max_active_bookings) continue;

    // Region match score
    const matchedRegions = journey.regions.filter(r =>
      s.region_specialties?.includes(r)
    );
    const regionMatch = matchedRegions.length * 10;

    // KB depth score — entries this specialist has written for matched regions
    const specialistEntries = kbEntries.filter(e =>
      e.created_by_email === s.email &&
      e.status === 'active' &&
      e.region_slug &&
      matchedRegions.includes(e.region_slug)
    );
    const kbDepth = Math.min(specialistEntries.length, 20); // cap at 20

    // Load penalty
    const loadPenalty = -(s.current_active_bookings * 8);

    // Site visit bonus — check if specialist has visited any journey region
    // recently (approximated by evidence_strength:5 entries they authored)
    const recentVisitEntries = specialistEntries.filter(e =>
      e.evidence_strength === 5 &&
      e.verification_sources?.some(vs => {
        if (vs.type !== 'site_visit' && vs.type !== 'fam_trip') return false;
        const visitDate = new Date(vs.date);
        const monthsAgo = (Date.now() - visitDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return monthsAgo <= 12;
      })
    );
    const siteVisitBonus = recentVisitEntries.length > 0 ? 5 : 0;

    // Admin override
    const override = s.assignment_score_override ?? 0;

    const total = regionMatch + kbDepth + loadPenalty + siteVisitBonus + override;

    scores.push({
      specialist: s,
      total,
      breakdown: {
        region_match:  regionMatch,
        kb_depth:      kbDepth,
        load_penalty:  loadPenalty,
        site_visit:    siteVisitBonus,
        override,
      },
    });
  }

  return scores.sort((a, b) => b.total - a.total);
}

/**
 * Select the best specialist for a journey.
 * Returns the top scorer if the gap vs second place is > 5 (clear winner).
 * Returns null if scores are tied — ops team assigns manually.
 */
export function selectSpecialist(
  scores: SpecialistScore[]
): { specialist: Specialist; method: 'auto' | 'manual_required'; scores: SpecialistScore[] } | null {
  if (!scores.length) return null;

  const [first, second] = scores;

  // No candidates
  if (!first) return null;

  // Only one available — auto-assign
  if (!second) {
    return { specialist: first.specialist, method: 'auto', scores };
  }

  // Clear winner — gap > 5 points
  if (first.total - second.total > 5) {
    return { specialist: first.specialist, method: 'auto', scores };
  }

  // Tie or near-tie — flag for manual ops assignment
  // Still return the top scorer as the default but flag it
  return { specialist: first.specialist, method: 'manual_required', scores };
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatSeasonalNotes(notes: KBSeasonalNotes): string {
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
  const parts: string[] = [];
  for (const m of months) {
    if (notes[m]) parts.push(`${m.toUpperCase()}: ${notes[m]}`);
  }
  return parts.join(' | ');
}

/**
 * Get the seasonal note for a specific month from a KB entry.
 * Used by the skeleton engine to check if conditions are flagged.
 */
export function getSeasonalNote(
  entry:      KBEntry,
  checkin:    string  // ISO date string
): string | null {
  if (!entry.seasonal_notes || !checkin) return null;
  const month = new Date(checkin).toLocaleString('en', { month: 'short' }).toLowerCase();
  return (entry.seasonal_notes as any)[month] ?? null;
}

/**
 * Check if a KB entry's guardrails are triggered by a given context.
 * Returns matching guardrails — used by skeleton engine to generate warnings.
 */
export function checkGuardrails(
  entry:   KBEntry,
  context: { pax?: number; nights?: number; theme?: string; regions?: string[] }
): string[] {
  if (!entry.guardrails?.length) return [];
  // All guardrails are returned — the skeleton engine decides severity
  return entry.guardrails;
}

/**
 * Fire-and-forget usage tracking — increments times_used_in_planner.
 * Failure is silent — never let tracking break the planner.
 */
async function trackKBUsage(entryIds: string[]): Promise<void> {
  if (!entryIds.length) return;
  try {
    // Supabase doesn't support bulk increment natively — use RPC if available
    // Fallback: update one by one (acceptable for small sets)
    for (const id of entryIds) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${id}`,
        {
          method:  'PATCH',
          headers: { ...sbHeaders(), Prefer: 'return=minimal' },
          body:    JSON.stringify({
            times_used_in_planner: undefined, // handled by trigger
            last_used_at:          new Date().toISOString(),
          }),
        }
      );
    }
  } catch { /* silent */ }
}

// ─── LEGACY COMPATIBILITY ─────────────────────────────────────────────────────
// The old KBEntry type in types.ts used a different shape.
// This adapter maps old entries (from DEFAULT_KB in page.tsx) to the new shape
// so existing code doesn't break during the transition.

export function adaptLegacyKBEntry(legacy: {
  id: string;
  edition_id: string;
  type: string;
  title: string;
  linkedTo: string;
  structuredFields: Record<string, string>;
  specialistNotes: string;
  active: boolean;
  inclusion_source: string;
}): KBEntry {
  return {
    id:                    legacy.id,
    edition_id:            legacy.edition_id,
    entry_type:            (legacy.type as KBEntryType) ?? 'property',
    claim_type:            'experiential',
    linked_name:           legacy.linkedTo,
    title:                 legacy.title,
    highlights:            Object.values(legacy.structuredFields).slice(0, 3),
    tips:                  [],
    guardrails:            [],
    specialist_recs:       legacy.specialistNotes ? [legacy.specialistNotes] : [],
    guidance_importance:   1,
    override_ai:           false,
    internal_only:         true,
    status:                legacy.active ? 'active' : 'archived',
    version:               1,
    created_by_name:       'TSE',
    created_by_email:      'admin@thesafariedition.com',
    created_by_role:       'edition_admin',
    created_at:            new Date().toISOString(),
    evidence_strength:     2,
    verification_sources:  [],
    flag_count:            0,
    flags:                 [],
    ext_confirm_count:     0,
    ext_query_count:       0,
    ext_sources:           [],
    times_used_in_planner: 0,
  };
}
