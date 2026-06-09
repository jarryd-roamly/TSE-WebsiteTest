// app/lib/journey.ts — PRODUCTION VERSION
// getJourney() now reads from Supabase bookings + itineraries tables
// Falls back to DEMO_JOURNEY if booking not found (for demo URLs)

import { createClient } from '@supabase/supabase-js';

export type Currency = 'ZAR' | 'GBP' | 'USD' | 'EUR';
export type Money = { sym: string; acc: number; fly: number };
export type Badge = { type: 'free' | 'care' | 'visa' | 'family'; label: string };
export type SceneName = 'cape' | 'madikwe' | 'falls' | 'delta' | 'kruger' | 'chobe';
export type LegStatus = 'confirmed' | 'confirming';

export type Leg = {
  kind: 'air' | 'bush' | 'longhaul' | 'road';
  carrier: string; no: string; depApt: string; arrApt: string;
  dep: string; arr: string;
  status: LegStatus; cross?: boolean;
};
export type TransferNote = { good?: boolean; text: string };
export type Transfer = { tag: string; legs: Leg[]; notes: TransferNote[] };

export type Segment = {
  id: string;
  scene: SceneName; bandRegion: string; bandName: string; region: string; lodge: string;
  day: string; dayWord: 'Day' | 'Days'; dates: string;
  narrative: string; detail: string[]; badges: Badge[]; acts: string[];
  tone: string; img?: string; reel?: string; sensory?: string; kb?: string;
  value: number; ref: string; status: LegStatus; gameCamp: boolean; vehPerDay?: number;
  cancel: [number, number][];
  nights?: number;
};

export type Journey = {
  ref: string; itineraryId?: string; eyebrow: string; title: string; subtitle: string; route: string[];
  nights: number; dates: string; departIn: number; startISO: string;
  travellers: string[]; pax: number; surname: string; email: string;
  price: Record<Currency, Money>;
  included: string[]; prep: { title: string; body: string; daysBefore?: number }[];
  specialist: { initials: string; name: string; role: string; rec: string; years?: number; fav?: string; response?: string };
  heroReel?: string;
  segments: Segment[];
  transfers: Transfer[];
  homeward: Transfer;
};

// ── helpers ───────────────────────────────────────────────────────────────────
const durStr = (a: string, b: string) => {
  const m = Math.round((+new Date(b) - +new Date(a)) / 6e4);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

function formatDateRange(checkIn: string, checkOut: string): string {
  if (!checkIn) return 'Dates TBC';
  const a = new Date(checkIn);
  const b = checkOut ? new Date(checkOut) : null;
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return b ? `${fmt(a)} — ${fmt(b)}` : fmt(a);
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));
}

function sceneForRegion(slug: string): SceneName {
  if (slug.includes('cape')) return 'cape';
  if (slug.includes('madikwe')) return 'madikwe';
  if (slug.includes('vic') || slug.includes('chobe') || slug.includes('falls')) return 'falls';
  if (slug.includes('okavango') || slug.includes('delta')) return 'delta';
  if (slug.includes('kruger') || slug.includes('sabi')) return 'kruger';
  return 'kruger';
}

function regionLabel(slug: string): string {
  const map: Record<string, string> = {
    'kruger-sabi-sand': 'Kruger / Sabi Sand',
    'okavango-delta':   'Okavango Delta',
    'cape-town':        'Cape Town',
    'madikwe':          'Madikwe',
    'chobe-vic-falls':  'Chobe / Victoria Falls',
    'masai-mara':       'Masai Mara',
    'bwindi':           'Bwindi',
  };
  return map[slug] || slug;
}

// ── Map booking + itinerary rows → Journey shape ─────────────────────────────
function mapToJourney(booking: any, itinerary: any): Journey {
  const snap     = booking.lead_traveller_snapshot || {};
  const name     = snap.name || 'Traveller';
  const parts    = name.trim().split(' ');
  const surname  = parts.length > 1 ? parts[parts.length - 1] : name;
  const checkIn  = itinerary?.check_in  || booking.check_in  || '';
  const checkOut = itinerary?.check_out || booking.check_out || '';
  const nights   = itinerary?.nights    || booking.nights    || 0;
  const adults   = itinerary?.adults    || booking.adults    || 2;
  const totalZAR = booking.total_display_zar || itinerary?.total_display_zar || 0;
  const components: any[] = itinerary?.components || [];

  // Build segments from enriched components (saved from page.tsx)
  const hotelComponents = components.filter((c: any) => 
    c.pillar === 'hotel' || c.type === 'accommodation'
  );

  // Calculate per-segment dates
  let runningDate = checkIn ? new Date(checkIn) : null;

  const segments: Segment[] = hotelComponents.map((comp: any, i: number) => {
    const slug    = comp.region_slug || '';
    const lodge   = comp.name || 'Lodge TBC';
    const cNights = Number(comp.nights) || 1;
    
    const segCheckIn  = runningDate ? new Date(runningDate) : null;
    const segCheckOut = segCheckIn  ? new Date(new Date(segCheckIn).setDate(segCheckIn.getDate() + cNights)) : null;
    if (runningDate) runningDate.setDate(runningDate.getDate() + cNights);

    const segDates = segCheckIn && segCheckOut
      ? formatDateRange(segCheckIn.toISOString().slice(0,10), segCheckOut.toISOString().slice(0,10))
      : formatDateRange(checkIn, checkOut);

    const badges: Badge[] = [];
    if (comp.malaria_free) badges.push({ type: 'care', label: 'Malaria-free' });

    return {
      id:         `seg-${i}`,
      scene:      sceneForRegion(slug),
      bandRegion: comp.region_label || regionLabel(slug),
      bandName:   lodge,
      region:     comp.region_label || regionLabel(slug),
      lodge,
      day:        String(cNights),
      dayWord:    (cNights === 1 ? 'Day' : 'Days') as 'Day' | 'Days',
      nights:     cNights,
      dates:      segDates,
      narrative:  comp.fun_fact || '',
      detail:     comp.inclusions?.slice(0, 4) || [],
      badges,
      acts:       [],
      tone:       '',
      img:        comp.hero_image_url || undefined,
      value:      comp.display_rate_zar || 0,
      ref:        booking.booking_reference || '',
      status:     'confirming' as LegStatus,
      gameCamp:   slug.includes('kruger') || slug.includes('okavango') || slug.includes('madikwe') || slug.includes('chobe'),
      cancel:     [[45, 50], [30, 100]] as [number, number][],
    };
  });

  // Fallback if no hotel components
  if (segments.length === 0) {
    segments.push({
      id: 'seg-0', scene: 'kruger' as SceneName, bandRegion: 'Your Safari',
      bandName: 'Lodge TBC', region: 'Your Safari', lodge: 'Lodge TBC',
      day: String(nights || 1), dayWord: 'Days' as 'Days', nights: nights || 1, dates: formatDateRange(checkIn, checkOut),
      narrative: '', detail: [], badges: [], acts: [], tone: '',
      value: totalZAR, ref: booking.booking_reference || '',
      status: 'confirming' as LegStatus, gameCamp: true, cancel: [[45, 50], [30, 100]] as [number, number][],
    });
  }

  const route = hotelComponents.length > 0
    ? [...new Set(hotelComponents.map((c: any) => c.region_label || regionLabel(c.region_slug || '')).filter(Boolean))]
    : ['Your Safari'];

  const EXCHANGE = { GBP: 0.042, USD: 0.054, EUR: 0.049 };
  const flyZAR   = components
    .filter(c => (c.type || '').toLowerCase().includes('flight'))
    .reduce((s, c) => s + (c.price_display_zar || 0), 0);
  const accZAR   = totalZAR - flyZAR;

  // ── Build real Leg objects from saved flight/transfer components ─────────
  // This populates SimpleDoc's FLIGHTS & AIR table and the Minisite's logistics view.
  function compToLeg(comp: any): Leg | null {
    const isIntl    = comp.is_international
    const isReturn  = comp.is_return
    const airline   = comp.airline || comp.carrier_name || 'Airline'
    const flightNo  = comp.flight_number || comp.fn || ''
    const fromApt   = comp.from || comp.depApt || comp.from_region || ''
    const toApt     = comp.to   || comp.arrApt || comp.to_region   || ''
    const depDT     = comp.departure_datetime || (comp.departure_date ? `${comp.departure_date}T${comp.departure_time || '00:00'}:00` : '')
    const arrDT     = comp.arrival_datetime   || ''
    if (!fromApt || !toApt) return null
    return {
      kind:    isIntl ? 'longhaul' : 'air',
      carrier: airline,
      no:      flightNo,
      depApt:  fromApt,
      arrApt:  toApt,
      dep:     depDT,
      arr:     arrDT,
      status:  'confirming' as LegStatus,
    }
  }

  function compToTransferLeg(comp: any): Leg | null {
    const from  = comp.from_label || comp.from_region || ''
    const to    = comp.to_label   || comp.to_region   || ''
    if (!from || !to) return null
    return {
      kind:    'road',
      carrier: comp.provider || comp.name || 'Transfer',
      no:      comp.duration || '',
      depApt:  from,
      arrApt:  to,
      dep:     '',
      arr:     '',
      status:  'confirming' as LegStatus,
    }
  }

  const flightComps    = components.filter(c => c.type === 'flight' || c.pillar === 'flight')
  const outboundFlight = flightComps.find(c => c.is_outbound && c.is_international)
  const returnFlight   = flightComps.find(c => c.is_return  && c.is_international)
  const charterFlights = flightComps.filter(c => !c.is_international)
  const transferComps  = components.filter(c => {
    const t = (c.type || c.pillar || '').toLowerCase()
    return (t.includes('transfer') || t === 'transport') && !t.includes('flight')
  })

  // Arrival transfer: outbound intl flight + first-mile transfer to lodge
  const arrivalLegs: Leg[] = [
    outboundFlight ? compToLeg(outboundFlight) : null,
    ...transferComps.filter(t => t.is_arrival).map(compToTransferLeg),
  ].filter(Boolean) as Leg[]

  const arrivalTransfer: Transfer = {
    tag:  checkIn ? `Arrival — ${formatDateRange(checkIn, checkIn)}` : 'Arrival',
    legs: arrivalLegs,
    notes: arrivalLegs.length > 0
      ? []
      : [{ good: true, text: 'Airport arrival transfer confirmed by your specialist within 2 hours.' }],
  }

  // Inter-region transfers: use real components where available, fallback to notes
  const interRegionTransfers: Transfer[] = hotelComponents.length > 1
    ? hotelComponents.slice(0, -1).map((comp: any, i: number) => {
        const from = comp.region_label || comp.name || 'Previous destination'
        const to   = hotelComponents[i + 1]?.region_label || hotelComponents[i + 1]?.name || 'Next destination'
        // Find charter flight between these regions
        const charter = charterFlights[i] ? compToLeg(charterFlights[i]) : null
        // Find inter-region transfer component
        const xferComp = transferComps.find((t: any) =>
          !t.is_arrival && !t.is_departure &&
          ((t.from_region === comp.region_slug) || (t.from_label && t.from_label.toLowerCase().includes(from.toLowerCase())))
        )
        const xferLeg = xferComp ? compToTransferLeg(xferComp) : null
        const legs: Leg[] = [charter, xferLeg].filter(Boolean) as Leg[]
        return {
          tag:   `${from} → ${to}`,
          legs,
          notes: legs.length > 0
            ? [{ good: true, text: xferComp?.description || xferComp?.provider || '' }].filter(n => n.text)
            : [{ good: true, text: 'Transfer and charter details confirmed by your specialist.' }],
        }
      })
    : []

  // Homeward transfer: departure transfer + return flight
  const homewardLegs: Leg[] = [
    ...transferComps.filter(t => t.is_departure).map(compToTransferLeg),
    returnFlight ? compToLeg(returnFlight) : null,
  ].filter(Boolean) as Leg[]

  const homewardTransfer: Transfer = {
    tag:  checkOut ? `Departure — ${formatDateRange(checkOut, checkOut)}` : 'Departure',
    legs: homewardLegs,
    notes: homewardLegs.length > 0
      ? []
      : [{ good: true, text: 'Departure logistics confirmed by your specialist.' }],
  }

  return {
    ref:       booking.booking_reference || booking.idempotency_key || 'TSE-DEMO',
    itineraryId: booking.itinerary_id || null,
    eyebrow:   'The Safari Edition · Bespoke Journey',
    title:     itinerary?.title || `${nights}-Night Safari`,
    subtitle:  route.join(' · '),
    route,
    nights,
    dates:     formatDateRange(checkIn, checkOut),
    departIn:  daysUntil(checkIn),
    startISO:  checkIn ? new Date(checkIn).toISOString() : new Date().toISOString(),
    travellers: [name],
    pax:       adults,
    surname,
    email:     snap.email || '',
    price: {
      ZAR: { sym: 'R',   acc: accZAR,                          fly: flyZAR },
      GBP: { sym: '£',   acc: Math.round(accZAR * EXCHANGE.GBP), fly: Math.round(flyZAR * EXCHANGE.GBP) },
      USD: { sym: 'US$', acc: Math.round(accZAR * EXCHANGE.USD), fly: Math.round(flyZAR * EXCHANGE.USD) },
      EUR: { sym: '€',   acc: Math.round(accZAR * EXCHANGE.EUR), fly: Math.round(flyZAR * EXCHANGE.EUR) },
    },
    included: [
      `All accommodation — ${nights} nights`,
      'All meals & game activities on safari',
      'All internal flights, charters & private transfers',
      'Park, conservation & concession fees',
      'Dedicated specialist + 24/7 concierge',
    ],
    prep: [
      { title: 'Pack light for bush legs', body: '20kg soft bag limit on light aircraft. Hard cases can be stored at your gateway hotel.', daysBefore: 60 },
      { title: 'Visa requirements', body: 'Check requirements for all countries on your itinerary well in advance.', daysBefore: 90 },
      { title: 'Malaria prophylactics', body: 'Consult your GP 6 weeks before travel for safari regions.', daysBefore: 45 },
    ],
    specialist: {
      initials: 'SM',
      name:     'Sarah Mitchell',
      role:     'Senior Safari Specialist',
      rec:      'Your journey specialist — available on WhatsApp & email.',
      years:    8,
    },
    segments,
    transfers: [arrivalTransfer, ...interRegionTransfers],
    homeward: homewardTransfer,
  };
}

// ── getJourney — reads Supabase, falls back to demo ──────────────────────────
export async function getJourney(code: string): Promise<Journey> {
  // Demo codes — return demo journey immediately
  if (!code || code === 'KR7P2MX4' || code === 'DEMO') return DEMO_JOURNEY;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return DEMO_JOURNEY;

    const supabase = createClient(url, key);

    // Look up booking by booking_reference
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_reference', code)
      .single();

    if (bErr || !booking) return DEMO_JOURNEY;

    // Load the itinerary if linked
    let itinerary = null;
    if (booking.itinerary_id) {
      const { data: itin } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', booking.itinerary_id)
        .single();
      itinerary = itin;
    }

    return mapToJourney(booking, itinerary);

  } catch {
    return DEMO_JOURNEY;
  }
}

export function getJourneySync(): Journey { return DEMO_JOURNEY; }

// ── totals helper ─────────────────────────────────────────────────────────────
export function totals(j: Journey, cur: Currency = 'GBP', vehTotal = 0, repriceDelta = 0) {
  const p = j.price[cur];
  const total   = p.acc + p.fly + vehTotal + repriceDelta;
  const deposit = p.fly + Math.round(p.acc * 0.3);
  return { sym: p.sym, acc: p.acc, fly: p.fly, total, deposit, paid: deposit, balance: total - deposit };
}

export const balanceDue = (j: Journey) => {
  const d = new Date(j.startISO);
  d.setDate(d.getDate() - 45);
  return d;
};

const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
const logoOf = (carrier: string) =>
  carrier.startsWith('British') ? 'BA' : carrier.startsWith('Airlink') ? '4Z'
  : carrier.startsWith('Federal') ? 'FA' : carrier.startsWith('Wilderness') ? 'WA' : '✈';

export function toTimelineItems(j: Journey) {
  const transferToItem = (t: Transfer) => ({
    kind: 'transfer' as const, tag: t.tag,
    items: [
      ...t.legs.map((l) => l.kind === 'road'
        ? { type: 'leg' as const, route: `${l.carrier} · ${l.depApt} → ${l.arrApt}`, dur: durStr(l.dep, l.arr) }
        : { type: 'flight' as const, logo: logoOf(l.carrier), airline: l.carrier, sub: `${l.no}${l.status === 'confirming' ? ' · confirming' : ''}`,
            dep: hm(l.dep), depApt: l.depApt, dur: durStr(l.dep, l.arr), arr: hm(l.arr), arrApt: l.arrApt }),
      ...t.notes.map((n) => ({ type: 'note' as const, good: n.good, text: n.text })),
    ],
  });
  const stopToItem = (s: Segment) => ({
    kind: 'stop' as const, day: s.day, dayWord: s.dayWord, dates: s.dates, scene: s.scene,
    bandRegion: s.bandRegion, bandName: s.bandName, region: s.region, lodge: s.lodge,
    narrative: s.narrative, detail: s.detail, badges: s.badges, acts: s.acts,
  });
  const items: any[] = [transferToItem(j.transfers[0] || j.homeward)];
  j.segments.forEach((s, i) => {
    items.push(stopToItem(s));
    if (i < j.segments.length - 1 && j.transfers[i + 1]) items.push(transferToItem(j.transfers[i + 1]));
  });
  items.push(transferToItem(j.homeward));
  return items;
}

// ── DEMO_JOURNEY (kept for fallback + demo URLs) ──────────────────────────────
const D = (day: number, hm: string) => `2026-09-${String(day).padStart(2, '0')}T${hm}:00`;
const legD = (kind: Leg['kind'], carrier: string, no: string, depApt: string, dep: string,
             arrApt: string, arr: string, status: LegStatus, cross = false): Leg =>
  ({ kind, carrier, no, depApt, arrApt, dep, arr, status, cross });

export const DEMO_JOURNEY: Journey = {
  ref: 'KR7P2MX4',
  eyebrow: 'The Safari Edition · Bespoke Journey',
  title: 'An Untamed Honeymoon',
  subtitle: 'Sabi Sand · Okavango · Victoria Falls · Cape Town',
  route: ['Sabi Sand', 'Okavango', 'Victoria Falls', 'Cape Town'],
  nights: 11, dates: '15 – 26 Sept 2026', departIn: 98, startISO: D(15, '00:00'),
  travellers: ['James Harrington', 'Eleanor Harrington'], pax: 2, surname: 'Harrington', email: 'j.harrington@example.com',
  price: {
    GBP: { sym: '£', acc: 38500, fly: 7000 },
    ZAR: { sym: 'R', acc: 895000, fly: 163000 },
    USD: { sym: 'US$', acc: 48500, fly: 8800 },
    EUR: { sym: '€', acc: 45000, fly: 8200 },
  },
  included: [
    'All accommodation — 11 nights across 4 camps', 'All meals & game activities on safari',
    'All internal flights, charters & private transfers', 'Park, conservation & concession fees',
    'Zimbabwe / KAZA entry arranged for you', 'Dedicated specialist + 24/7 concierge',
  ],
  prep: [
    { title: 'Pack light for bush legs', body: '20kg soft bag limit on light aircraft.', daysBefore: 60 },
    { title: 'Visa requirements', body: 'Check requirements for all countries 90 days before travel.', daysBefore: 90 },
    { title: 'Malaria prophylactics', body: 'Consult your GP 6 weeks before travel.', daysBefore: 45 },
  ],
  specialist: { initials: 'SM', name: 'Sarah Mitchell', role: 'Senior Safari Specialist', rec: 'I hand-picked each camp for the September conditions — Mombo for wild dog, Singita for leopard.', years: 8, fav: 'Mombo', response: '< 2 hours' },
  segments: [],
  transfers: [],
  homeward: { tag: 'Homeward journey', legs: [], notes: [] },
};
