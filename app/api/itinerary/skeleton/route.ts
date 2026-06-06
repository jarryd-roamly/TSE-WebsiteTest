import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@supabase/supabase-js';
import {
  fetchKBForRegions,
  buildKBContextForSkeleton,
  getSeasonalNote,
  type KBEntry,
} from '@/app/lib/kb';
import {
  checkRules,
  cityToSlug,
  MALARIA_REGIONS,
  type RuleViolation,
} from '@/app/lib/rules';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/itinerary/skeleton
//
// Runs immediately after build-itinerary completes (~parallel with BCC render).
// Produces the internal audit document that powers:
//   - BCC contextual tip panel (proactive guidance as traveller scrolls)
//   - Selection Load page (smart commentary cards before payment)
//   - Specialist brief email (internal — confidence score + flagged items)
//   - Admin skeleton view (full audit trail)
//
// NEVER returns confidence_score to the client — internal only.
// NEVER returns guardrails or commercial KB content to the client.
//
// Priority: KB overrides → rules engine → seasonal checks → KB cross-check
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

// ── Minimum connection times (minutes) at key airports ───────────────────────
const MIN_CONNECTION_MINUTES: Record<string, { intl_to_dom: number; dom_to_dom: number; intl_out: number }> = {
  JNB: { intl_to_dom: 180, dom_to_dom: 120, intl_out: 120 },
  CPT: { intl_to_dom: 90,  dom_to_dom: 60,  intl_out: 90  },
  MUB: { intl_to_dom: 60,  dom_to_dom: 45,  intl_out: 60  },
  VFA: { intl_to_dom: 45,  dom_to_dom: 30,  intl_out: 60  },
};

// ── Transfer chain rules ──────────────────────────────────────────────────────
const CHARTER_REGIONS = new Set(['okavango-delta', 'masai-mara', 'bwindi']);
const BORDER_CROSSING_PAIRS: [string, string][] = [
  ['kruger-sabi-sand', 'chobe-vic-falls'],
  ['okavango-delta',   'chobe-vic-falls'],
  ['madikwe',          'okavango-delta'],
];

// Optimal vs suboptimal day transfers between regions
const TRANSFER_PAIRS: Record<string, {
  optimal_hrs: number;
  notes:        string;
  traveller_msg: string;
}> = {
  'kruger-sabi-sand→okavango-delta': {
    optimal_hrs:   4,
    notes:         'SZK→JNB Federal Air + JNB→MUB commercial. Minimum full travel day.',
    traveller_msg: 'The transfer from Sabi Sand to the Okavango is a travel day — fly to Johannesburg, then connect to Maun. We sequence this so you arrive in time for your evening activity.',
  },
  'okavango-delta→chobe-vic-falls': {
    optimal_hrs:   3,
    notes:         'MUB→BBK or MUB→VFA. Charter or scheduled. Full morning.',
    traveller_msg: 'Maun to Victoria Falls is a short regional flight — typically under two hours. We allow a full morning so there\'s no rushing.',
  },
  'kruger-sabi-sand→cape-town': {
    optimal_hrs:   4,
    notes:         'SZK→JNB Federal Air + JNB→CPT Airlink. Allow full morning departure.',
    traveller_msg: 'Sabi Sand to Cape Town takes most of a morning via Johannesburg — you\'ll be in Cape Town by early afternoon with the full evening ahead.',
  },
  'madikwe→cape-town': {
    optimal_hrs:   5,
    notes:         'Road to JNB (3.5hr) or charter to WAN, then JNB→CPT flight.',
    traveller_msg: 'Madikwe to Cape Town routes through Johannesburg — allow most of the day. We arrange early departure so you arrive in time for a Cape Town dinner.',
  },
  'cape-town→kruger-sabi-sand': {
    optimal_hrs:   4,
    notes:         'CPT→JNB + JNB→SZK Federal Air. Afternoon arrival at lodge.',
    traveller_msg: 'Cape Town to Sabi Sand connects through Johannesburg. Morning departure means you arrive at the lodge in time for your first game drive.',
  },
};

// ── Finding types ─────────────────────────────────────────────────────────────
type FindingSeverity = 'block' | 'warning' | 'recommendation' | 'confirmed';
type FindingCategory = 'logistics' | 'seasonal' | 'kb_check' | 'reasonability' | 'health' | 'pacing';

interface SkeletonFinding {
  id:                          string;
  category:                    FindingCategory;
  severity:                    FindingSeverity;
  title:                       string;
  internal_detail:             string;
  traveller_message:           string;
  specialist_action?:          string;
  requires_specialist_followup: boolean;
  kb_entry_id?:                string;
  resolved:                    boolean;
  traveller_flagged:           boolean;
}

// ── Unique ID generator ───────────────────────────────────────────────────────
function findingId(prefix: string, suffix: string): string {
  return `${prefix}-${suffix}-${Date.now().toString(36)}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      journey_id,
      assignment_id,
      itinerary,
      cityStays      = [],
      checkinDate,
      adults         = 2,
      children       = 0,
      infants        = 0,
      nights         = 7,
      budget         = 0,
      flightIntent   = 'flexible',
      selectedFlight = null,
      editionId      = 'safari',
      theme,
      occasion,
    } = body;

    if (!itinerary?.cities?.length) {
      return NextResponse.json({ success: false, error: 'itinerary.cities required' }, { status: 400 });
    }

    const cities     = itinerary.cities;
    const regionSlugs = cities.map((c: any) => cityToSlug(c.city)).filter(Boolean);
    const findings:  SkeletonFinding[] = [];
    const startMs    = Date.now();

    // ── 1. Fetch KB entries for all regions ───────────────────────────────────
    const kbEntries = await fetchKBForRegions(regionSlugs, editionId);
    const kb        = buildKBContextForSkeleton(kbEntries, regionSlugs);

    // ── 2. Run deterministic rules engine first ───────────────────────────────
    const ruleViolations = checkRules({
      nights,
      budget,
      adults,
      children,
      infants,
      regions: regionSlugs,
      flightIntent,
      cities:  cities.map((c: any) => ({
        city:    c.city,
        nights:  c.nights,
        country: c.country,
      })),
      checkinDate,
    });

    for (const v of ruleViolations) {
      findings.push({
        id:                          findingId('rule', v.rule),
        category:                    'reasonability',
        severity:                    v.severity === 'hard' ? 'block' : 'warning',
        title:                       ruleViolationTitle(v),
        internal_detail:             v.message + (v.autoFix ? ` Auto-fix: ${v.autoFix}` : ''),
        traveller_message:           travellerfriendlyRule(v),
        specialist_action:           v.autoFix,
        requires_specialist_followup: v.severity === 'hard',
        resolved:                    false,
        traveller_flagged:           false,
      });
    }

    // ── 3. KB override checks ─────────────────────────────────────────────────
    // Any override entry that applies to this itinerary becomes a finding
    for (const override of kb.overrides) {
      // Malaria override entries → already caught by rules, skip duplicates
      if (override.entry_type === 'health' && findings.some(f => f.category === 'health')) continue;

      // Logistics overrides (bag limits, routing rules, etc.)
      if (override.entry_type === 'logistics' || override.entry_type === 'airport') {
        for (const rec of override.specialist_recs ?? []) {
          findings.push({
            id:                          findingId('kb-override', override.id.slice(0, 8)),
            category:                    'logistics',
            severity:                    'warning',
            title:                       override.title,
            internal_detail:             rec,
            traveller_message:           kbOverrideToTravellerMsg(override, rec),
            specialist_action:           `Confirm ${override.linked_name} rule with traveller at first contact`,
            requires_specialist_followup: false,
            kb_entry_id:                 override.id,
            resolved:                    false,
            traveller_flagged:           false,
          });
        }
      }
    }

    // ── 4. Transfer chain analysis ────────────────────────────────────────────
    for (let i = 0; i < cities.length - 1; i++) {
      const from     = cityToSlug(cities[i].city);
      const to       = cityToSlug(cities[i + 1].city);
      const legKey   = `${from}→${to}`;
      const revKey   = `${to}→${from}`;
      const transfer = TRANSFER_PAIRS[legKey] ?? TRANSFER_PAIRS[revKey];

      if (transfer) {
        findings.push({
          id:                          findingId('transfer', `${i}`),
          category:                    'logistics',
          severity:                    'confirmed',
          title:                       `${cities[i].city} → ${cities[i + 1].city} transfer`,
          internal_detail:             transfer.notes,
          traveller_message:           transfer.traveller_msg,
          specialist_action:           `Confirm charter/flight timing with ${cities[i + 1].city} lodge on booking`,
          requires_specialist_followup: true,
          resolved:                    false,
          traveller_flagged:           false,
        });
      }

      // Check for road border crossings
      const hasBorderCrossing = BORDER_CROSSING_PAIRS.some(
        ([a, b]) => (a === from && b === to) || (a === to && b === from)
      );
      if (hasBorderCrossing) {
        findings.push({
          id:                          findingId('border', `${i}`),
          category:                    'logistics',
          severity:                    'warning',
          title:                       `Border crossing — ${cities[i].city} to ${cities[i + 1].city}`,
          internal_detail:             `Road border crossing detected on leg ${from}→${to}. Check current wait times and visa requirements.`,
          traveller_message:           `The transfer between ${cities[i].city} and ${cities[i + 1].city} crosses an international border. We recommend the flight option — it avoids the crossing entirely and is faster. Your specialist will confirm the best routing.`,
          specialist_action:           'Confirm flight routing to avoid road border — always preferred for guest experience',
          requires_specialist_followup: true,
          resolved:                    false,
          traveller_flagged:           false,
        });
      }

      // Charter-only regions
      if (CHARTER_REGIONS.has(to)) {
        findings.push({
          id:                          findingId('charter', to),
          category:                    'logistics',
          severity:                    'confirmed',
          title:                       `Light aircraft transfer into ${cities[i + 1].city}`,
          internal_detail:             `${to} is charter-only. 20kg soft bag limit enforced. All transfers via Wilderness Air or Mack Air from Maun.`,
          traveller_message:           `Getting into ${cities[i + 1].city} is part of the experience — a light aircraft flight over the wilderness. There\'s a 20kg soft-bag limit per person on these flights, which we\'ll brief you on when confirming your booking.`,
          specialist_action:           'Brief 20kg soft bag limit at first contact — before packing questions arise',
          requires_specialist_followup: false,
          resolved:                    false,
          traveller_flagged:           false,
        });
      }
    }

    // ── 5. Flight connection check ─────────────────────────────────────────────
    if (selectedFlight && checkinDate) {
      const arrivalAirport = selectedFlight.arrival_gateway ?? 'JNB';
      const connections    = MIN_CONNECTION_MINUTES[arrivalAirport];

      if (connections) {
        // We have a flight — check if the connection is comfortable
        const landingHour = selectedFlight.landing_hour ?? 10;
        const nextFlightHour = 15; // Federal Air typical mid-afternoon departure
        const connectionMins = (nextFlightHour - landingHour) * 60;

        if (connectionMins >= connections.intl_to_dom) {
          findings.push({
            id:                          findingId('connection', arrivalAirport),
            category:                    'logistics',
            severity:                    'confirmed',
            title:                       `${arrivalAirport} connection — comfortable`,
            internal_detail:             `${connectionMins} min connection vs ${connections.intl_to_dom} min minimum. Clear.`,
            traveller_message:           connectionComfortMessage(arrivalAirport, landingHour, connectionMins, connections.intl_to_dom),
            requires_specialist_followup: false,
            resolved:                    false,
            traveller_flagged:           false,
          });
        } else {
          findings.push({
            id:                          findingId('connection-tight', arrivalAirport),
            category:                    'logistics',
            severity:                    'block',
            title:                       `${arrivalAirport} connection — too tight`,
            internal_detail:             `Only ${connectionMins} min available vs ${connections.intl_to_dom} min minimum required.`,
            traveller_message:           `Your international flight lands at ${formatHour(landingHour)} and the onward connection departs soon after — there isn\'t enough time for customs and the domestic terminal. We\'d recommend the next available departure, which your specialist will confirm.`,
            specialist_action:           `Rebook onto later domestic departure — current connection is ${connectionMins}min, minimum required is ${connections.intl_to_dom}min`,
            requires_specialist_followup: true,
            resolved:                    false,
            traveller_flagged:           false,
          });
        }
      }
    } else if (flightIntent === 'flexible' || flightIntent === 'own') {
      // No flight selected — flag for specialist to confirm
      findings.push({
        id:                          findingId('flight', 'pending'),
        category:                    'logistics',
        severity:                    'recommendation',
        title:                       'International flight connection — to be confirmed',
        internal_detail:             `No flight selected. ${flightIntent === 'own' ? 'Guest has own flights.' : 'Specialist to source.'} Confirm arrival airport and time to validate transfer chain.`,
        traveller_message:           flightIntent === 'own'
          ? 'Once you\'ve shared your arrival flight details, we\'ll confirm all ground connections and transfers around your schedule.'
          : 'Your specialist will source international flight options once your dates are confirmed. All connections and ground transfers will be planned around your flights.',
        specialist_action:           'Confirm arrival airport and time — validate transfer chain timing before sending final itinerary',
        requires_specialist_followup: true,
        resolved:                    false,
        traveller_flagged:           false,
      });
    }

    // ── 6. Seasonal checks from KB ────────────────────────────────────────────
    if (checkinDate) {
      for (const regionSlug of regionSlugs) {
        const regionEntries = (kb.byRegion[regionSlug] ?? [])
          .filter(e => e.entry_type === 'region' && e.seasonal_notes);

        for (const entry of regionEntries) {
          const note = getSeasonalNote(entry, checkinDate);
          if (!note) continue;

          const isPositive = !note.toLowerCase().includes('avoid') &&
                             !note.toLowerCase().includes('poor') &&
                             !note.toLowerCase().includes('difficult') &&
                             !note.toLowerCase().includes('drop');

          findings.push({
            id:                          findingId('seasonal', regionSlug),
            category:                    'seasonal',
            severity:                    isPositive ? 'confirmed' : 'warning',
            title:                       `${cities.find((c: any) => cityToSlug(c.city) === regionSlug)?.city ?? regionSlug} — ${monthName(checkinDate)} conditions`,
            internal_detail:             `KB seasonal note (${entry.linked_name}): ${note}`,
            traveller_message:           seasonalTravellerMsg(regionSlug, note, cities, checkinDate, isPositive),
            specialist_action:           isPositive ? undefined : `Verify current conditions with camp — ${note}`,
            requires_specialist_followup: !isPositive,
            kb_entry_id:                 entry.id,
            resolved:                    false,
            traveller_flagged:           false,
          });
          break; // One seasonal note per region
        }
      }
    }

    // ── 7. KB property cross-check ────────────────────────────────────────────
    // Check if KB has specific notes for selected properties
    for (let i = 0; i < cityStays.length; i++) {
      const stay       = cityStays[i];
      const city       = cities[i];
      if (!stay?.hotelId || !city) continue;

      const supplierKB = kb.bySupplier[String(stay.hotelId)] ?? [];
      const propEntry  = supplierKB.find(e =>
        e.entry_type === 'property' &&
        e.claim_type !== 'commercial' &&
        e.status === 'active'
      );

      if (propEntry) {
        // Surface the top tip as a recommendation on the Selection Load page
        const topTip = propEntry.tips?.[0] ?? propEntry.highlights?.[0];
        if (topTip) {
          findings.push({
            id:                          findingId('kb-prop', stay.hotelId.toString().slice(0, 8)),
            category:                    'kb_check',
            severity:                    'recommendation',
            title:                       `${city.city} — specialist note`,
            internal_detail:             `KB entry: ${propEntry.title}. Top tip: ${topTip}`,
            traveller_message:           `A small note on ${city.city}: ${topTip.charAt(0).toLowerCase() + topTip.slice(1)}`,
            requires_specialist_followup: false,
            kb_entry_id:                 propEntry.id,
            resolved:                    false,
            traveller_flagged:           false,
          });
        }
      }
    }

    // ── 8. Health advisories from KB ──────────────────────────────────────────
    const healthEntries = kbEntries.filter(e =>
      e.entry_type === 'health' && e.status === 'active'
    );

    const malariaRegionsInJourney = regionSlugs.filter(s => MALARIA_REGIONS.has(s));
    if (malariaRegionsInJourney.length > 0 && infants === 0) {
      // Malaria advisory (non-blocking for adults — informational)
      const malariaKB = healthEntries.find(e => e.region_slug && malariaRegionsInJourney.includes(e.region_slug));
      findings.push({
        id:                          findingId('health', 'malaria'),
        category:                    'health',
        severity:                    'warning',
        title:                       'Malaria zones on this itinerary',
        internal_detail:             `Malaria regions: ${malariaRegionsInJourney.join(', ')}. Prophylaxis required. ${malariaKB?.logistics_notes ?? ''}`,
        traveller_message:           `${malariaRegionsInJourney.map(s => regionLabel(s)).join(' and ')} ${malariaRegionsInJourney.length > 1 ? 'are' : 'is a'} malaria ${malariaRegionsInJourney.length > 1 ? 'areas' : 'area'}. We recommend consulting your GP about prophylactics at least six weeks before departure. We\'re happy to send you a destination health brief after booking.`,
        specialist_action:           'Send health brief on booking confirmation — include GP consultation timing',
        requires_specialist_followup: true,
        kb_entry_id:                 malariaKB?.id,
        resolved:                    false,
        traveller_flagged:           false,
      });
    }

    // ── 9. Pacing analysis ────────────────────────────────────────────────────
    for (const city of cities) {
      // Rushed city warning (< minimum nights)
      const slug    = cityToSlug(city.city);
      const minNights = { 'kruger-sabi-sand': 3, 'okavango-delta': 3, 'cape-town': 3, 'madikwe': 2, 'chobe-vic-falls': 2 }[slug] ?? 2;

      if (city.nights >= minNights) {
        findings.push({
          id:                          findingId('pacing', slug),
          category:                    'pacing',
          severity:                    'confirmed',
          title:                       `${city.city} — ${city.nights} nights`,
          internal_detail:             `${city.nights}n meets minimum ${minNights}n requirement.`,
          traveller_message:           pacingConfirmMsg(city, slug),
          requires_specialist_followup: false,
          resolved:                    false,
          traveller_flagged:           false,
        });
      }
    }

    // ── 10. Budget sanity check ───────────────────────────────────────────────
    const totalDisplay = itinerary.totalEstimate ?? 0;
    if (budget > 0 && totalDisplay > 0) {
      const headroom     = budget - totalDisplay;
      const headroomPct  = Math.round((headroom / budget) * 100);

      if (headroom > 0 && headroomPct > 15) {
        findings.push({
          id:                          findingId('budget', 'headroom'),
          category:                    'reasonability',
          severity:                    'recommendation',
          title:                       'Budget headroom available',
          internal_detail:             `Package R${totalDisplay.toLocaleString()} vs budget R${budget.toLocaleString()}. Headroom: R${headroom.toLocaleString()} (${headroomPct}%). Consider upgrade or extension.`,
          traveller_message:           `Your package comes in at R${Math.round(totalDisplay).toLocaleString()} — within your budget with some room to spare. Your specialist can suggest whether a room upgrade or an extra night would be the best use of the remaining budget.`,
          specialist_action:           `R${Math.round(headroom).toLocaleString()} headroom — offer room upgrade or night extension at first contact`,
          requires_specialist_followup: true,
          resolved:                    false,
          traveller_flagged:           false,
        });
      }

      if (totalDisplay > budget) {
        findings.push({
          id:                          findingId('budget', 'over'),
          category:                    'reasonability',
          severity:                    'warning',
          title:                       'Package exceeds stated budget',
          internal_detail:             `Package R${totalDisplay.toLocaleString()} exceeds budget R${budget.toLocaleString()} by R${(totalDisplay - budget).toLocaleString()}.`,
          traveller_message:           `The selected itinerary comes to R${Math.round(totalDisplay).toLocaleString()}, which is slightly over your stated budget. Your specialist can suggest adjustments — swapping a lodge tier or adjusting night counts — to bring it within range without compromising the experience.`,
          specialist_action:           'Offer lodge tier adjustment or night reduction to bring within budget',
          requires_specialist_followup: true,
          resolved:                    false,
          traveller_flagged:           false,
        });
      }
    }

    // ── 11. Calculate confidence score (INTERNAL — never sent to client) ──────
    const blocks          = findings.filter(f => f.severity === 'block').length;
    const warnings        = findings.filter(f => f.severity === 'warning').length;
    const recommendations = findings.filter(f => f.severity === 'recommendation').length;
    const confirmed       = findings.filter(f => f.severity === 'confirmed').length;

    const confidenceScore = Math.max(0, Math.min(100,
      100 - (blocks * 40) - (warnings * 10) - (recommendations * 3)
    ));

    // ── 12. Generate specialist brief via AI ──────────────────────────────────
    const specialistBriefHtml = await generateSpecialistBrief({
      itinerary,
      cityStays,
      findings,
      confidenceScore,
      adults, children, infants,
      budget, nights, checkinDate,
      theme, occasion,
      kbMatchedCount: kbEntries.length,
    });

    // ── 13. Persist skeleton to Supabase ──────────────────────────────────────
    let skeletonId: string | null = null;

    try {
      const supabase   = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: saved } = await supabase
        .from('itinerary_skeletons')
        .insert({
          edition_id:           editionId,
          journey_id:           journey_id ?? null,
          assignment_id:        assignment_id ?? null,
          confidence_score:     confidenceScore,  // INTERNAL
          block_count:          blocks,
          warning_count:        warnings,
          recommendation_count: recommendations,
          confirmed_count:      confirmed,
          findings:             findings,
          traveller_flagged_ids: [],
          specialist_brief_html: specialistBriefHtml,
          kb_entries_matched:   kbEntries.map(e => e.id),
          generated_at:         new Date().toISOString(),
          generation_model:     'claude-haiku-4-5-20251001',
          generation_ms:        Date.now() - startMs,
        })
        .select('id')
        .single();

      skeletonId = saved?.id ?? null;
    } catch (e) {
      console.error('[skeleton persist]', e);
      // Non-fatal — skeleton still returned to client
    }

    // ── 14. Build client-safe response ────────────────────────────────────────
    // Strip internal fields before sending to browser.
    // confidence_score, internal_detail, guardrails NEVER leave the server.
    const clientFindings = findings.map(f => ({
      id:                          f.id,
      category:                    f.category,
      severity:                    f.severity,
      title:                       f.title,
      traveller_message:           f.traveller_message,
      requires_specialist_followup: f.requires_specialist_followup,
      kb_entry_id:                 f.kb_entry_id ?? null,
      resolved:                    f.resolved,
      traveller_flagged:           f.traveller_flagged,
    }));

    return NextResponse.json({
      success:              true,
      skeleton_id:          skeletonId,
      findings:             clientFindings,
      // Summary counts visible to client (not the score itself)
      summary: {
        blocks,
        warnings,
        recommendations,
        confirmed,
        items_for_specialist: findings.filter(f => f.requires_specialist_followup).length,
      },
      generation_ms: Date.now() - startMs,
    });

  } catch (e: any) {
    console.error('[skeleton]', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'Skeleton build failed' }, { status: 500 });
  }
}

// ── PATCH — traveller flags a finding ("Note for my specialist") ──────────────
export async function PATCH(req: NextRequest) {
  try {
    const { skeleton_id, finding_id } = await req.json();

    if (!skeleton_id || !finding_id) {
      return NextResponse.json({ success: false, error: 'skeleton_id and finding_id required' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch current skeleton
    const { data: skeleton } = await supabase
      .from('itinerary_skeletons')
      .select('findings, traveller_flagged_ids')
      .eq('id', skeleton_id)
      .single();

    if (!skeleton) {
      return NextResponse.json({ success: false, error: 'Skeleton not found' }, { status: 404 });
    }

    // Update the specific finding
    const updatedFindings = (skeleton.findings as SkeletonFinding[]).map(f =>
      f.id === finding_id ? { ...f, traveller_flagged: true } : f
    );

    const flaggedIds = [
      ...(skeleton.traveller_flagged_ids ?? []),
      finding_id,
    ].filter((v, i, a) => a.indexOf(v) === i);

    await supabase
      .from('itinerary_skeletons')
      .update({
        findings:              updatedFindings,
        traveller_flagged_ids: flaggedIds,
      })
      .eq('id', skeleton_id);

    return NextResponse.json({ success: true, flagged_id: finding_id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function ruleViolationTitle(v: RuleViolation): string {
  const titles: Record<string, string> = {
    malaria_infants:  'Malaria zone — infants cannot travel here',
    budget_floor:     'Budget below minimum for quality lodges',
    nights_min:       'Trip too short',
    nights_max:       'Unusually long trip — please confirm',
    over_packed:      'Too many destinations for the nights available',
    group_size:       'Large group — camp capacity to confirm',
    one_night_intl:   'One-night stop with international flights',
  };
  return titles[v.rule] ?? v.rule.replace(/_/g, ' ');
}

function travellerfriendlyRule(v: RuleViolation): string {
  // Reframe rule violations as expert guidance, not errors
  if (v.rule === 'malaria_infants') {
    return 'Some destinations on this itinerary are malaria areas, which we\'d recommend avoiding with infants travelling. We\'ve suggested malaria-free alternatives that still offer Big Five game viewing.';
  }
  if (v.rule === 'budget_floor') {
    return v.autoFix
      ? `To reach the standard of lodges on this itinerary, we\'d suggest a budget of at least ${v.autoFix}`
      : v.message;
  }
  if (v.rule === 'over_packed') {
    return 'With the current night count, there\'s a risk of spending more time travelling than experiencing. We\'d suggest removing one destination to give the remaining ones the time they deserve.';
  }
  return v.message;
}

function kbOverrideToTravellerMsg(entry: KBEntry, rec: string): string {
  // Convert internal KB override language into traveller-friendly guidance
  if (rec.toLowerCase().includes('20kg') || rec.toLowerCase().includes('soft bag')) {
    return 'The light aircraft on this itinerary have a 20kg per person soft-bag limit — no hard-sided cases. For a multi-night trip we suggest thinking carefully about what you pack. Your specialist can arrange secure luggage storage at Johannesburg airport for anything you don\'t need in the bush.';
  }
  if (rec.toLowerCase().includes('connection') || rec.toLowerCase().includes('or tambo')) {
    return 'We\'ve allowed a comfortable connection window at Johannesburg — enough time for customs, the domestic terminal, and a proper lunch if you\'d like it.';
  }
  if (rec.toLowerCase().includes('malaria') || rec.toLowerCase().includes('prophylax')) {
    return 'This region is a malaria area. We recommend consulting your GP about prophylactics at least six weeks before departure.';
  }
  // Generic fallback — strip internal language
  return `A note on ${entry.linked_name}: your specialist will brief you on this at booking confirmation.`;
}

function connectionComfortMessage(
  airport:       string,
  landingHour:   number,
  connectionMins: number,
  minimumMins:   number,
): string {
  const hrs = Math.floor(connectionMins / 60);
  const buffer = connectionMins - minimumMins;
  const airportNames: Record<string, string> = {
    JNB: 'O.R. Tambo, Johannesburg',
    CPT: 'Cape Town International',
    MUB: 'Maun International',
    VFA: 'Victoria Falls Airport',
  };
  const name = airportNames[airport] ?? airport;
  return `Your flight lands at ${formatHour(landingHour)} at ${name}. You have ${hrs > 0 ? `${hrs} hour${hrs > 1 ? 's' : ''}` : `${connectionMins} minutes`} before the onward connection — ${buffer >= 60 ? 'more than enough time' : 'a comfortable window'} for customs and the domestic terminal${buffer >= 90 ? ', with time for lunch if you\'d like' : ''}.`;
}

function seasonalTravellerMsg(
  regionSlug:  string,
  note:        string,
  cities:      any[],
  checkinDate: string,
  isPositive:  boolean,
): string {
  const city = cities.find((c: any) => cityToSlug(c.city) === regionSlug)?.city ?? regionSlug;
  const month = monthName(checkinDate);
  if (isPositive) {
    return `${month} is an excellent time to be in ${city}. ${note}`;
  }
  return `A seasonal note on ${city} in ${month}: ${note} Your specialist will confirm current conditions with the camp and advise on any adjustments if needed.`;
}

function pacingConfirmMsg(city: any, slug: string): string {
  const msgs: Record<string, (n: number) => string> = {
    'kruger-sabi-sand': n => `${n} nights in Sabi Sand gives you time to settle in — the best sightings often come on the third or fourth morning when you know the territory.`,
    'okavango-delta':   n => `${n} nights in the Okavango allows you to experience the Delta at a proper pace — mokoro, walking, and game drives without feeling rushed.`,
    'cape-town':        n => `${n} nights in Cape Town is enough to cover the highlights — Table Mountain, the Winelands, and the waterfront — without rushing.`,
    'madikwe':          n => `${n} nights in Madikwe works well — enough time for morning and evening drives and a proper feel for the reserve.`,
    'chobe-vic-falls':  n => `${n} nights at Victoria Falls gives you time to see the Falls properly, do a Zambezi cruise, and explore at your own pace.`,
  };
  return msgs[slug]?.(city.nights) ?? `${city.nights} nights in ${city.city} — well-paced for the destination.`;
}

function regionLabel(slug: string): string {
  const labels: Record<string, string> = {
    'kruger-sabi-sand': 'Sabi Sand',
    'okavango-delta':   'the Okavango Delta',
    'chobe-vic-falls':  'Victoria Falls',
    'masai-mara':       'the Masai Mara',
    'bwindi':           'Bwindi',
    'phinda':           'Phinda',
  };
  return labels[slug] ?? slug.replace(/-/g, ' ');
}

function monthName(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en', { month: 'long' });
  } catch {
    return '';
  }
}

function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Specialist brief generator ────────────────────────────────────────────────
async function generateSpecialistBrief(params: {
  itinerary:     any;
  cityStays:     any[];
  findings:      SkeletonFinding[];
  confidenceScore: number;
  adults:        number;
  children:      number;
  infants:       number;
  budget:        number;
  nights:        number;
  checkinDate?:  string;
  theme?:        string;
  occasion?:     string;
  kbMatchedCount: number;
}): Promise<string> {
  if (!ANTHROPIC_KEY) return '';

  const {
    itinerary, findings, confidenceScore,
    adults, children, infants, budget, nights,
    checkinDate, theme, occasion, kbMatchedCount,
  } = params;

  const blocks    = findings.filter(f => f.severity === 'block');
  const warnings  = findings.filter(f => f.severity === 'warning');
  const flagged   = findings.filter(f => f.requires_specialist_followup);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system:     'You write concise internal specialist briefing notes. Plain text only. No markdown. No bullet points. Write in a warm, professional tone as if briefing a colleague.',
        messages: [{
          role:    'user',
          content: `Write a 3-4 sentence specialist brief for this safari journey.

Journey: ${itinerary.title}
Route: ${itinerary.routing}
Pax: ${adults} adults${children > 0 ? `, ${children} children` : ''}${infants > 0 ? `, ${infants} infants` : ''}
Nights: ${nights}
Budget: R${budget.toLocaleString()}
Check-in: ${checkinDate ?? 'TBC'}
Theme: ${occasion ?? theme ?? 'leisure'}
Confidence score: ${confidenceScore}/100
KB entries matched: ${kbMatchedCount}
Blocks: ${blocks.length} | Warnings: ${warnings.length}
Items needing specialist action: ${flagged.map(f => f.title).join(', ') || 'none'}

Write a brief that helps the specialist walk into this conversation ready. Include the confidence score, key items they need to address, and the tone to strike with this particular traveller.`,
        }],
      }),
    });

    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
  } catch {
    // Fallback brief if AI call fails
    return `${itinerary.title}. ${nights} nights, ${adults} adults, budget R${budget.toLocaleString()}. Confidence: ${confidenceScore}/100. ${flagged.length} items need specialist attention: ${flagged.map(f => f.title).join('; ')}.`;
  }
}
