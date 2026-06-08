// app/lib/journey.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE SINGLE SOURCE. One canonical Journey powers all three surfaces:
//   • JourneyTimeline   (in-builder review — cream/editorial skin)
//   • JourneyMiniSite    (post-booking / quote companion — dark/cinematic skin)
//   • OpsValidation      (staff sequencing check)
// In production, getJourney(code) reads Supabase and returns this shape.
// ─────────────────────────────────────────────────────────────────────────────

export type Currency = 'ZAR' | 'GBP' | 'USD' | 'EUR';
export type Money = { sym: string; acc: number; fly: number };  // acc = land/lodges, fly = ALL air+charter (paid in full)
export type Badge = { type: 'free' | 'care' | 'visa' | 'family'; label: string };
export type SceneName = 'cape' | 'madikwe' | 'falls' | 'delta';
export type LegStatus = 'confirmed' | 'confirming';

export type Leg = {
  kind: 'air' | 'bush' | 'longhaul' | 'road';
  carrier: string; no: string; depApt: string; arrApt: string;
  dep: string; arr: string;            // ISO datetimes (drive both display + sequencing)
  status: LegStatus; cross?: boolean;
};
export type TransferNote = { good?: boolean; text: string };
export type Transfer = { tag: string; legs: Leg[]; notes: TransferNote[] };

export type Segment = {
  id: string;
  // ── editorial / review (cream) ──
  scene: SceneName; bandRegion: string; bandName: string; region: string; lodge: string;
  day: string; dayWord: 'Day' | 'Days'; dates: string;
  narrative: string; detail: string[]; badges: Badge[]; acts: string[];
  // ── companion / commerce (dark mini-site + ops) ──
  tone: string; img?: string; reel?: string; sensory?: string; kb?: string;
  value: number; ref: string; status: LegStatus; gameCamp: boolean; vehPerDay?: number;
  cancel: [number, number][];          // supplier-specific [daysBefore, penalty%] tiers
};

export type Journey = {
  ref: string; eyebrow: string; title: string; subtitle: string; route: string[];
  nights: number; dates: string; departIn: number; startISO: string;
  travellers: string[]; pax: number; surname: string; email: string;
  price: Record<Currency, Money>;
  included: string[]; prep: { title: string; body: string; daysBefore?: number }[];
  specialist: { initials: string; name: string; role: string; rec: string; years?: number; fav?: string; response?: string };
  heroReel?: string;
  segments: Segment[];
  transfers: Transfer[];   // transfers[i] = how the traveller reaches segments[i]; [0] is the inbound arrival
  homeward: Transfer;
};

// ── helpers ──────────────────────────────────────────────────────────────────
const D = (day: number, hm: string) => `2026-09-${String(day).padStart(2, '0')}T${hm}:00`;
const durStr = (a: string, b: string) => {
  const m = Math.round((+new Date(b) - +new Date(a)) / 6e4);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
const leg = (kind: Leg['kind'], carrier: string, no: string, depApt: string, dep: string,
             arrApt: string, arr: string, status: LegStatus, cross = false): Leg =>
  ({ kind, carrier, no, depApt, arrApt, dep, arr, status, cross });

// ── DEMO_JOURNEY (replace with Supabase row mapped to this shape) ────────────
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
    { title: 'Passport valid 6+ months', body: 'two blank pages for stamps.', daysBefore: 180 },
    { title: 'KAZA Univisa & SA entry', body: 'arranged for you — we send the brief.', daysBefore: 120 },
    { title: 'Malaria prophylaxis', body: 'for the Delta & Falls; Cape Town is malaria-free.', daysBefore: 42 },
    { title: 'Pack soft & light', body: 'bush flights take soft bags, 20kg per guest.', daysBefore: 14 },
  ],
  specialist: { initials: 'SK', name: 'Sarah Kemp',
    role: 'Your Journey Specialist · 12 years · has stayed at Mombo Camp',
    rec: '“I’ve put Mombo in the middle on purpose — you’ll have found your safari rhythm by the Delta, and the mokoro mornings are the ones you’ll never forget.”',
    years: 12, fav: 'Mombo Camp, Okavango', response: 'Replies in ~15 min · 8am–8pm SAST' },
  heroReel: '',
  segments: [
    { id: 'singita', scene: 'madikwe', bandRegion: 'South Africa', bandName: 'Sabi Sand', region: 'Big-cat country',
      lodge: 'Singita Boulders Lodge', day: '1–3', dayWord: 'Days', dates: '15–18 Sept',
      narrative: 'Begin above the Sand River — leopards at first light and the benchmark of Sabi Sand luxury.',
      detail: ['3 nights', 'Suite', 'all meals & game drives'], badges: [{ type: 'care', label: 'Malaria area · guidance sent' }],
      acts: ['Morning game drive', 'Leopard tracking on foot', 'Bush breakfast', 'Photographic hide', 'Spa treatment'],
      tone: 'linear-gradient(135deg,#3a2c17,#6b4a23 55%,#241a0e)', img: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1600&q=80', reel: '',
      sensory: 'Leopards at first light, the river murmuring below your deck.',
      kb: 'Malaria area — begin prophylaxis before arrival. Neutral tones, a warm layer for dawn drives. We request the north-facing Boulders Suite.',
      value: 14200, ref: 'SG-49217', status: 'confirmed', gameCamp: true, vehPerDay: 260, cancel: [[60, 25], [30, 50], [0, 100]] },
    { id: 'mombo', scene: 'delta', bandRegion: 'Botswana', bandName: 'Okavango Delta', region: 'Water wilderness',
      lodge: 'Mombo Camp', day: '4–7', dayWord: 'Days', dates: '18–22 Sept',
      narrative: 'The crescendo — water, wildlife and silence on Chief’s Island in the world’s greatest inland delta.',
      detail: ['4 nights', 'Tented suite', 'fully inclusive'], badges: [{ type: 'care', label: 'Malaria area · guidance sent' }],
      acts: ['Mokoro at dawn', 'Big-game drive', 'Guided bush walk', 'Helicopter flight (add-on)', 'Night drive'],
      tone: 'linear-gradient(135deg,#16312e,#1f5a4d 55%,#0c211d)', img: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=1600&q=80', reel: '',
      sensory: 'Gliding by mokoro through lily-strewn channels as the sun lifts the mist.',
      kb: 'Light aircraft only — soft bags, 20kg incl. hand luggage. Water peaks Jun–Aug, ideal for mokoro.',
      value: 16800, ref: '—', status: 'confirming', gameCamp: true, vehPerDay: 290, cancel: [[45, 20], [21, 50], [0, 100]] },
    { id: 'vicfalls', scene: 'falls', bandRegion: 'Zimbabwe', bandName: 'Victoria Falls', region: 'The Smoke that Thunders',
      lodge: 'Victoria Falls Island Treehouse', day: '8–9', dayWord: 'Days', dates: '22–24 Sept',
      narrative: 'A treehouse on a private island above the Falls — copper sunsets on the Zambezi.',
      detail: ['2 nights', 'Treehouse suite', 'B&B + tours'], badges: [{ type: 'visa', label: 'Zimbabwe entry · visa handled' }, { type: 'care', label: 'Malaria area · guidance sent' }],
      acts: ['Guided Falls tour', 'Sunset Zambezi cruise', 'Helicopter over the Falls (add-on)', "Devil's Pool"],
      tone: 'linear-gradient(135deg,#173042,#225a6b 55%,#0f2230)', img: 'https://images.unsplash.com/photo-1610552050890-fe99536c2615?w=1600&q=80', reel: '',
      sensory: 'Waking to the spray of the Falls on the horizon and fish-eagles overhead.',
      kb: 'Most UK passports get the KAZA Univisa on arrival. Falls fullest Mar–Jul.',
      value: 4300, ref: 'VF-1182', status: 'confirmed', gameCamp: false, cancel: [[30, 15], [14, 50], [0, 100]] },
    { id: 'ellerman', scene: 'cape', bandRegion: 'South Africa', bandName: 'Cape Town', region: 'The Mother City',
      lodge: 'Ellerman House', day: '10–11', dayWord: 'Days', dates: '24–26 Sept',
      narrative: 'Close gently above Bantry Bay — Atlantic sunsets, a cliffside cellar, the city before home.',
      detail: ['2 nights', 'Sea-facing suite', 'breakfast daily'], badges: [{ type: 'free', label: 'Malaria-free' }],
      acts: ['Table Mountain', 'Cape Winelands tour', 'Cape Point drive', 'Private art-collection tour'],
      tone: 'linear-gradient(135deg,#1d2536,#2f4a6b 55%,#121826)', img: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600&q=80', reel: '',
      sensory: 'Atlantic sunsets, a wine cellar carved into the rock, the city humming below.',
      kb: 'No malaria. Layered weather. Book the Table Mountain cableway early; it closes in high wind.',
      value: 3200, ref: 'EH-7741', status: 'confirmed', gameCamp: false, cancel: [[21, 10], [7, 50], [0, 100]] },
  ],
  transfers: [
    { tag: 'Arrival · 14–15 Sept', legs: [
      leg('longhaul', 'British Airways', 'BA 055', 'LHR', D(14, '19:05'), 'JNB', D(15, '07:25'), 'confirmed'),
      leg('air', 'Airlink', '4Z 121', 'JNB', D(15, '10:15'), 'Sabi airstrip', D(15, '11:25'), 'confirmed'),
      leg('road', 'Singita transfer', 'road', 'airstrip', D(15, '11:40'), 'Singita', D(15, '12:00'), 'confirmed') ],
      notes: [{ good: true, text: 'Overnight long-haul, then one short hop — no second flight the day you land.' },
              { good: true, text: 'A ranger meets you planeside; you’re never left to find your own way.' }] },
    { tag: 'Transfer · Day 4 · 18 Sept', legs: [
      leg('air', 'Federal Air (charter)', 'FA chtr', 'Sabi', D(18, '11:00'), 'JNB', D(18, '12:20'), 'confirmed'),
      leg('air', 'Airlink', '4Z 224', 'JNB', D(18, '14:30'), 'MUB Maun', D(18, '16:25'), 'confirmed', true),
      leg('bush', 'Wilderness Air', 'WA lt', 'MUB Maun', D(18, '17:10'), 'Mombo airstrip', D(18, '17:45'), 'confirming') ],
      notes: [{ good: true, text: 'A 2h05 buffer on the Johannesburg cross-border connection — never rushed, bags checked through.' }] },
    { tag: 'Transfer · Day 8 · 22 Sept', legs: [
      leg('bush', 'Wilderness Air', 'WA lt', 'Mombo', D(22, '09:30'), 'BBK Kasane', D(22, '10:40'), 'confirming'),
      leg('road', 'Private road transfer', 'road', 'Kasane', D(22, '11:10'), 'Victoria Falls ZW', D(22, '12:25'), 'confirmed', true) ],
      notes: [{ good: false, text: 'The Kasane road leg crosses into Zimbabwe on the KAZA Univisa, issued on arrival — brief sent ahead.' }] },
    { tag: 'Transfer · Day 10 · 24 Sept', legs: [
      leg('air', 'Airlink', '4Z 142', 'VFA', D(24, '13:55'), 'JNB', D(24, '15:45'), 'confirmed'),
      leg('air', 'Airlink', '4Z 388', 'JNB', D(24, '17:30'), 'CPT Cape Town', D(24, '19:35'), 'confirmed') ],
      notes: [{ good: true, text: 'Routed via Johannesburg with lounge access during the 1h45 layover — comfortable, not a scramble.' }] },
  ],
  homeward: { tag: 'Departure · Day 12 · 26 Sept', legs: [
    leg('longhaul', 'British Airways', 'BA 058', 'CPT', D(26, '19:20'), 'LHR London', D(27, '06:05'), 'confirmed') ],
    notes: [{ good: true, text: 'An evening departure leaves your final Cape Town day completely free.' }] },
};

// ── data access (swap the body for Supabase in production) ───────────────────
export async function getJourney(code: string): Promise<Journey> {
  // const { data } = await supabase.from('journeys').select('*, segments(*), transfers(*)').eq('ref', code).single();
  // return mapRowToJourney(data);
  return DEMO_JOURNEY;
}
export function getJourneySync(): Journey { return DEMO_JOURNEY; } // for client default props / demos

// ── one price + deposit rule (used by every surface) ─────────────────────────
export function totals(j: Journey, cur: Currency = 'GBP', vehTotal = 0, repriceDelta = 0) {
  const p = j.price[cur];
  const total = p.acc + p.fly + vehTotal + repriceDelta;
  const deposit = p.fly + Math.round(p.acc * 0.3);   // flights in full + 30% of land
  return { sym: p.sym, acc: p.acc, fly: p.fly, total, deposit, paid: deposit, balance: total - deposit };
}
export const balanceDue = (j: Journey) => { const d = new Date(j.startISO); d.setDate(d.getDate() - 45); return d; }; // 45 days before travel

// ── ADAPTER: canonical Journey → the cream JourneyTimeline `items[]` shape ───
// Keeps the editorial renderer untouched; it just consumes this output.
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
  const items: any[] = [transferToItem(j.transfers[0])]; // inbound arrival first
  j.segments.forEach((s, i) => {
    items.push(stopToItem(s));
    if (i < j.segments.length - 1 && j.transfers[i + 1]) items.push(transferToItem(j.transfers[i + 1]));
  });
  items.push(transferToItem(j.homeward));
  return items;
}
