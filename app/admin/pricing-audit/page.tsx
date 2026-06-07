'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/pricing-audit/page.tsx
//
// THE PRICING ENGINE DEMO + PER-ITINERARY AUDIT TOOL.
// Renders the full margin teardown for any itinerary: net vs display per pillar,
// blended margin in RAND, budget utilisation, floor breaches, data gaps, and the
// highest-margin-rand ways to fill remaining budget headroom.
//
// Computes locally via lib/pricingEngine so it always renders (admin-only page).
// The traveller-facing flow uses POST /api/itinerary-margin-audit (server-side
// margins). Drop a real booking's components into SAMPLE to demo a live quote.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { auditItinerary, type RawLine, type UpsellCandidate, type MarginConfig } from '@/app/lib/pricingEngine';

const T = {
  bg: '#0a0a0a', bg2: '#111', surface: '#1a1a1a', surface2: '#222',
  gold: '#d4af37', goldLight: '#f0c040',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', red: '#f87171', amber: '#fb923c', blue: '#60a5fa', violet: '#a78bfa',
};

const PILLAR_COLOR: Record<string, string> = {
  hotel: T.green, flight: T.gold, transfer: T.blue, activity: T.violet, upgrade: T.goldLight,
};

// Standard Safari Edition margins (same as env defaults).
const MARGINS: MarginConfig = { hotels: 1.15, flights: 1.08, transfers: 1.20, activities: 1.18 };

// ── DEMO SAMPLE — a realistic 7-night Sabi Sand + Okavango couple ─────────────
// Replace netZar values with your live Curated 10 rates to demo real numbers.
const SAMPLE_LINES: RawLine[] = [
  { pillar: 'hotel',    label: 'Singita Sabi Sand · 4 nights', location: 'Sabi Sand', netZar: 56000 * 4, nights: 4, source: 'contract' },
  { pillar: 'hotel',    label: 'Mombo Camp · 3 nights',         location: 'Okavango',  netZar: 62000 * 3, nights: 3, source: 'contract' },
  { pillar: 'transfer', label: 'Sabi → Okavango light aircraft', location: 'Inter-camp', netZar: 18000, source: 'supplier_data' },
  { pillar: 'flight',   label: 'LHR → JNB return × 2',           location: 'International', netZar: 42000, source: 'supplier_data' },
  { pillar: 'activity', label: 'Helicopter mokoro experience',   location: 'Okavango',  netZar: 9000, source: 'KB' },
];

const SAMPLE_CANDIDATES: UpsellCandidate[] = [
  { pillar: 'upgrade',  label: 'Singita → private exclusive-use villa (4n)', netZar: 24000 * 4 },
  { pillar: 'activity', label: 'Private photographic hide day',              netZar: 6000 },
  { pillar: 'transfer', label: 'Helicopter scenic transfer upgrade',         netZar: 14000 },
  { pillar: 'hotel',    label: '+2 nights Cape Town (Ellerman House)',       netZar: 19000 * 2, nights: 2 },
  { pillar: 'activity', label: 'Private guide + vehicle (whole stay)',       netZar: 11000 },
];

const fmt = (n: number) => 'R' + Math.round(n).toLocaleString();

export default function PricingAuditPage() {
  const [budget, setBudget] = useState(600000);

  const audit = useMemo(
    () => auditItinerary({ lines: SAMPLE_LINES, budgetZar: budget, margins: MARGINS, candidates: SAMPLE_CANDIDATES }),
    [budget]
  );

  const gaugeColor = audit.budget.status === 'on_target' ? T.green : audit.budget.status === 'over' ? T.red : T.amber;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost',sans-serif", fontWeight: 300, padding: 'clamp(20px,4vw,48px)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>The Pricing Engine · Live Audit</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 300, lineHeight: 1.05 }}>Per-Itinerary Margin Teardown</h1>
          <p style={{ color: T.textMid, fontSize: 14, marginTop: 6 }}>Every rand of margin, where it sits, and how much budget headroom is still on the table.</p>
        </div>

        {/* Headline numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 26 }}>
          <HeadlineCard label="Total margin (RAND)" value={fmt(audit.totals.marginZar)} sub={`${audit.totals.blendedMarginPct}% blended`} color={T.gold} big />
          <HeadlineCard label="Display total" value={fmt(audit.totals.displayZar)} sub={`Net cost ${fmt(audit.totals.netZar)}`} color={T.text} />
          <HeadlineCard label="Budget utilisation" value={`${audit.budget.utilisationPct}%`} sub={audit.budget.status.replace('_', ' ')} color={gaugeColor} />
          <HeadlineCard label="Money left on table" value={fmt(audit.headroomMarginAtBlend)} sub={`${fmt(audit.budget.headroomZar)} unused budget`} color={audit.budget.headroomZar > 5000 ? T.amber : T.green} />
        </div>

        {/* Budget slider — demo lever */}
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 22px', marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 12, letterSpacing: '0.1em', color: T.textMid, textTransform: 'uppercase' }}>Traveller budget</span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, color: T.gold }}>{fmt(budget)}</span>
          </div>
          <input type="range" min={300000} max={1200000} step={10000} value={budget}
            onChange={e => setBudget(+e.target.value)}
            style={{ width: '100%', accentColor: T.gold }} />
          {/* Utilisation gauge */}
          <div style={{ marginTop: 14, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, audit.budget.utilisationPct)}%`, background: `linear-gradient(90deg, ${gaugeColor}aa, ${gaugeColor})`, borderRadius: 6, transition: 'width .25s' }} />
          </div>
          <div style={{ fontSize: 12, color: T.textMid, marginTop: 8 }}>
            {audit.budget.status === 'under' && <>This itinerary uses only <b style={{ color: T.amber }}>{audit.budget.utilisationPct}%</b> of stated budget — <b style={{ color: T.amber }}>{fmt(audit.budget.headroomZar)}</b> of willingness-to-pay is untouched.</>}
            {audit.budget.status === 'on_target' && <>On target — capturing <b style={{ color: T.green }}>{audit.budget.utilisationPct}%</b> of stated budget.</>}
            {audit.budget.status === 'over' && <><b style={{ color: T.red }}>{fmt(audit.budget.overBudgetZar)}</b> over budget — trim before quoting.</>}
          </div>
        </div>

        {/* Per-pillar breakdown */}
        <SectionTitle>Margin by pillar</SectionTitle>
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 26 }}>
          {audit.byPillar.map(p => {
            const w = audit.totals.marginZar > 0 ? (p.marginZar / audit.totals.marginZar) * 100 : 0;
            return (
              <div key={p.pillar} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ textTransform: 'capitalize' }}><span style={{ color: PILLAR_COLOR[p.pillar] }}>●</span> {p.pillar} <span style={{ color: T.textDim }}>· {p.lines} line{p.lines > 1 ? 's' : ''}</span></span>
                  <span><b style={{ color: T.gold }}>{fmt(p.marginZar)}</b> <span style={{ color: T.textDim }}>({p.marginPct}%)</span></span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: PILLAR_COLOR[p.pillar], borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Line items */}
        <SectionTitle>Line items</SectionTitle>
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 26 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr', padding: '12px 18px', fontSize: 11, letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase', borderBottom: `0.5px solid ${T.border}` }}>
            <span>Component</span><span style={{ textAlign: 'right' }}>Net</span><span style={{ textAlign: 'right' }}>Display</span><span style={{ textAlign: 'right' }}>Margin</span><span style={{ textAlign: 'right' }}>Source</span>
          </div>
          {audit.lines.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.8fr', padding: '12px 18px', fontSize: 13, borderBottom: i < audit.lines.length - 1 ? `0.5px solid ${T.border}` : 'none', background: l.floorBreach ? 'rgba(248,113,113,0.05)' : l.dataGap ? 'rgba(251,146,60,0.05)' : 'transparent' }}>
              <span><span style={{ color: PILLAR_COLOR[l.pillar] }}>●</span> {l.label}{l.floorBreach && <span style={{ color: T.red, fontSize: 11 }}> ⚠ below floor</span>}{l.dataGap && <span style={{ color: T.amber, fontSize: 11 }}> ⚠ no rate</span>}</span>
              <span style={{ textAlign: 'right', color: T.textMid }}>{fmt(l.netZar)}</span>
              <span style={{ textAlign: 'right' }}>{fmt(l.displayZar)}</span>
              <span style={{ textAlign: 'right', color: T.gold }}>{fmt(l.marginZar)} <span style={{ color: T.textDim, fontSize: 11 }}>{l.marginPct}%</span></span>
              <span style={{ textAlign: 'right', fontSize: 11, color: l.source === 'fallback' || l.source === 'estimate' ? T.amber : T.textMid }}>{l.source}</span>
            </div>
          ))}
        </div>

        {/* Upsell optimiser */}
        {audit.upsells.length > 0 && (
          <>
            <SectionTitle>Fill the headroom · ranked by margin RAND</SectionTitle>
            <div style={{ background: 'rgba(212,175,55,0.05)', border: `0.5px solid rgba(212,175,55,0.2)`, borderRadius: 14, padding: 20, marginBottom: 26 }}>
              <p style={{ fontSize: 13, color: T.textMid, marginBottom: 14 }}>The engine has <b style={{ color: T.gold }}>{fmt(audit.budget.headroomZar)}</b> of budget headroom. Highest-margin-rand ways to capture it without exceeding budget:</p>
              {audit.upsells.map((u, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < audit.upsells.length - 1 ? `0.5px solid ${T.border}` : 'none' }}>
                  <span style={{ fontSize: 13 }}><span style={{ color: PILLAR_COLOR[u.pillar] }}>●</span> {u.label}</span>
                  <span style={{ fontSize: 13 }}>+{fmt(u.addsDisplay)} → <b style={{ color: T.gold }}>+{fmt(u.addsMargin)} margin</b></span>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <b>Total additional margin available</b>
                <b style={{ color: T.gold }}>+{fmt(audit.upsells.reduce((s, u) => s + u.addsMargin, 0))}</b>
              </div>
            </div>
          </>
        )}

        {/* Alarms */}
        {(audit.floorBreaches.length > 0 || audit.dataGaps.length > 0) && (
          <>
            <SectionTitle>Alarms</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginBottom: 40 }}>
              <AlarmCard title="Margin-floor breaches" color={T.red} items={audit.floorBreaches.map(l => `${l.label} — ${l.marginPct}%`)} empty="All pillars above floor." />
              <AlarmCard title="Missing pricing data" color={T.amber} items={audit.dataGaps.map(l => `${l.label} — ${l.source}`)} empty="Every line has a sourced rate." />
            </div>
          </>
        )}

      </div>
    </div>
  );
}

function HeadlineCard({ label, value, sub, color, big }: { label: string; value: string; sub: string; color: string; big?: boolean }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', color: T.textDim, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: big ? 40 : 30, fontWeight: 400, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textMid, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: any }) {
  return <div style={{ fontSize: 12, letterSpacing: '0.12em', color: T.textMid, textTransform: 'uppercase', marginBottom: 12 }}>{children}</div>;
}

function AlarmCard({ title, color, items, empty }: { title: string; color: string; items: string[]; empty: string }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, color, marginBottom: 10, fontWeight: 500 }}>{title}</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: T.textMid }}>✓ {empty}</div>
        : items.map((it, i) => <div key={i} style={{ fontSize: 12, color: T.textMid, padding: '4px 0' }}>• {it}</div>)}
    </div>
  );
}
