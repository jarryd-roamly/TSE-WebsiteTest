'use client';
import React, { useState, useRef } from 'react';

// ════════════════════════════════════════════════════════════════════════════
// TransferTimeline — horizontal (left→right) transfer tile · v3
// Renders a TransferOption.structuredLegs as a single-row journey timeline with
// FAIRLY BIG carrier logos. Compact height (fixes the tall vertical version).
//
// DROP-IN: in app/page.tsx, delete the DEMO HARNESS at the bottom, replace the
// local `T` with `import { T } from './lib/theme'`, and render <TransferTimeline
// option={opt} logos={AIRLINE_LOGOS} mode={mode} /> inside the TRANSFER CAROUSEL.
//
// LOGOS resolve by StructuredLeg.badge (IATA): '4Z' Airlink · 'FA' FedAir ·
// 'MA' Mack Air · 'WA' Wilderness · 'TC' Fastjet · '5Z' CemAir · 'FS' FlySafair.
// Production: store carrier-logos/{BADGE}.png in Supabase Storage, then
//   AIRLINE_LOGOS[badge] = `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/carrier-logos/${badge}.png`
// ════════════════════════════════════════════════════════════════════════════

// —— lib/theme tokens (mirror; replace with: import { T } from './lib/theme') ——
const T = {
  bg: '#0a0a0a', bg2: '#111111', surface: '#1a1a1a',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.12)',
  borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)', green: '#4ade80', amber: '#fb923c',
};

// Carrier display meta keyed by IATA badge (mirrors AIRLINE_META in your app)
const CARRIER = {
  '4Z': { name: 'Airlink',       color: '#c8102e', mono: '4Z' },
  'FA': { name: 'Federal Air',   color: '#1f6fb2', mono: 'FA', group: true },
  'TC': { name: 'Fastjet',       color: '#f47b20', mono: 'TC', group: true },
  'MA': { name: 'Mack Air',      color: '#3a8f4a', mono: 'MA', group: true },
  'WA': { name: 'Wilderness Air',color: '#7a5c3e', mono: 'WA' },
  '5Z': { name: 'CemAir',        color: '#1c8ad0', mono: '5Z' },
  'FS': { name: 'FlySafair',     color: '#d6206a', mono: 'FS' },
  'SA': { name: 'SAA',           color: '#1565c0', mono: 'SA' },
  'road':    { name: 'Private vehicle', color: '#6c6a82', mono: '↣' },
  'charter': { name: 'Charter',         color: '#9c7bd0', mono: '✈' },
};

// —— Big logo chip: uploaded image, else branded monogram —————————————————
function Logo({ badge, logos, size = 56 }) {
  const c = CARRIER[badge] || CARRIER.road;
  const url = logos[badge];
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: url ? '#fff' : `${c.color}22`,
      border: `1px solid ${url ? 'rgba(255,255,255,0.18)' : c.color + '55'}`,
      boxShadow: '0 6px 18px -8px rgba(0,0,0,0.6)', overflow: 'hidden',
    }}>
      {url
        ? <img src={url} alt={c.name} style={{ maxWidth: '82%', maxHeight: '82%', objectFit: 'contain' }} />
        : <span style={{ fontSize: size * 0.32, fontWeight: 600, color: c.color, fontFamily: "'Jost',sans-serif", letterSpacing: 0.4 }}>{c.mono}</span>}
    </div>
  );
}

// —— The horizontal tile —————————————————————————————————————————————————
function TransferTimeline({ option, logos, mode = 'traveller' }) {
  const [open, setOpen] = useState(false);
  const operator = mode === 'operator';
  const legs = option.structuredLegs || [];

  return (
    <div style={{
      background: `linear-gradient(180deg, ${T.bg2}, ${T.bg})`,
      border: `1px solid ${T.border}`, borderRadius: 16, padding: '18px 20px 16px',
      fontFamily: "'Jost',sans-serif", maxWidth: 760, position: 'relative', overflow: 'hidden',
    }}>
      {/* header: route + duration · price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 4 }}>
        <div>
          <div style={{ color: T.gold, fontSize: 9.5, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 3 }}>
            Transfer{option.recommended ? ' · Recommended' : ''}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: T.text, lineHeight: 1.1 }}>
            {option.label}
          </div>
          <div style={{ color: T.textMid, fontSize: 11.5, marginTop: 3 }}>{option.duration} door-to-door</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: T.goldLight, lineHeight: 1 }}>
            R{option.estimatedCostZAR.toLocaleString()}
          </div>
          <div style={{ color: T.textDim, fontSize: 10 }}>pp · indicative</div>
        </div>
      </div>

      {/* badges */}
      {option.badges?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 14px' }}>
          {option.badges.map((b, i) => {
            if (b.operatorOnly && !operator) return null;
            return (
              <span key={i} style={{
                fontSize: 9.5, fontWeight: 500, padding: '4px 9px', borderRadius: 16, letterSpacing: 0.3,
                color: b.color || T.textMid, border: `1px solid ${(b.color || T.textMid)}55`,
                background: (b.color || T.textMid) + '14', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>{b.star ? '★ ' : ''}{b.text}</span>
            );
          })}
        </div>
      )}

      {/* ── HORIZONTAL TIMELINE ── scrolls on narrow screens, never grows tall ── */}
      <div style={{ overflowX: 'auto', paddingBottom: 6, margin: '0 -4px' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 'min-content', padding: '0 4px' }}>
          {legs.map((leg, i) => {
            const c = CARRIER[leg.badge] || CARRIER.road;
            const isRoad = leg.badge === 'road' || leg.kind === 'road';
            const preferred = leg.preferred;
            return (
              <React.Fragment key={i}>
                {/* NODE (origin of this leg) */}
                <Node leg={leg} which="from" />
                {/* SEGMENT */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 132, flex: '0 0 auto', padding: '0 4px' }}>
                  <div style={{ position: 'relative', width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* rail */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: preferred ? `linear-gradient(90deg, ${T.gold}, ${T.goldLight})` : 'rgba(255,255,255,0.12)' }} />
                    {/* big logo on the rail */}
                    <div style={{ position: 'relative', zIndex: 2 }}>
                      <Logo badge={leg.badge} logos={logos} size={56} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <div style={{ color: T.text, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                      {isRoad ? '🚗' : '✈'} {leg.name}{preferred && operator && <span style={{ color: T.gold }}>★</span>}
                    </div>
                    {leg.detail && <div style={{ color: T.textDim, fontSize: 9.5, marginTop: 2, maxWidth: 150, lineHeight: 1.3 }}>{leg.detail.split(' · ')[0]}</div>}
                  </div>
                </div>
                {/* final NODE only after the last leg */}
                {i === legs.length - 1 && <Node leg={leg} which="to" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* baggage / soft-bag / warning line from aiNote */}
      {option.alert && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 11,
          color: option.alert.tone === 'warn' ? T.amber : T.textMid,
          background: (option.alert.tone === 'warn' ? T.amber : '#fff') + '12',
          border: `1px solid ${(option.alert.tone === 'warn' ? T.amber : T.border)}`, borderRadius: 9, padding: '8px 11px' }}>
          {option.alert.tone === 'warn' ? '⚠' : '🧳'} {option.alert.text}
        </div>
      )}

      {/* footer actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
        {operator && option.ruleTrace && (
          <button onClick={() => setOpen(o => !o)} style={btn(true)}>Routing logic {open ? '▴' : '▾'}</button>
        )}
        <button style={btn(false)}>Select transfer →</button>
      </div>

      {/* OPERATOR-ONLY rule trace (never shown to guests) */}
      {operator && open && option.ruleTrace && (
        <div style={{ marginTop: 12, background: T.bg, border: `1px solid ${T.borderGold}`, borderRadius: 12, padding: '13px 15px' }}>
          <div style={{ color: T.gold, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            Routing logic · operator only · hidden from guest
          </div>
          {option.ruleTrace.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, padding: '6px 0', borderTop: i ? `1px solid ${T.border}` : 'none' }}>
              <span style={{ color: T.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1, minWidth: 90, textTransform: 'uppercase', paddingTop: 1 }}>{i + 1} · {r.layer}</span>
              <span style={{ color: r.highlight ? T.goldLight : T.textMid, fontSize: 11.5, lineHeight: 1.45 }}>{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Node({ leg, which }) {
  const code = which === 'from' ? leg.from : leg.to;
  const dep = which === 'from' ? leg.depTime : undefined;
  const arr = which === 'to' ? leg.arrTime : (which === 'from' ? undefined : leg.arrTime);
  const isIATA = code && code.length <= 3 && code === (code || '').toUpperCase();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 58, flex: '0 0 auto', textAlign: 'center' }}>
      <div style={{ width: 9, height: 9, borderRadius: 999, border: `2px solid ${T.gold}`, background: which === 'to' ? T.gold : 'transparent', marginBottom: 6 }} />
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: isIATA ? 18 : 12, fontWeight: 700, color: T.text, lineHeight: 1 }}>{code}</div>
      {(dep || arr || leg.wait) && (
        <div style={{ color: which === 'to' ? T.goldLight : T.textMid, fontSize: 10, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          {which === 'from' ? (leg.depTime || '') : (leg.arrTime || '')}
        </div>
      )}
      {which === 'from' && leg.wait && <div style={{ color: T.textDim, fontSize: 8.5, marginTop: 1 }}>⏱ {leg.wait}</div>}
    </div>
  );
}

const btn = (gold) => ({
  fontFamily: "'Jost',sans-serif", fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
  padding: '8px 14px', borderRadius: 9,
  background: gold ? 'transparent' : `linear-gradient(135deg, ${T.gold}, ${T.goldLight})`,
  color: gold ? T.gold : '#0a0a0a',
  border: gold ? `1px solid ${T.borderGold}` : 'none',
});

// ════════════════════════════════════════════════════════════════════════════
// DEMO HARNESS — delete in app. Demo TransferOptions use your real StructuredLeg
// shape; `wait`, `preferred`, `alert`, `ruleTrace`, badge `star/operatorOnly`
// are display-only extras the resolver can emit.
// ════════════════════════════════════════════════════════════════════════════
const ROUTES = {
  sabiVfa: {
    id: 'recommended', mode: 'commercial', icon: '✈', recommended: true,
    label: 'Sabi Sand → Victoria Falls', duration: '≈5h 50m', estimatedCostZAR: 10740,
    badges: [{ text: 'Direct — no JNB', color: '#4ade80' }, { text: 'Specialist routing', color: '#d4af37' }, { text: 'Preferred carrier', color: '#d4af37', star: true, operatorOnly: true }],
    alert: { tone: 'info', text: 'FedAir leg: 20kg, hard cases permitted.' },
    structuredLegs: [
      { kind: 'exit', badge: 'FA', name: 'Federal Air', from: 'Lodge', to: 'MQP', depTime: '09:00', detail: 'Lowveld Shuttle' },
      { kind: 'commercial', badge: 'TC', name: 'Fastjet', from: 'MQP', to: 'VFA', depTime: '12:45', arrTime: '14:30', detail: 'FN8802 · group', preferred: true, wait: '2h10' },
      { kind: 'road', badge: 'road', name: 'Private transfer', from: 'VFA', to: 'Lodge', arrTime: '≈14:50', detail: '20 min' },
    ],
    ruleTrace: [
      { layer: 'Instruction', text: 'Priority 1 — direct MQP→VFA avoids JNB transit (saves ~1.5h).' },
      { layer: 'Specialist KB', text: 'Prefer direct HDS/MQP routing over JNB when the commercial leg lands at the correct hub.' },
      { layer: 'Preferred carrier', highlight: true, text: 'Group carrier Fastjet FN8802 chosen ahead of Airlink 4Z476 (1h earlier). Same-day, within tolerance.' },
      { layer: 'Margin', text: 'Flight +8% · Transfer +20%. Margin captured: R1,440 pp.' },
    ],
  },
  okavangoVfa: {
    id: 'okv', mode: 'charter', icon: '✈', recommended: true,
    label: 'Okavango → Victoria Falls', duration: '≈2h 40m', estimatedCostZAR: 9500,
    badges: [{ text: 'Same-day via Kasane', color: '#4ade80' }, { text: 'Preferred carrier', color: '#d4af37', star: true, operatorOnly: true }],
    alert: { tone: 'warn', text: 'Only reliable same-day routing — via JNB forces a Johannesburg overnight. 20kg soft bag, no hard cases.' },
    structuredLegs: [
      { kind: 'exit', badge: 'MA', name: 'Mack Air', from: 'Camp', to: 'BBK', depTime: '~10:00', detail: 'Soft bag only' },
      { kind: 'commercial', badge: 'MA', name: 'Mack Air MKB301', from: 'BBK', to: 'VFA', depTime: '12:00', arrTime: '12:20', detail: 'Kasane→Falls', preferred: true, wait: '1h' },
      { kind: 'road', badge: 'road', name: 'Private transfer', from: 'VFA', to: 'Lodge', arrTime: '≈12:40', detail: '20 min' },
    ],
    ruleTrace: [
      { layer: 'Instruction', text: 'No same-day scheduled path via JNB. Charter via Kasane is the only same-day crossing.' },
      { layer: 'Specialist KB', text: 'Mack Air MKB301 BBK→VFA (20 min) is the seamless Delta↔Falls connector.' },
      { layer: 'Preferred carrier', highlight: true, text: 'Mack Air (group carrier) — primary Delta charter operator.' },
      { layer: 'Margin', text: 'Transfer +20% across charter legs. Margin captured: R1,580 pp.' },
    ],
  },
  cptOkv: {
    id: 'cpt', mode: 'combo', icon: '✈', recommended: true,
    label: 'Cape Town → Okavango', duration: '≈4h', estimatedCostZAR: 12180,
    badges: [{ text: 'Nonstop from Cape Town', color: '#4ade80' }, { text: 'No JNB backtrack', color: '#d4af37' }],
    alert: { tone: 'info', text: 'Delta charter: 20kg soft bag.' },
    structuredLegs: [
      { kind: 'commercial', badge: '4Z', name: 'Airlink 4Z314', from: 'CPT', to: 'MUB', depTime: '10:35', arrTime: '13:05', detail: 'Only nonstop CPT–Maun' },
      { kind: 'arrival', badge: 'WA', name: 'Wilderness / Mack', from: 'MUB', to: 'Camp', arrTime: '≈14:35', detail: 'Charter to camp', preferred: true, wait: '1h' },
    ],
    ruleTrace: [
      { layer: 'Instruction', text: 'CPT secondary hub — direct CPT→MUB avoids JNB backtrack.' },
      { layer: 'Specialist KB', text: 'Only nonstop CPT–MUB is 4Z314. Charter boards ≥1h after landing.' },
      { layer: 'Preferred carrier', highlight: true, text: 'Wilderness Air included in lodge rate (no double-bill); Mack Air for independents.' },
      { layer: 'Margin', text: 'Flight +8% · Transfer +20%. Margin captured: R1,410 pp.' },
    ],
  },
};

export default function App() {
  const [routeKey, setRouteKey] = useState('sabiVfa');
  const [mode, setMode] = useState('traveller');
  const [logos, setLogos] = useState({});
  const refs = useRef({});
  const route = ROUTES[routeKey];
  const usedBadges = [...new Set(route.structuredLegs.map(l => l.badge).filter(b => CARRIER[b] && b !== 'road'))];

  const pick = (badge, file) => {
    if (!file) return;
    const r = new FileReader(); r.onload = () => setLogos(p => ({ ...p, [badge]: r.result })); r.readAsDataURL(file);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '28px 18px 50px', fontFamily: "'Jost',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600&display=swap');*{box-sizing:border-box}button:hover{filter:brightness(1.12)}::-webkit-scrollbar{height:6px}::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:3px}`}</style>

      <div style={{ maxWidth: 760, margin: '0 auto 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, color: T.text }}>Transfer tile · horizontal</div>
        <div style={{ display: 'flex', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 9, padding: 3 }}>
          {['traveller', 'operator'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: 7, fontSize: 11.5, fontFamily: "'Jost',sans-serif", textTransform: 'capitalize', background: mode === m ? T.gold : 'transparent', color: mode === m ? '#0a0a0a' : T.textMid, fontWeight: mode === m ? 600 : 400 }}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto 12px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {Object.entries(ROUTES).map(([k, r]) => (
          <button key={k} onClick={() => setRouteKey(k)} style={{ cursor: 'pointer', fontFamily: "'Jost',sans-serif", fontSize: 11, padding: '6px 11px', borderRadius: 16, border: `1px solid ${routeKey === k ? T.borderGold : T.border}`, background: routeKey === k ? T.goldDim : 'transparent', color: routeKey === k ? T.gold : T.textMid }}>{r.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <TransferTimeline option={route} logos={logos} mode={mode} />
      </div>

      {/* preview uploader so you can see the big logos render */}
      <div style={{ maxWidth: 760, margin: '20px auto 0', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ color: T.gold, fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>Preview — drop a logo to see it big (real upload → Supabase)</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {usedBadges.map(b => (
            <div key={b} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
              <Logo badge={b} logos={logos} size={48} />
              <input ref={el => refs.current[b] = el} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => pick(b, e.target.files?.[0])} />
              <button onClick={() => refs.current[b]?.click()} style={{ ...btn(true), fontSize: 10, padding: '5px 9px' }}>{CARRIER[b].name}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
