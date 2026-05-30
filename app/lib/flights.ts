// ─── FLIGHT SERVICE LAYER ─────────────────────────────────────────────────────
// Pure functions. No React, no side effects. Fully testable.
// Extends existing types.ts and pricing.ts patterns.
// HANDOVER: All flight logic lives here. Never calculate flight costs inline.
// ─────────────────────────────────────────────────────────────────────────────

import type { ItineraryCity } from './types';

// ── Flight intent — collected at inspire-input ────────────────────────────────
export type FlightIntent =
  | 'include'       // Duffel search runs after itinerary builds
  | 'own'           // Traveller arranging independently — collect arrival details
  | 'flexible';     // No dates yet — Journey Specialist adds flights later

export type GatewayPreference =
  | 'return'        // Same airport in and out — Duffel single origin/destination
  | 'open_jaw'      // System decides best gateway combination
  | 'custom';       // Traveller specifies arrival and departure gateway

export interface FlightIntentState {
  intent:              FlightIntent;
  origin:              string;              // IATA e.g. 'LHR'
  gatewayPreference:   GatewayPreference;
  arrivalGateway:      string | null;       // e.g. 'CPT' — null = system decides
  departureGateway:    string | null;       // e.g. 'JNB' — null = system decides
  // Collected when intent = 'own'
  ownFlightDetails?: {
    arrivalAirport:  string;
    arrivalDate:     string;
    arrivalTime:     string;
    departureAirport: string;
    departureDate:   string;
    departureTime:   string;
  };
}

// ── Duffel offer — processed server-side, margin already applied ──────────────
export interface FlightOffer {
  id:                  string;
  offer_request_id:    string;
  client_key:          string;             // Passed to DuffelAncillaries component
  currency:            string;
  display_price:       number;             // Margin-inclusive — shown to traveller
  total_duration_minutes: number;
  expires_at:          string;
  is_return:           boolean;
  slices: FlightSlice[];
  passengers:          { id: string; type: string }[];
  baggage:             { quantity: number; type: string }[];
  conditions: {
    refundable:        boolean | null;
    changeable:        boolean | null;
    fare_conditions?:  string;             // Raw text — display as-is, never summarise
  };
  payment_requirements: {
    requires_instant_payment: boolean;
    price_guarantee_expires_at: string | null;
  };
  // Ancillary selections — populated by DuffelAncillaries component
  ancillaries?: {
    seats?:    AncillarySelection[];
    bags?:     AncillarySelection[];
    cancel_for_any_reason?: AncillarySelection[];
  };
  ancillary_total?: number;
}

export interface FlightSlice {
  id:                  string;
  origin:              { iata: string; name: string; city: string; terminal?: string };
  destination:         { iata: string; name: string; city: string; terminal?: string };
  departure_datetime:  string;
  arrival_datetime:    string;
  duration:            string;             // ISO 8601 e.g. PT14H30M
  duration_minutes:    number;
  stops:               number;
  segments:            FlightSegment[];
}

export interface FlightSegment {
  id:                  string;
  flight_number:       string;
  carrier_name:        string;
  carrier_iata:        string;
  carrier_logo?:       string;
  operating_carrier_name?: string;
  aircraft?:           string;
  departing_at:        string;
  arriving_at:         string;
  origin_iata:         string;
  destination_iata:    string;
  duration:            string;
}

export interface AncillarySelection {
  service_id:  string;
  passenger_id: string;
  amount:      number;
  currency:    string;
  description: string;
}

// ── Open jaw result ───────────────────────────────────────────────────────────
export interface OpenJawOption {
  arrival_gateway:      string;            // e.g. 'JNB'
  departure_gateway:    string;            // e.g. 'CPT'
  inbound_offer:        FlightOffer | null;
  outbound_offer:       FlightOffer | null;
  total_flight_cost:    number;
  transfer_saving:      number;            // vs return from arrival gateway
  net_saving:           number;            // flight delta + transfer delta
  is_cheaper:           boolean;
}

// ── Route reversal result ─────────────────────────────────────────────────────
// Uses INTERNAL_LEGS estimated costs — honest estimates, not fabricated
export interface RouteReversalResult {
  original_total_transfers:  number;
  reversed_total_transfers:  number;
  saving:                    number;
  reversed_city_order:       string[];     // city names in reversed order
  is_cheaper:                boolean;
}

// ── Date shift result ─────────────────────────────────────────────────────────
// Only fires when live availability returns real rate data
export interface DateShiftResult {
  shift_days:         number;             // negative = earlier, positive = later
  new_checkin:        string;
  saving_per_person:  number;
  total_saving:       number;
  source:             'live' | 'cached';  // never 'AI_inferred'
  season_crossing:    boolean;
  season_note?:       string;
}

// ── Deposit calculation — correct per spec ────────────────────────────────────
// Flights: 100% at booking (non-refundable)
// Package balance: depositPercent% at booking
export interface DepositBreakdown {
  flight_total:        number;            // 100% — paid in full at booking
  package_balance:     number;            // lodge + transfers + activities
  deposit_on_package:  number;            // depositPercent% of package_balance
  total_due_now:       number;            // flight_total + deposit_on_package
  balance_due_later:   number;            // package_balance - deposit_on_package
  balance_due_date:    string | null;     // 30 days before travel
}

export function calculateDepositBreakdown(params: {
  flight_total:    number;
  package_total:   number;
  deposit_pct:     number;           // e.g. 30
  travel_date:     string | null;
}): DepositBreakdown {
  const { flight_total, package_total, deposit_pct, travel_date } = params;
  const package_balance = package_total - flight_total;
  const deposit_on_package = Math.round(package_balance * deposit_pct / 100);
  const total_due_now = flight_total + deposit_on_package;
  const balance_due_later = package_balance - deposit_on_package;

  let balance_due_date: string | null = null;
  if (travel_date) {
    const d = new Date(travel_date);
    d.setDate(d.getDate() - 30);
    balance_due_date = d.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  return {
    flight_total,
    package_balance,
    deposit_on_package,
    total_due_now,
    balance_due_later,
    balance_due_date,
  };
}

// ── Route reversal calculator ─────────────────────────────────────────────────
// Uses INTERNAL_LEGS transfer costs — real estimated costs from your data
// This can fire immediately after itinerary builds — no API call needed
export function calculateRouteReversal(
  cities: ItineraryCity[],
  getTransferCost: (fromSlug: string, toSlug: string) => number,
  cityToSlug: (city: string) => string,
): RouteReversalResult {
  if (cities.length < 2) {
    return {
      original_total_transfers: 0,
      reversed_total_transfers: 0,
      saving: 0,
      reversed_city_order: cities.map(c => c.city),
      is_cheaper: false,
    };
  }

  // Calculate original sequence transfer cost
  let original_total = 0;
  for (let i = 0; i < cities.length - 1; i++) {
    const fromSlug = cityToSlug(cities[i].city);
    const toSlug   = cityToSlug(cities[i + 1].city);
    original_total += getTransferCost(fromSlug, toSlug);
  }

  // Calculate reversed sequence transfer cost
  const reversed = [...cities].reverse();
  let reversed_total = 0;
  for (let i = 0; i < reversed.length - 1; i++) {
    const fromSlug = cityToSlug(reversed[i].city);
    const toSlug   = cityToSlug(reversed[i + 1].city);
    reversed_total += getTransferCost(fromSlug, toSlug);
  }

  const saving = original_total - reversed_total;

  return {
    original_total_transfers: original_total,
    reversed_total_transfers: reversed_total,
    saving: Math.max(0, saving),
    reversed_city_order: reversed.map(c => c.city),
    is_cheaper: saving > 200, // Only surface if saving is meaningful
  };
}

// ── Open jaw saving calculator ────────────────────────────────────────────────
// Requires real Duffel data — never fires without it
export function calculateOpenJawSaving(
  returnOption:  { flight_cost: number; final_transfer_cost: number },
  openJawOption: { flight_cost: number; final_transfer_cost: number },
): { net_saving: number; is_cheaper: boolean } {
  const return_total   = returnOption.flight_cost  + returnOption.final_transfer_cost;
  const open_jaw_total = openJawOption.flight_cost + openJawOption.final_transfer_cost;
  const net_saving     = return_total - open_jaw_total;

  return {
    net_saving:  Math.max(0, net_saving),
    is_cheaper:  net_saving > 150,  // Only surface if saving is meaningful
  };
}

// ── Gateway options for Southern Africa ──────────────────────────────────────
export const SA_GATEWAYS = [
  { iata: 'JNB', city: 'Johannesburg', name: 'O.R. Tambo International',
    note: 'Main hub. Best connections to Kruger, Okavango, Madikwe.',
    transfer_cost_typical: 0 },      // Baseline
  { iata: 'CPT', city: 'Cape Town',    name: 'Cape Town International',
    note: 'Direct international flights from UK/EU. Best for Cape Town start/end.',
    transfer_cost_typical: 12000 },  // CPT→JNB connection if not ending there
  { iata: 'VFA', city: 'Victoria Falls', name: 'Victoria Falls Airport',
    note: 'Zimbabwe. Direct exit if ending at Vic Falls.',
    transfer_cost_typical: 8000 },
  { iata: 'MUB', city: 'Maun',         name: 'Maun Airport',
    note: 'Botswana gateway. Only useful if starting/ending in Okavango.',
    transfer_cost_typical: 16500 },
];

export const INTERNATIONAL_ORIGINS = [
  { iata: 'LHR', city: 'London',        name: 'Heathrow',              flag: '🇬🇧', market: 'UK' },
  { iata: 'LGW', city: 'London',        name: 'Gatwick',               flag: '🇬🇧', market: 'UK' },
  { iata: 'MAN', city: 'Manchester',    name: 'Manchester Airport',    flag: '🇬🇧', market: 'UK' },
  { iata: 'JFK', city: 'New York',      name: 'John F. Kennedy',       flag: '🇺🇸', market: 'US' },
  { iata: 'EWR', city: 'New York',      name: 'Newark Liberty',        flag: '🇺🇸', market: 'US' },
  { iata: 'LAX', city: 'Los Angeles',   name: 'Los Angeles Intl',      flag: '🇺🇸', market: 'US' },
  { iata: 'ORD', city: 'Chicago',       name: "O'Hare International",  flag: '🇺🇸', market: 'US' },
  { iata: 'ATL', city: 'Atlanta',       name: 'Hartsfield-Jackson',    flag: '🇺🇸', market: 'US' },
  { iata: 'FRA', city: 'Frankfurt',     name: 'Frankfurt Airport',     flag: '🇩🇪', market: 'DE' },
  { iata: 'AMS', city: 'Amsterdam',     name: 'Schiphol',              flag: '🇳🇱', market: 'NL' },
  { iata: 'DXB', city: 'Dubai',         name: 'Dubai International',   flag: '🇦🇪', market: 'AE' },
  { iata: 'SYD', city: 'Sydney',        name: 'Sydney Airport',        flag: '🇦🇺', market: 'AU' },
];

// ── Duration formatter ────────────────────────────────────────────────────────
export function formatFlightDuration(minutes: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── ISO 8601 duration parser ──────────────────────────────────────────────────
export function parseDuration(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0');
}

// ── Price formatter ───────────────────────────────────────────────────────────
export function formatFlightPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
