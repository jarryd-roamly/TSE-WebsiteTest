'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/quote-simulator/page.tsx — FIXED VERSION
//
// QUOTE SIMULATOR: Build multiple test itineraries in the UI. For each,
// run the pricing engine. Compare margins, budgets, utilisation side-by-side.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { auditItinerary, type RawLine, type MarginConfig } from '@/app/lib/pricingEngine';

const T = {
  bg: '#0a0a0a', bg2: '#111', surface: '#1a1a1a', surface2: '#222',
  gold: '#d4af37', goldLight: '#f0c040',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', red: '#f87171', amber: '#fb923c', blue: '#60a5fa', violet: '#a78bfa',
};

interface ItineraryBuilder {
  id: string;
  name: string;
  nights: number;
  adults: number;
  children: number;
  budget: number;
  components: {
    id: string;
    pillar: 'hotel' | 'flight' | 'transfer' | 'activity';
    label: string;
    location: string;
    netZar: number;
    nights?: number;
  }[];
}

const MARGINS: MarginConfig = { hotels: 1.15, flights: 1.08, transfers: 1.20, activities: 1.18 };

const PRESET_COMPONENTS = {
  hotels: [
    { id: 'h1', label: 'Singita Sabi Sand (net)', location: 'Sabi Sand', netZar: 56000, nights: 4 },
    { id: 'h2', label: 'Mombo Camp (net)', location: 'Okavango', netZar: 62000, nights: 3 },
    { id: 'h3', label: 'Chobe Chilwero (net)', location: 'Chobe', netZar: 31000, nights: 3 },
    { id: 'h4', label: 'Tswalu Kalahari (net)', location: 'Kalahari', netZar: 39000, nights: 3 },
    { id: 'h5', label: 'Ellerman House (net)', location: 'Cape Town', netZar: 19000, nights: 2 },
    { id: 'h6', label: 'Dulini (net)', location: 'Sabi Sand', netZar: 38000, nights: 3 },
  ],
  flights: [
    { id: 'f1', label: 'London → JNB return (net)', location: 'International', netZar: 42000 },
    { id: 'f2', label: 'US → JNB return (net)', location: 'International', netZar: 56000 },
    { id: 'f3', label: 'European return (net)', location: 'International', netZar: 38000 },
  ],
  transfers: [
    { id: 't1', label: 'Light aircraft inter-lodge (net)', location: 'Inter-camp', netZar: 18000 },
    { id: 't2', label: 'Road transfer + return (net)', location: 'Multi', netZar: 8000 },
    { id: 't3', label: 'Helicopter scenic transfer (net)', location: 'Multi', netZar: 28000 },
    { id: 't4', label: 'Airport road transfer (net)', location: 'Ground', netZar: 4500 },
  ],
  activities: [
    { id: 'a1', label: 'Game drive package (net)', location: 'Multi', netZar: 6000 },
    { id: 'a2', label: 'Helicopter mokoro (net)', location: 'Okavango', netZar: 9000 },
    { id: 'a3', label: 'Private photographic hide (net)', location: 'Multi', netZar: 6000 },
    { id: 'a4', label: 'Gorilla trekking (net)', location: 'Uganda', netZar: 15000 },
    { id: 'a5', label: 'Private guide full stay (net)', location: 'Multi', netZar: 11000 },
  ],
};

const DEFAULT_BUILDERS: ItineraryBuilder[] = [
  {
    id: '1',
    name: 'Sabi Sand Couple (7n)',
    nights: 7,
    adults: 2,
    children: 0,
    budget: 600000,
    components: [
      { id: 'h1', pillar: 'hotel', label: 'Singita Sabi Sand', location: 'Sabi Sand', netZar: 224000, nights: 4 },
      { id: 'h2', pillar: 'hotel', label: 'Mombo Camp', location: 'Okavango', netZar: 186000, nights: 3 },
      { id: 'f1', pillar: 'flight', label: 'LHR → JNB return × 2', location: 'International', netZar: 42000 },
      { id: 't1', pillar: 'transfer', label: 'Light aircraft inter-lodge', location: 'Inter-camp', netZar: 18000 },
      { id: 'a2', pillar: 'activity', label: 'Helicopter mokoro', location: 'Okavango', netZar: 9000 },
    ],
  },
];

const fmt = (n: number) => 'R' + Math.round(n).toLocaleString();
const pct = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export default function QuoteSimulatorPage() {
  const [builders, setBuilders] = useState<ItineraryBuilder[]>(DEFAULT_BUILDERS);
  const [selectedTab, setSelectedTab] = useState('1');
  const activeBuilder = builders.find(b => b.id === selectedTab) || builders[0];
  const activeBuilderIndex = builders.findIndex(b => b.id === selectedTab);

  const audits = useMemo(() => {
    return builders.map(b => {
      const lines: RawLine[] = b.components.map(c => ({
        pillar: c.pillar,
        label: c.label,
        location: c.location,
        netZar: c.netZar,
        nights: c.nights,
        source: 'contract',
      }));
      return auditItinerary({ lines, budgetZar: b.budget, margins: MARGINS });
    });
  }, [builders]);

  // FIX #1: Use index directly instead of label matching
  const audit = activeBuilderIndex >= 0 && audits[activeBuilderIndex] ? audits[activeBuilderIndex] : null;

  const handleAddComponent = (pillar: 'hotel' | 'flight' | 'transfer' | 'activity') => {
    const presets = PRESET_COMPONENTS[pillar === 'hotel' ? 'hotels' : pillar === 'flight' ? 'flights' : pillar === 'transfer' ? 'transfers' : 'activities'];
    const preset = presets[Math.floor(Math.random() * presets.length)];
    const comp = {
      id: Math.random().toString(),
      pillar,
      label: preset.label,
      location: preset.location,
      netZar: preset.netZar,
      nights: preset.nights,
    };
    setBuilders(builders.map(b => b.id === activeBuilder.id ? { ...b, components: [...b.components, comp] } : b));
  };

  const handleRemoveComponent = (compId: string) => {
    setBuilders(builders.map(b => b.id === activeBuilder.id ? { ...b, components: b.components.filter(c => c.id !== compId) } : b));
  };

  const handleAddBuilder = () => {
    const newId = Date.now().toString();
    setBuilders([...builders, {
      id: newId,
      name: `Test #${builders.length + 1}`,
      nights: 7,
      adults: 2,
      children: 0,
      budget: 600000,
      components: [],
    }]);
    setSelectedTab(newId);
  };

  const handleDeleteBuilder = (id: string) => {
    const next = builders.filter(b => b.id !== id);
    if (next.length === 0) return;
    setBuilders(next);
    setSelectedTab(next[0].id);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost',sans-serif", fontWeight: 300, padding: 'clamp(20px,4vw,48px)' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>Product</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 300, lineHeight: 1.05 }}>Quote Simulator</h1>
          <p style={{ color: T.textMid, fontSize: 14, marginTop: 6 }}>Build multiple test itineraries. Run the pricing engine on each. Compare margins, budgets, utilisation side-by-side. Stress-test before launch.</p>
        </div>

        {/* Builder tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, overflowX: 'auto', paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
          {builders.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setSelectedTab(b.id)}
                style={{
                  background: selectedTab === b.id ? T.surface : 'none',
                  border: selectedTab === b.id ? `1px solid ${T.gold}` : 'none',
                  color: selectedTab === b.id ? T.gold : T.textMid,
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: selectedTab === b.id ? 500 : 300,
                }}
              >
                {b.name}
              </button>
              {builders.length > 1 && (
                <button
                  onClick={() => handleDeleteBuilder(b.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: T.red,
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '4px 8px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddBuilder}
            style={{
              background: 'none',
              border: `1px dashed ${T.border}`,
              color: T.textMid,
              padding: '8px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            + New test
          </button>
        </div>

        {/* Two-column layout: builder + audit */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Builder panel */}
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Name</label>
              <input
                type="text"
                value={activeBuilder.name}
                onChange={e => setBuilders(builders.map(b => b.id === activeBuilder.id ? { ...b, name: e.target.value } : b))}
                style={{
                  width: '100%',
                  background: T.surface2,
                  border: `1px solid ${T.border}`,
                  color: T.text,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Nights', key: 'nights', min: 1, max: 21 },
                { label: 'Adults', key: 'adults', min: 1, max: 6 },
                { label: 'Children', key: 'children', min: 0, max: 4 },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{field.label}</label>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={activeBuilder[field.key as 'nights' | 'adults' | 'children']}
                    onChange={e => setBuilders(builders.map(b => b.id === activeBuilder.id ? { ...b, [field.key]: parseInt(e.target.value) || 0 } : b))}
                    style={{
                      width: '100%',
                      background: T.surface2,
                      border: `1px solid ${T.border}`,
                      color: T.text,
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Budget (ZAR)</label>
              <input
                type="number"
                value={activeBuilder.budget}
                onChange={e => setBuilders(builders.map(b => b.id === activeBuilder.id ? { ...b, budget: parseInt(e.target.value) || 0 } : b))}
                style={{
                  width: '100%',
                  background: T.surface2,
                  border: `1px solid ${T.border}`,
                  color: T.text,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 8 }}>Components</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['hotel', 'flight', 'transfer', 'activity'] as const).map(pillar => (
                  <button
                    key={pillar}
                    onClick={() => handleAddComponent(pillar)}
                    style={{
                      background: 'none',
                      border: `1px dashed ${T.border}`,
                      color: T.textMid,
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    + {pillar}
                  </button>
                ))}
              </div>
            </div>

            {/* Component list */}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {activeBuilder.components.map((comp, i) => (
                <div key={comp.id} style={{ background: T.surface2, border: `0.5px solid ${T.border}`, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: T.gold, textTransform: 'uppercase', fontSize: 10 }}>{comp.pillar}</span>
                    <button
                      onClick={() => handleRemoveComponent(comp.id)}
                      style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 14 }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ color: T.text, marginBottom: 4 }}>{comp.label}</div>
                  <div style={{ color: T.textMid, fontSize: 11 }}>{fmt(comp.netZar)}{comp.nights ? ` × ${comp.nights}n` : ''}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit panel */}
          {audit && (
            <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 13, color: T.gold, marginBottom: 14 }}>Pricing Audit</h3>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: T.surface2, borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Total margin</div>
                  <div style={{ fontSize: 20, color: T.gold, fontWeight: 500 }}>{fmt(audit.totals.marginZar)}</div>
                  <div style={{ fontSize: 11, color: T.textMid }}>{pct(audit.totals.blendedMarginPct)}%</div>
                </div>
                <div style={{ background: T.surface2, borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Budget utilisation</div>
                  <div style={{ fontSize: 20, color: audit.budget.utilisationPct > 105 ? T.red : audit.budget.utilisationPct > 90 ? T.green : T.amber, fontWeight: 500 }}>{pct(audit.budget.utilisationPct)}%</div>
                  <div style={{ fontSize: 11, color: T.textMid }}>{audit.budget.status.replace('_', ' ')}</div>
                </div>
              </div>

              {/* Per-pillar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 8 }}>Margin by pillar</div>
                {audit.byPillar.map((p, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ textTransform: 'capitalize' }}>{p.pillar}</span>
                      <span><b style={{ color: T.gold }}>{fmt(p.marginZar)}</b> <span style={{ color: T.textDim }}>({pct(p.marginPct)}%)</span></span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(p.marginZar / Math.max(...audit.byPillar.map(x => x.marginZar))) * 100}%`, height: '100%', background: T.gold, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {(audit.dataGaps.length > 0 || audit.floorBreaches.length > 0) && (
                <div style={{ background: 'rgba(251,146,60,0.05)', border: `0.5px solid rgba(251,146,60,0.2)`, borderRadius: 8, padding: 10 }}>
                  {audit.dataGaps.length > 0 && <div style={{ fontSize: 11, color: T.amber, marginBottom: 4 }}>⚠ {audit.dataGaps.length} data gap(s)</div>}
                  {audit.floorBreaches.length > 0 && <div style={{ fontSize: 11, color: T.red }}>⚠ {audit.floorBreaches.length} floor breach(es)</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comparison table */}
        {builders.length > 1 && audits.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ fontSize: 14, color: T.gold, marginBottom: 12 }}>Scenario comparison</h3>
            <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${builders.length + 1}, 1fr)`, padding: '12px 18px', fontSize: 11, letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase', borderBottom: `0.5px solid ${T.border}`, background: T.surface2 }}>
                <span>Metric</span>
                {builders.map(b => <span key={b.id} style={{ textAlign: 'right' }}>{b.name}</span>)}
              </div>
              {[
                { label: 'Margin RAND', fn: (a: any) => fmt(a.totals.marginZar) },
                { label: 'Margin %', fn: (a: any) => pct(a.totals.blendedMarginPct) },
                { label: 'Utilisation %', fn: (a: any) => pct(a.budget.utilisationPct) },
                { label: 'Per-night margin', fn: (a: any) => fmt(a.totals.marginZar / builders[0].nights) },
              ].map((metric, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${builders.length + 1}, 1fr)`, padding: '12px 18px', borderBottom: i < 3 ? `0.5px solid ${T.border}` : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 12 }}>{metric.label}</span>
                  {audits.map((a, j) => (
                    <span key={j} style={{ textAlign: 'right', fontSize: 12, color: T.gold, fontWeight: 500 }}>{metric.fn(a)}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
