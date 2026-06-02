// ─── DOMAIN TYPES ────────────────────────────────────────────────────────────
// Single typed contract. If you add a DB column, add it here first.
// HANDOVER: Every shape in the system is defined once here. No any in business logic.

// ── Multi-tenancy — the Edition config ───────────────────────────────────────
// THIS is the white-label hook. To launch Edition 2, create a new EditionConfig
// and pass it to the app. Nothing else changes.
export interface EditionConfig {
  id:            string;          // DB key: 'safari' | 'island' | 'ski'
  name:          string;          // "The Safari Edition"
  tagline:       string;          // "Sub-Saharan Africa · Curated"
  heroImage:     string;
  primaryRegion: string;          // default region for planner
  defaultCurrency: string;        // 'ZAR'
  margins: {
    flights:    number;           // 1.08 = 8% margin
    hotels:     number;
    transfers:  number;
    activities: number;
    intl:       number;
  };
  ai: {
    plannerModel:  string;        // Sonnet for full itinerary builds
    chatModel:     string;        // Haiku for inline chat (80% cheaper)
    maxPlanTokens: number;        // Hard ceiling — prevents runaway cost
    maxChatTokens: number;
    monthlyBudgetZAR: number;     // Alert threshold (not a hard stop)
  };
  payment: {
    gateways:       string[];     // ['payfast', 'stripe']
    depositPercent: number;       // 30 — % collected at booking
    balanceDaysBefore: number;    // 30 — days before travel
  };
  support: {
    email:        string;
    asataNumber?: string;
    whatsapp?:    string;
  };
}

// ── Booking State Machine ────────────────────────────────────────────────────
// CRITICAL — do not bypass. Financial events trigger on transitions.
// HANDOVER: Never mutate booking state directly. Use transitionBooking() in lib/booking.ts
export type BookingState =
  | 'quote'           // itinerary built, no money
  | 'hold'            // 15-min availability hold token
  | 'deposit_pending' // payment initiated
  | 'deposit_paid'    // deposit received — UNFLOWN LIABILITY starts here
  | 'confirmed'       // supplier confirmed
  | 'balance_due'     // 30 days before travel
  | 'balance_paid'    // full payment received
  | 'in_travel'       // journey started
  | 'completed'       // journey finished — revenue recognised
  | 'cancelled'
  | 'disputed';

// Legal state transitions — only these are allowed
export const VALID_TRANSITIONS: Record<BookingState, BookingState[]> = {
  quote:           ['hold', 'cancelled'],
  hold:            ['deposit_pending', 'quote', 'cancelled'],
  deposit_pending: ['deposit_paid', 'hold', 'cancelled'],
  deposit_paid:    ['confirmed', 'cancelled', 'disputed'],
  confirmed:       ['balance_due', 'cancelled', 'disputed'],
  balance_due:     ['balance_paid', 'cancelled', 'disputed'],
  balance_paid:    ['in_travel', 'cancelled', 'disputed'],
  in_travel:       ['completed', 'disputed'],
  completed:       [],
  cancelled:       [],
  disputed:        ['confirmed', 'cancelled'],
};

export function canTransition(from: BookingState, to: BookingState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Navigation ────────────────────────────────────────────────────────────────
export type Screen =
  | 'landing'
  | 'inspire-input'    // Socratic: 5 questions
  | 'inspire-research' // AI building animation
  | 'inspire-plan'     // Shared itinerary output (all 3 inputs land here)
  | 'builder'          // Build your own
  | 'curated'          // Curated journeys list
  | 'my-brief'         // Free text
  | 'knowledge-base'   // Specialist KB management
  | 'checkout'
  | 'confirming';      // Journey confirmation before payment

export type InputMode = 'socratic' | 'builder' | 'brief';
export type Pillar    = 'flights' | 'hotels' | 'transfers' | 'activities';
export type KBType    = 'regional' | 'property' | 'trade_tip';

// inclusion_source — every AI-generated claim must carry one of these
// AI_inferred = flagged for Journey Specialist review before reaching traveller
export type InclusionSource = 'KB' | 'contract' | 'supplier_data' | 'AI_inferred';

// ── Hotel / Supplier ──────────────────────────────────────────────────────────
export interface Hotel {
  id:           string | number;
  edition_id:   string;          // multi-tenancy: which Edition owns this supplier
  name:         string;
  location:     string;
  destination:  string;
  subRegion:    string;
  region:       string;
  country:      string;
  stars:        number;
  trustScore:   number;
  contentScore: number;
  netRate:      number;
  otaRate:      number | null;
  marginScore:  number;
  image:        string;
  funFact:      string | null;
  malariaFree:  boolean;
  tags:         string[];
  upgrades: {
    rooms:       UpgradeOption[];
    basis:       UpgradeOption[];
    flexibility: UpgradeOption[];
  };
}

export interface UpgradeOption { label: string; extra: number; tier: number; }

// ── Availability ─────────────────────────────────────────────────────────────
export interface AvailResult {
  supplier_id: string;
  check_in:    string;
  available:   boolean;
  options:     AvailOption[];
  source:      'live' | 'cached' | 'demo';
  response_ms: number;
}

export interface AvailOption {
  label:               string;
  available:           boolean;
  capacity_remaining?: number;
  rate_zar:            number;
  display_rate_zar:    number;
  meal_basis?:         string;
  addons?:             { label: string; extra_zar: number }[];
  external_ref?:       string;
}

export interface AltDate { date: string; delta: number; }

// ── Builder ───────────────────────────────────────────────────────────────────
export interface PropertyStay {
  id:       number;
  hotelIdx: number;
  nights:   number;
  prefs:    Record<string, number>;
}

export interface InterTransferState { transferId: string; expanded: boolean; }
export interface UpgradeState { [pillar: string]: Record<string, { label: string; extra: number }>; }

// ── Itinerary — shared output of all 3 input modes ───────────────────────────
export interface ItineraryCity {
  city: string; country: string; nights: number; why: string;
  highlights: string[]; estimatedCost: number; hotelRate: number;
  flightCost: number; transferCost: number; activityCost: number;
  arrivalGap: string; departureGap: string;
}

export interface Itinerary {
  title: string; summary: string; routing: string; bestTiming: string;
  briefInterpretation?: string;
  cities:        ItineraryCity[];
  totalEstimate: number;
  aiInsights:    string[];
  warnings:      string[];
  inputMode?:    InputMode;
}

// ── Knowledge Base ────────────────────────────────────────────────────────────
export interface KBEntry {
  id:               string;
  edition_id:       string;          // multi-tenancy: KB entries are Edition-scoped
  type:             KBType;
  title:            string;
  linkedTo:         string;
  structuredFields: Record<string, string>;
  specialistNotes:  string;
  active:           boolean;
  inclusion_source: InclusionSource;
}

// ── Booking (DB record) ───────────────────────────────────────────────────────
export interface BookingIntent {
  edition_id:        string;
  idempotency_key:   string;   // UUID generated client-side — prevents double-submit
  state:             BookingState;
  title:             string;
  adults:            number;
  children_count:    number;
  nights:            number;
  check_in:          string;
  check_out:         string;
  total_display_zar: number;
  total_net_zar:     number;
  budget_zar:        number;
  components:        BookingComponent[];
  input_mode:        InputMode;
}

export interface BookingComponent {
  pillar:           string;
  name:             string;
  location:         string;
  nights:           number;
  net_rate_zar:     number;
  display_rate_zar: number;
  margin_pct:       number;
  inclusion_source: InclusionSource;
}

// ── Shared UI types ───────────────────────────────────────────────────────────
export interface Currency    { code: string; symbol: string; rate: number; }
export interface ChatMessage { role: 'user' | 'assistant'; text: string; revert?: Itinerary; }
export interface Specialist  {
  name: string; role: string; avatar: string;
  tip: string; instagram: string; quote: string; trips: number;
}

// ── Tracking (behavioural events — the data moat) ────────────────────────────
// Every swipe, chat, view logged here. This becomes the prediction engine.
export type TrackEvent =
  | 'session_start' | 'socratic_complete' | 'brief_submit'
  | 'itinerary_viewed' | 'lodge_swipe' | 'lodge_customise'
  | 'chat_sent' | 'price_and_book_clicked' | 'checkout_started'
  | 'payment_initiated' | 'booking_confirmed';

// ── Constants ─────────────────────────────────────────────────────────────────
export const SECTION_LABELS: Record<string, string> = {
  rooms: 'Room type', basis: 'Meal basis', flexibility: 'Cancellation',
  classes: 'Cabin class', baggage: 'Baggage', vehicles: 'Vehicle',
  extras: 'Add-ons', options: 'Option',
};
