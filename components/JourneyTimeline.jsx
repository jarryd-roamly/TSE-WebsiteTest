'use client';
// JourneyTimeline.tsx — the luxe, day-anchored Selection Load Page.
// Self-contained: drop into app/journey/[code]/review/page.tsx or import as a component.
// Data-driven — pass any `itinerary` and it renders. Styles are scoped to .tcj so
// they can't clash with the rest of your app. No libraries needed.
//
// Wire the buttons to the loop-proof hook from itinerary-edit-return.ts:
//   <JourneyTimeline itinerary={draft}
//     onMakeChanges={() => router.push(`/builder?edit=${draft.ref}`)}
//     onReserve={() => router.push(`/checkout?ref=${draft.ref}`)} />

import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
type Badge = { type: 'free' | 'care' | 'visa' | 'family'; label: string };
type Stop = {
  kind: 'stop'; day: string; dayWord: 'Day' | 'Days'; dates: string;
  scene: 'cape' | 'madikwe' | 'falls' | 'delta'; bandRegion: string; bandName: string;
  region: string; lodge: string; narrative: string; detail: string[];
  badges: Badge[]; acts: string[];
};
type Flight = { type: 'flight'; logo: string; airline: string; sub: string; dep: string; depApt: string; dur: string; arr: string; arrApt: string };
type Leg = { type: 'leg'; route: string; dur: string };
type Note = { type: 'note'; good?: boolean; text: string };
type Transfer = { kind: 'transfer'; tag: string; items: (Flight | Leg | Note)[] };
type Item = Stop | Transfer;
type Currency = 'ZAR' | 'GBP' | 'USD' | 'EUR';

export type Itinerary = {
  eyebrow: string; title: string; route: string[];
  nights: number; dates: string; departIn: number;
  price: Record<Currency, { sym: string; acc: number; fly: number }>;
  included: string[]; prep: { title: string; body: string }[];
  items: Item[];
  specialist: { initials: string; name: string; role: string; rec: string };
};

// ── Icons (Tabler-style inline; size/colour inherit) ─────────────────────────
const I = {
  plane: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 5l9 7-9 7v-4l-7 0v-6l7 0z" /></svg>,
  car: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="18.5" r="1.6" /><circle cx="16.5" cy="18.5" r="1.6" /><path d="M5 11l2-4h10l2 4" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 13l4 4L19 7" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  bag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7h18M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2s7 4 7 11a7 7 0 0 1-14 0c0-7 7-11 7-11z" /></svg>,
  family: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" /></svg>,
  passport: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6" /></svg>,
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>,
  doc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h5" /></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>,
  seal: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.6H21l-5.4 4 2.1 6.4L12 15.2 6.3 19l2.1-6.4-5.4-4h6.8z" /></svg>,
};
const badgeIcon = (t: Badge['type']) => t === 'visa' ? I.passport : t === 'family' ? I.family : I.shield;
const prepIcon = (i: number) => [I.doc, I.globe, I.shield, I.bag][i % 4];

// ── Region scenes (illustrated placeholders; swap for photography) ───────────
function Scene({ name }: { name: Stop['scene'] }) {
  const id = `g-${name}`;
  if (name === 'cape') return (
    <svg className="scene" viewBox="0 0 760 192" preserveAspectRatio="xMidYMid slice" aria-label="Cape Town">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EDF4F4" /><stop offset="1" stopColor="#DCEAEB" /></linearGradient></defs>
      <rect width="760" height="192" fill={`url(#${id})`} /><circle cx="610" cy="50" r="24" fill="#EFD9A8" opacity=".8" />
      <path d="M0 108 L120 104 L210 80 L470 78 L560 100 L760 104 L760 192 L0 192 Z" fill="#B7D2D2" opacity=".5" />
      <path d="M150 108 L250 108 L255 84 L460 84 L470 108 L600 108 L600 134 L150 134 Z" fill="#9BBABB" />
      <rect y="132" width="760" height="60" fill="#84ABAD" />
      <path d="M0 148 q190 -12 380 0 t380 0" fill="none" stroke="#EAF2F2" strokeWidth={2} opacity=".6" />
    </svg>);
  if (name === 'madikwe') return (
    <svg className="scene" viewBox="0 0 760 192" preserveAspectRatio="xMidYMid slice" aria-label="Madikwe">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8F1DD" /><stop offset="1" stopColor="#EEE2C6" /></linearGradient></defs>
      <rect width="760" height="192" fill={`url(#${id})`} /><circle cx="180" cy="74" r="32" fill="#EFCC84" />
      <path d="M0 142 q380 -32 760 0 L760 192 L0 192 Z" fill="#D7BC83" /><path d="M0 162 q380 -14 760 0 L760 192 L0 192 Z" fill="#C2A463" />
      <g stroke="#876734" strokeWidth={3} fill="none"><path d="M570 150 L570 104" /><path d="M570 116 q-18 -16 -42 -14 M570 116 q18 -16 42 -14 M570 104 q-26 -10 -36 -2 M570 104 q26 -10 36 -2" /></g>
      <ellipse cx="570" cy="92" rx="58" ry="16" fill="#A8884B" opacity=".85" />
    </svg>);
  if (name === 'falls') return (
    <svg className="scene" viewBox="0 0 760 192" preserveAspectRatio="xMidYMid slice" aria-label="Victoria Falls">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EBF3F0" /><stop offset="1" stopColor="#D6E7E2" /></linearGradient></defs>
      <rect width="760" height="192" fill={`url(#${id})`} /><path d="M0 66 L300 66 L300 120 L0 120 Z" fill="#6FA298" /><path d="M460 66 L760 66 L760 120 L460 120 Z" fill="#6FA298" />
      <g stroke="#FFFFFF" strokeWidth={6} opacity=".82"><path d="M310 68 L310 164" /><path d="M332 68 L332 164" /><path d="M354 68 L352 164" /><path d="M376 68 L378 164" /><path d="M398 68 L396 164" /><path d="M420 68 L422 164" /><path d="M442 68 L440 164" /></g>
      <ellipse cx="376" cy="164" rx="120" ry="22" fill="#FFFFFF" opacity=".65" /><rect y="164" width="760" height="28" fill="#5C8B82" />
    </svg>);
  return (
    <svg className="scene" viewBox="0 0 760 192" preserveAspectRatio="xMidYMid slice" aria-label="Okavango Delta">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F5F2DF" /><stop offset="1" stopColor="#E7E8C9" /></linearGradient></defs>
      <rect width="760" height="192" fill={`url(#${id})`} /><circle cx="620" cy="56" r="22" fill="#E4CD86" />
      <path d="M0 112 q200 30 400 8 t360 12 L760 192 L0 192 Z" fill="#A7C388" /><path d="M0 144 q220 24 440 6 t320 14 L760 192 L0 192 Z" fill="#7CA6AD" />
      <g stroke="#5C7C82" strokeWidth={2} fill="none" opacity=".55"><path d="M40 166 q120 -18 250 -6" /><path d="M420 168 q130 -16 280 -4" /></g>
      <g stroke="#6D8D3C" strokeWidth={3}><path d="M120 148 l0 -22 M126 148 l5 -20 M114 148 l-5 -20" /><path d="M250 154 l0 -20 M256 154 l5 -18 M244 154 l-5 -18" /></g>
    </svg>);
}

// ── Demo itinerary (replace with your Supabase draft) ────────────────────────
const DEMO: Itinerary = {
  eyebrow: 'The Safari Edition · Bespoke Journey',
  title: 'James & Sarah’s Southern Odyssey',
  route: ['Cape Town', 'Madikwe', 'Victoria Falls', 'Okavango Delta'],
  nights: 10, dates: '14 – 24 Sept 2026', departIn: 98,
  price: { ZAR: { sym: 'R', acc: 586000, fly: 56000 }, GBP: { sym: '£', acc: 25400, fly: 2400 }, USD: { sym: 'US$', acc: 32150, fly: 3050 }, EUR: { sym: '€', acc: 29750, fly: 2850 } },
  included: ['All accommodation, 7 nights luxury + 3 city', 'All meals & game activities on safari', 'All internal flights & private transfers', 'Park, conservation & concession fees', 'Zimbabwe visa arranged for you', 'Dedicated specialist + 24/7 concierge'],
  prep: [
    { title: 'Passport valid 6+ months', body: 'two blank pages for the Zimbabwe stamp.' },
    { title: 'Zimbabwe entry handled', body: 'we arrange your visa ahead of arrival.' },
    { title: 'Malaria guidance', body: 'for the Falls & Delta; Cape Town and Madikwe are malaria-free.' },
    { title: 'Pack soft & light', body: 'bush flights take soft bags, 15kg.' },
  ],
  specialist: { initials: 'TM', name: 'Thandi Mokoena', role: 'Your Journey Specialist · 11 years · has stayed at 7 of your lodges', rec: '“I’ve put Mombo last on purpose — you’ll have found your safari rhythm by the Delta, and it’s the one you’ll never forget.”' },
  items: [
    { kind: 'stop', day: '1–3', dayWord: 'Days', dates: '14–16 Sept', scene: 'cape', bandRegion: 'South Africa', bandName: 'Cape Town', region: 'The Mother City', lodge: 'Ellerman House', narrative: 'Begin gently at the foot of the mountain — Atlantic sunsets, vineyard lunches, and the city before the wild.', detail: ['3 nights', 'Sea-facing suite', 'breakfast daily'], badges: [{ type: 'free', label: 'Malaria-free' }], acts: ['Table Mountain', 'Cape Winelands', 'V&A Waterfront'] },
    { kind: 'transfer', tag: 'Transfer · Day 4 · 17 Sept', items: [
      { type: 'flight', logo: 'SA', airline: 'South African Airways', sub: 'SA 322 · carrier logo via Duffel in production', dep: '10:40', depApt: 'CPT', dur: '2h 10m', arr: '12:50', arrApt: 'JNB' },
      { type: 'leg', route: 'Private transfer O.R. Tambo → Lanseria', dur: '1h by road' },
      { type: 'note', good: true, text: 'Your Madikwe charter departs Lanseria, not O.R. Tambo — a 2-hour airport buffer is built in so the connection is never tight.' },
      { type: 'leg', route: 'Light aircraft Lanseria → Madikwe · Federal Air', dur: 'dep 15:30 · arr 16:20 · 50m' },
    ] },
    { kind: 'stop', day: '4–6', dayWord: 'Days', dates: '17–19 Sept', scene: 'madikwe', bandRegion: 'South Africa', bandName: 'Madikwe', region: 'Big Five, malaria-free', lodge: 'Madikwe Safari Lodge', narrative: 'Into the malaria-free bushveld for your first Big Five mornings — unhurried, private, and golden.', detail: ['3 nights', 'Luxury suite', 'all meals & game drives'], badges: [{ type: 'free', label: 'Malaria-free' }, { type: 'family', label: 'Family-friendly' }], acts: ['Twice-daily game drives', 'Rhino tracking', 'Bush dinner'] },
    { kind: 'transfer', tag: 'Transfer · Day 7 · 20 Sept', items: [
      { type: 'leg', route: 'Light aircraft Madikwe → O.R. Tambo · Federal Air', dur: 'dep 08:45 · arr 09:45 · 1h' },
      { type: 'flight', logo: '4Z', airline: 'Airlink', sub: '4Z 124 · carrier logo via Duffel in production', dep: '11:25', depApt: 'JNB', dur: '1h 40m', arr: '13:05', arrApt: 'VFA' },
    ] },
    { kind: 'stop', day: '7', dayWord: 'Day', dates: '20 Sept', scene: 'falls', bandRegion: 'Zimbabwe', bandName: 'Victoria Falls', region: 'The Smoke that Thunders', lodge: 'Victoria Falls Island Treehouse', narrative: 'Stand before the thundering Zambezi, then drift into a copper sunset on the river.', detail: ['1 night', 'Treehouse suite', 'all-inclusive'], badges: [{ type: 'care', label: 'Malaria area · guidance sent' }, { type: 'visa', label: 'Zimbabwe entry · visa handled' }], acts: ['Guided Falls tour', 'Zambezi sunset cruise'] },
    { kind: 'transfer', tag: 'Transfer · Day 8 · 21 Sept', items: [
      { type: 'leg', route: 'Private transfer Victoria Falls → Kasane', dur: '1h 15m · Kazungula border crossing' },
      { type: 'leg', route: 'Light aircraft Kasane → Okavango Delta · camp air transfer', dur: 'dep 14:30 · arr 15:15 · 45m' },
      { type: 'note', text: 'Bush flights take soft bags only, 15kg per guest. We’ll send a packing guide — hard cases can wait at your Maun departure point.' },
    ] },
    { kind: 'stop', day: '8–10', dayWord: 'Days', dates: '21–23 Sept', scene: 'delta', bandRegion: 'Botswana', bandName: 'Okavango Delta', region: 'Water wilderness', lodge: 'Mombo Camp', narrative: 'The crescendo — water, wildlife and silence in the world’s greatest inland delta.', detail: ['3 nights', 'Tented suite', 'fully inclusive'], badges: [{ type: 'care', label: 'Malaria area · guidance sent' }], acts: ['Mokoro safari', 'Game drives', 'Guided bush walk'] },
    { kind: 'transfer', tag: 'Departure · Day 11 · 24 Sept', items: [
      { type: 'leg', route: 'Light aircraft Okavango → Maun (MUB) · camp air transfer', dur: 'dep 10:00 · arr 10:30 · 30m' },
      { type: 'note', good: true, text: 'A 3-hour connection buffer is built in at Maun before your onward international flight — no rushed bush-to-international same-day risk.' },
    ] },
  ],
};

// ── Component ────────────────────────────────────────────────────────────────
export default function JourneyTimeline({
  itinerary = DEMO, onMakeChanges = () => {}, onReserve = () => {},
}: { itinerary?: Itinerary; onMakeChanges?: () => void; onReserve?: () => void }) {
  const [cur, setCur] = useState<Currency>('ZAR');
  const c = itinerary.price[cur];
  const money = (n: number) => c.sym + Math.round(n).toLocaleString('en-GB');
  const total = c.acc + c.fly, deposit = c.fly + c.acc * 0.3;
  const tint: Record<Stop['scene'], string> = { cape: 'var(--cape)', madikwe: 'var(--madikwe)', falls: 'var(--falls)', delta: 'var(--delta)' };

  return (
    <div className="tcj">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="topbar"><div className="inner">
        <button className="back-btn" onClick={onMakeChanges}>{I.back}Make changes</button>
        <div className="cur-wrap"><label htmlFor="cur">Currency</label>
          <select id="cur" className="cur-sel" value={cur} onChange={e => setCur(e.target.value as Currency)}>
            <option value="ZAR">ZAR · R</option><option value="GBP">GBP · £</option><option value="USD">USD · US$</option><option value="EUR">EUR · €</option>
          </select>
        </div>
      </div></div>

      <header className="hero wrap">
        <span className="seal">{I.seal}</span>
        <div className="eyebrow">{itinerary.eyebrow}</div>
        <h1 className="hero-title serif">{itinerary.title}</h1>
        <div className="route">{itinerary.route.map((r, i) => (<span key={r}>{i > 0 && <i>◆</i>}{r}</span>))}</div>
        <div className="rule" />
        <div className="hero-meta"><span><b>{itinerary.nights}</b> nights</span><span className="dot">•</span><span><b>{itinerary.dates}</b></span><span className="dot">•</span><span>departs in <b>{itinerary.departIn}</b> days</span></div>
        <div className="locked">{I.lock}Final & all-inclusive — to adjust anything, use Make changes</div>
      </header>

      <div className="wrap">
        <div className="ornament">{I.seal}</div>

        <div className="timeline">
          {itinerary.items.map((it, idx) => it.kind === 'stop' ? (
            <section className="chapter" key={idx} style={{ animationDelay: `${0.05 + idx * 0.06}s` }}>
              <div className="marker"><b dangerouslySetInnerHTML={{ __html: it.day }} /><small>{it.dayWord}</small></div>
              <div className="m-date">{it.dates}</div>
              <div className="card">
                <div className="hero-band" style={{ background: tint[it.scene] }}>
                  <Scene name={it.scene} />
                  <span className="photo-note">Photography in production</span>
                  <div className="band-tag"><div className="bt-r">{it.bandRegion}</div><div className="bt-l serif">{it.bandName}</div></div>
                </div>
                <div className="body">
                  <div className="region">{it.region}</div>
                  <div className="lodge serif">{it.lodge}</div>
                  <p className="narrative ital">{it.narrative}</p>
                  <div className="detail">{it.detail.map((d, i) => (<span key={i}>{i === 0 ? <b>{d}</b> : <>{i > 0 && <span className="sep">·</span>}{d}</>}</span>))}</div>
                  <div className="badges">{it.badges.map((b, i) => (<span className={`badge ${b.type === 'visa' ? 'visa' : b.type === 'care' ? 'care' : 'free'}`} key={i}>{badgeIcon(b.type)}{b.label}</span>))}</div>
                  <div className="acts">{it.acts.map(a => (<span className="chip" key={a}>{a}</span>))}</div>
                </div>
              </div>
            </section>
          ) : (
            <div className="transfer" key={idx} style={{ animationDelay: `${0.05 + idx * 0.06}s` }}>
              <div className="marker tmark">{I.plane}</div>
              <div className="t-tag">{it.tag}</div>
              {it.items.map((leg, j) => leg.type === 'flight' ? (
                <div className="flightcard" key={j}>
                  <div className="fc-air"><span className="fc-logo">{leg.logo}</span><div><b>{leg.airline}</b><small>{leg.sub}</small></div></div>
                  <div className="fc-route"><div className="fc-end"><div className="fc-time">{leg.dep}</div><div className="fc-apt">{leg.depApt}</div></div><div className="fc-path">{leg.dur}<div className="bar" />direct</div><div className="fc-end"><div className="fc-time">{leg.arr}</div><div className="fc-apt">{leg.arrApt}</div></div></div>
                </div>
              ) : leg.type === 'leg' ? (
                <div className="leg" key={j}><span className="ic">{leg.route.includes('road') || leg.route.includes('Private transfer') ? I.car : I.plane}</span><div><div className="l-route">{leg.route}</div><div className="l-dur">{leg.dur}</div></div></div>
              ) : (
                <div className={`leg-note ${leg.good ? 'good' : ''}`} key={j}>{leg.good ? I.check : I.bag}{leg.text}</div>
              ))}
            </div>
          ))}
        </div>

        <div className="ornament">{I.seal}</div>

        <div className="panel">
          <h2 className="serif">Everything included</h2>
          <p className="lead">One price, all-in — settled before you ever reach the bush.</p>
          <div className="inc-grid">{itinerary.included.map(x => (<div className="inc-item" key={x}>{I.check}{x}</div>))}</div>
          <div className="pricebreak">
            <div className="pb-row"><span>Accommodation & all-inclusive experiences</span><span>{money(c.acc)}</span></div>
            <div className="pb-row"><span>Internal flights & all transfers</span><span>{money(c.fly)}</span></div>
            <div className="pb-row total"><span>Journey total</span><span>{money(total)}</span></div>
            <p className="pb-terms">Flights are paid in full at booking; a 30% deposit secures the rest, with the balance due 45 days before travel. Shown in your selected currency, all-in — no surprises at checkout.</p>
          </div>
        </div>

        <div className="panel" style={{ marginTop: '18px' }}>
          <h2 className="serif">Before you travel</h2>
          <p className="lead">A few things we’ll take care of, and a couple to have ready.</p>
          <div className="inc-grid">{itinerary.prep.map((p, i) => (<div className="inc-item" key={i}>{prepIcon(i)}<div><b>{p.title}</b> — {p.body}</div></div>))}</div>
        </div>

        <div className="ornament">{I.seal}</div>

        <div className="specialist">
          <div className="avatar serif">{itinerary.specialist.initials}</div>
          <div><div className="sp-name serif">{itinerary.specialist.name}</div><div className="sp-role">{itinerary.specialist.role}</div><p className="sp-rec">{itinerary.specialist.rec}</p></div>
        </div>

        <div className="closing">
          <p className="ital">Your journey, already real.</p>
          <p className="human-mode">Prefer a person to refine this with you? <a href="#" onClick={e => e.preventDefault()}>A specialist can take it from here →</a></p>
        </div>
        <p className="footnote">Illustrated regions are placeholders — production swaps in The Safari Edition photography. Prices illustrative, all-inclusive.</p>
      </div>

      <div className="pricebar"><div className="inner">
        <div className="price-block"><div className="price-total">{money(total)}</div><div className="price-sub">Journey total · all-inclusive · flights + 30% deposit secures it</div></div>
        <div className="deposit-block"><div className="dl">Deposit today</div><div className="dv">{money(deposit)}</div></div>
        <button className="reserve" onClick={onReserve}>Reserve this journey</button>
      </div></div>
    </div>
  );
}

// ── Scoped styles (everything prefixed under .tcj — no app-wide collisions) ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Mulish:wght@400;500;600;700&display=swap');
.tcj{--ivory:#FAF6EE;--paper:#FFFFFF;--ink:#2B2419;--ink-soft:#766C58;--hair:#E7DECB;--gold:#A8843C;--gold-deep:#7C5F24;--gold-soft:#F0E6CF;--champagne:#EFE6D2;--cape:#E9F0F0;--madikwe:#F3ECDB;--falls:#E8EFEC;--delta:#EFEDDB;--free-bg:#E9F1DD;--free-ink:#3C6912;--care-bg:#F7EDD7;--care-ink:#7E5410;background:var(--ivory);color:var(--ink);font-family:'Mulish',sans-serif;line-height:1.65;padding-bottom:96px;-webkit-font-smoothing:antialiased}
.tcj *{box-sizing:border-box;margin:0;padding:0}
.tcj .wrap{max-width:740px;margin:0 auto;padding:0 26px}
.tcj .serif{font-family:'Fraunces',serif}.tcj .ital{font-family:'Fraunces',serif;font-style:italic}
.tcj .topbar{position:sticky;top:0;z-index:60;background:rgba(250,246,238,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--hair)}
.tcj .topbar .inner{max-width:740px;margin:0 auto;padding:11px 26px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.tcj .back-btn{display:inline-flex;align-items:center;gap:7px;background:none;border:none;font-family:'Mulish';font-weight:600;font-size:13px;color:var(--ink);cursor:pointer;padding:6px 2px}
.tcj .back-btn svg{width:16px;height:16px;color:var(--gold-deep)}.tcj .back-btn:hover{color:var(--gold-deep)}
.tcj .cur-wrap{display:flex;align-items:center;gap:9px}
.tcj .cur-wrap label{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.tcj .cur-sel{font-family:'Mulish';font-weight:700;font-size:13px;color:var(--ink);background:var(--paper);border:1px solid var(--hair);border-radius:99px;padding:7px 13px;cursor:pointer}
.tcj header.hero{padding:58px 0 8px;text-align:center}
.tcj .seal{width:46px;height:46px;border:1.5px solid var(--gold);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--gold);margin-bottom:22px}
.tcj .seal svg{width:18px;height:18px}
.tcj .eyebrow{font-size:11.5px;letter-spacing:.34em;text-transform:uppercase;color:var(--gold-deep);font-weight:600}
.tcj h1.hero-title{font-family:'Fraunces',serif;font-weight:500;font-size:50px;line-height:1.04;margin:16px auto 0;letter-spacing:-.015em;max-width:9em}
.tcj .route{margin:22px auto 0;font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink);font-weight:600;max-width:600px}
.tcj .route i{color:var(--gold);font-style:normal;margin:0 9px;font-size:10px;vertical-align:middle}
.tcj .rule{width:64px;height:1px;background:var(--gold);margin:26px auto 0;position:relative}
.tcj .rule::after{content:"";position:absolute;left:0;right:0;top:3px;height:1px;background:var(--gold);opacity:.4}
.tcj .hero-meta{display:flex;gap:22px;justify-content:center;flex-wrap:wrap;margin-top:24px;font-size:13.5px;color:var(--ink-soft)}
.tcj .hero-meta b{color:var(--ink);font-weight:600}.tcj .hero-meta .dot{color:var(--gold)}
.tcj .locked{display:inline-flex;align-items:center;gap:7px;margin-top:22px;font-size:12px;color:var(--gold-deep);background:var(--gold-soft);border-radius:99px;padding:7px 16px;font-weight:600}
.tcj .locked svg{width:14px;height:14px}
.tcj .ornament{display:flex;align-items:center;gap:18px;margin:40px 0 30px;color:var(--gold)}
.tcj .ornament::before,.tcj .ornament::after{content:"";flex:1;height:1px;background:var(--hair)}
.tcj .ornament svg{width:13px;height:13px}
.tcj .timeline{position:relative}
.tcj .timeline::before{content:"";position:absolute;left:27px;top:18px;bottom:64px;width:1.5px;background:linear-gradient(var(--gold),var(--gold-soft))}
.tcj .chapter,.tcj .transfer{position:relative;padding-left:80px;opacity:0;transform:translateY(16px);animation:tcjrise .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes tcjrise{to{opacity:1;transform:none}}
.tcj .marker{position:absolute;left:0;top:4px;width:55px;height:55px;border-radius:50%;background:var(--ivory);border:1.5px solid var(--gold);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2}
.tcj .marker b{font-family:'Fraunces',serif;font-size:17px;color:var(--gold-deep);line-height:1}
.tcj .marker small{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);margin-top:3px}
.tcj .m-date{position:absolute;left:-4px;top:66px;width:63px;text-align:center;font-size:10px;color:var(--ink-soft);line-height:1.3}
.tcj .chapter{margin:0 0 24px}
.tcj .card{background:var(--paper);border:1px solid var(--hair);border-radius:20px;overflow:hidden}
.tcj .hero-band{height:192px;position:relative}
.tcj .hero-band svg.scene{width:100%;height:100%;display:block}
.tcj .hero-band::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,transparent 52%,rgba(43,36,25,.34));pointer-events:none}
.tcj .band-tag{position:absolute;left:22px;bottom:16px;color:#fff;z-index:2}
.tcj .band-tag .bt-r{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;opacity:.85}
.tcj .band-tag .bt-l{font-family:'Fraunces',serif;font-size:21px;font-weight:500;margin-top:2px}
.tcj .photo-note{position:absolute;right:14px;top:14px;color:rgba(255,255,255,.78);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;z-index:2}
.tcj .body{padding:24px 26px 26px}
.tcj .region{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--gold-deep)}
.tcj .lodge{font-family:'Fraunces',serif;font-weight:500;font-size:29px;line-height:1.12;margin:5px 0 0}
.tcj .narrative{font-family:'Fraunces',serif;font-style:italic;font-size:16.5px;color:var(--ink-soft);margin:11px 0 0;line-height:1.5;max-width:38em}
.tcj .detail{display:flex;align-items:baseline;gap:8px;margin:16px 0 0;font-size:13px;color:var(--ink-soft);flex-wrap:wrap}
.tcj .detail b{color:var(--ink);font-weight:600}.tcj .detail .sep{color:var(--gold);opacity:.6}
.tcj .badges{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0}
.tcj .badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:99px}
.tcj .badge.free{background:var(--free-bg);color:var(--free-ink)}.tcj .badge.care{background:var(--care-bg);color:var(--care-ink)}.tcj .badge.visa{background:#ECE7DA;color:#6B6048}
.tcj .badge svg{width:13px;height:13px}
.tcj .acts{display:flex;gap:7px;flex-wrap:wrap;margin:16px 0 0;padding-top:16px;border-top:1px solid var(--hair)}
.tcj .chip{font-size:12.5px;background:var(--ivory);border:1px solid var(--hair);border-radius:99px;padding:5px 13px;color:var(--ink)}
.tcj .transfer{margin:0 0 24px}
.tcj .marker.tmark{width:55px;height:30px;top:8px;border-radius:99px;border-style:dashed}
.tcj .marker.tmark svg{width:15px;height:15px;color:var(--gold-deep)}
.tcj .t-tag{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;margin:2px 0 8px}
.tcj .leg{display:flex;align-items:center;gap:13px;padding:8px 0}
.tcj .leg .ic{width:32px;height:32px;border-radius:50%;background:var(--paper);border:1px solid var(--hair);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--gold-deep)}
.tcj .leg .ic svg{width:16px;height:16px}
.tcj .leg .l-route{font-weight:600;color:var(--ink);font-size:13.5px}.tcj .leg .l-dur{color:var(--ink-soft);font-size:12.5px}
.tcj .leg-note{margin:2px 0 4px 45px;font-size:12px;color:var(--care-ink);background:var(--care-bg);border-radius:9px;padding:8px 12px;display:flex;gap:7px;align-items:flex-start}
.tcj .leg-note svg{width:13px;height:13px;flex-shrink:0;margin-top:2px}.tcj .leg-note.good{color:var(--free-ink);background:var(--free-bg)}
.tcj .flightcard{border:1px solid var(--hair);border-radius:14px;background:var(--paper);padding:14px 17px;margin:6px 0}
.tcj .fc-air{display:flex;align-items:center;gap:11px;margin-bottom:12px}
.tcj .fc-logo{width:38px;height:38px;border-radius:9px;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.tcj .fc-air b{font-size:13.5px;display:block}.tcj .fc-air small{font-size:11px;color:var(--ink-soft)}
.tcj .fc-route{display:flex;align-items:center;gap:18px}
.tcj .fc-end{text-align:center;min-width:56px}
.tcj .fc-time{font-family:'Fraunces',serif;font-size:22px;font-weight:500;line-height:1}
.tcj .fc-apt{font-size:10.5px;letter-spacing:.12em;color:var(--ink-soft);margin-top:3px}
.tcj .fc-path{flex:1;text-align:center;font-size:11px;color:var(--ink-soft)}
.tcj .fc-path .bar{height:1px;background:var(--hair);position:relative;margin:8px 0 6px}
.tcj .fc-path .bar::after{content:"";position:absolute;right:0;top:-2px;width:5px;height:5px;border-top:1px solid var(--gold);border-right:1px solid var(--gold);transform:rotate(45deg)}
.tcj .panel{background:var(--paper);border:1px solid var(--hair);border-radius:20px;padding:28px}
.tcj .panel h2{font-family:'Fraunces',serif;font-weight:500;font-size:25px;margin:0 0 6px}
.tcj .panel .lead{font-size:13.5px;color:var(--ink-soft);margin:0 0 18px}
.tcj .inc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
.tcj .inc-item{display:flex;gap:11px;align-items:flex-start;font-size:13.5px}
.tcj .inc-item svg{width:16px;height:16px;color:var(--gold-deep);flex-shrink:0;margin-top:3px}
@media(max-width:560px){.tcj .inc-grid{grid-template-columns:1fr}.tcj h1.hero-title{font-size:36px}.tcj .pricebar .inner{flex-wrap:wrap;gap:10px}.tcj .deposit-block{display:none}.tcj .price-block{flex:1 0 60%}}
.tcj .pricebreak{margin:24px 0 0;border-top:1px solid var(--hair);padding-top:18px}
.tcj .pb-row{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;color:var(--ink-soft)}
.tcj .pb-row span:last-child{color:var(--ink);font-weight:600}
.tcj .pb-row.total{border-top:1px solid var(--hair);margin-top:8px;padding-top:14px}
.tcj .pb-row.total span:first-child{font-family:'Fraunces',serif;font-size:18px;color:var(--ink)}
.tcj .pb-row.total span:last-child{font-family:'Fraunces',serif;font-size:22px;color:var(--ink)}
.tcj .pb-terms{font-size:11.5px;color:var(--ink-soft);margin-top:12px;line-height:1.6}
.tcj .specialist{display:flex;gap:20px;align-items:center;background:var(--champagne);border:1px solid var(--hair);border-radius:20px;padding:24px 26px}
.tcj .avatar{width:66px;height:66px;border-radius:50%;flex-shrink:0;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:24px;font-weight:500}
.tcj .sp-name{font-family:'Fraunces',serif;font-size:21px;font-weight:500}
.tcj .sp-role{font-size:12px;color:var(--gold-deep);font-weight:600;letter-spacing:.04em}
.tcj .sp-rec{font-family:'Fraunces',serif;font-style:italic;font-size:15px;color:var(--ink-soft);margin-top:8px;line-height:1.5}
.tcj .closing{text-align:center;margin:40px 0 0}.tcj .closing .ital{font-size:22px;color:var(--ink)}
.tcj .human-mode{display:block;text-align:center;font-size:12.5px;color:var(--ink-soft);margin:18px 0 8px}
.tcj .human-mode a{color:var(--gold-deep);font-weight:600;text-decoration:none;border-bottom:1px solid var(--gold)}
.tcj .footnote{text-align:center;font-size:11px;color:#AEA388;margin:24px 0 10px}
.tcj .pricebar{position:fixed;left:0;right:0;bottom:0;background:rgba(250,246,238,.97);backdrop-filter:blur(12px);border-top:1px solid var(--hair);z-index:50}
.tcj .pricebar .inner{max-width:740px;margin:0 auto;padding:13px 26px;display:flex;align-items:center;gap:18px}
.tcj .price-block{flex:1;min-width:0}
.tcj .price-total{font-family:'Fraunces',serif;font-size:26px;font-weight:600;line-height:1}
.tcj .price-sub{font-size:11px;color:var(--ink-soft);margin-top:3px}
.tcj .deposit-block{text-align:right;border-left:1px solid var(--hair);padding-left:18px}
.tcj .deposit-block .dl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft)}
.tcj .deposit-block .dv{font-family:'Fraunces',serif;font-size:19px;font-weight:500;color:var(--gold-deep)}
.tcj .reserve{background:var(--gold);color:#fff;border:none;font-family:'Mulish';font-weight:700;font-size:14px;padding:13px 24px;border-radius:99px;cursor:pointer;white-space:nowrap;flex-shrink:0}
.tcj .reserve:hover{background:var(--gold-deep)}
`;
