'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/quote-simulator/page.tsx — SIMPLE + POWERFUL
//
// Tap a hotel → instantly added to itinerary (cart pattern).
// Everything edits inline. Pricing is always visible and live.
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

const HOTELS = [
  { id: 1, name: 'Singita Boulders Lodge', destination: 'Sabi Sand', region: 'kruger-sabi-sand', netRate: 56000, trustScore: 99 },
  { id: 2, name: 'Londolozi Tree Camp', destination: 'Sabi Sand', region: 'kruger-sabi-sand', netRate: 48000, trustScore: 97 },
  { id: 3, name: 'Wilderness Mombo Camp', destination: 'Okavango', region: 'okavango-delta', netRate: 62000, trustScore: 98 },
  { id: 4, name: 'andBeyond Xaranna', destination: 'Okavango', region: 'okavango-delta', netRate: 52000, trustScore: 95 },
  { id: 5, name: 'Matetsi Victoria Falls', destination: 'Victoria Falls', region: 'chobe-vic-falls', netRate: 38000, trustScore: 96 },
  { id: 6, name: 'Ellerman House', destination: 'Cape Town', region: 'cape-town', netRate: 28000, trustScore: 94 },
  { id: 7, name: 'Jamala Madikwe', destination: 'Madikwe', region: 'madikwe', netRate: 28000, trustScore: 93 },
  { id: 8, name: 'Mara Plains Camp', destination: 'Masai Mara', region: 'masai-mara', netRate: 42000, trustScore: 96 },
];

const TRANSFERS: Record<string, { id: string; label: string; costZAR: number; duration: string }[]> = {
  'kruger-sabi-sand': [
    { id: 'fed-air', label: 'Federal Air charter', costZAR: 3800, duration: '1h 30m' },
    { id: 'road', label: 'Private road transfer', costZAR: 2200, duration: '4–5 hrs' },
  ],
  'okavango-delta': [
    { id: 'charter', label: 'Light aircraft charter', costZAR: 6800, duration: '45 min' },
    { id: 'maun', label: 'Via Maun + charter', costZAR: 9200, duration: '3–4 hrs' },
  ],
  'cape-town': [
    { id: 'private', label: 'Private transfer', costZAR: 2800, duration: '30–45 min' },
    { id: 'heli', label: 'Helicopter transfer', costZAR: 18000, duration: '12 min' },
  ],
  'chobe-vic-falls': [
    { id: 'airlink', label: 'Airlink + lodge transfer', costZAR: 8500, duration: '3h 30m' },
  ],
  'madikwe': [
    { id: 'charter', label: 'Federal Air charter', costZAR: 3200, duration: '1h 15m' },
    { id: 'road', label: 'Road from JNB', costZAR: 1500, duration: '4.5 hrs' },
  ],
  'masai-mara': [
    { id: 'charter', label: 'Light aircraft charter', costZAR: 6800, duration: '45 min' },
  ],
};

const ACTIVITIES = [
  { id: 'game-drive', label: 'Game drives', netRate: 6000 },
  { id: 'mokoro', label: 'Helicopter mokoro', netRate: 9000 },
  { id: 'hide', label: 'Photographic hide', netRate: 6000 },
  { id: 'gorilla', label: 'Gorilla trekking', netRate: 15000 },
  { id: 'guide', label: 'Private guide', netRate: 11000 },
];

const MARGINS: MarginConfig = { hotels: 1.15, flights: 1.08, transfers: 1.20, activities: 1.18 };

interface Stay {
  uid: string;
  hotelId: number;
  nights: number;
  transferId?: string;
  activities: string[];
}

const fmt = (n: number) => 'R' + Math.round(n).toLocaleString();
const pct = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export default function QuoteSimulatorPage() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [budget, setBudget] = useState(600000);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // TAP TO ADD — one click adds the hotel with 3 default nights
  const addHotel = (hotelId: number) => {
    setStays(prev => [...prev, { uid: `${hotelId}-${Date.now()}`, hotelId, nights: 3, activities: [] }]);
  };

  const removeStay = (uid: string) => setStays(prev => prev.filter(s => s.uid !== uid));

  const setNights = (uid: string, nights: number) =>
    setStays(prev => prev.map(s => s.uid === uid ? { ...s, nights } : s));

  const setTransfer = (uid: string, transferId: string) =>
    setStays(prev => prev.map(s => s.uid === uid ? { ...s, transferId } : s));

  const toggleActivity = (uid: string, actId: string) =>
    setStays(prev => prev.map(s => {
      if (s.uid !== uid) return s;
      return { ...s, activities: s.activities.includes(actId) ? s.activities.filter(a => a !== actId) : [...s.activities, actId] };
    }));

  // How many times each hotel is in the itinerary (for the badge)
  const hotelCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    stays.forEach(s => { counts[s.hotelId] = (counts[s.hotelId] || 0) + 1; });
    return counts;
  }, [stays]);

  // Build pricing lines
  const lines: RawLine[] = useMemo(() => {
    const result: RawLine[] = [];
    stays.forEach((stay, idx) => {
      const hotel = HOTELS.find(h => h.id === stay.hotelId);
      if (!hotel) return;

      result.push({
        pillar: 'hotel',
        label: hotel.name,
        location: hotel.destination,
        netZar: hotel.netRate * stay.nights,
        nights: stay.nights,
        source: 'contract',
      });

      if (stay.transferId && idx > 0) {
        const prevHotel = HOTELS.find(h => h.id === stays[idx - 1].hotelId);
        if (prevHotel) {
          const t = (TRANSFERS[prevHotel.region] || []).find(x => x.id === stay.transferId);
          if (t) {
            result.push({
              pillar: 'transfer',
              label: `${prevHotel.destination} → ${hotel.destination}`,
              location: 'Inter-camp',
              netZar: t.costZAR,
              source: 'supplier_data',
            });
          }
        }
      }

      stay.activities.forEach(actId => {
        const act = ACTIVITIES.find(a => a.id === actId);
        if (act) {
          result.push({
            pillar: 'activity',
            label: act.label,
            location: hotel.destination,
            netZar: act.netRate,
            source: 'KB',
          });
        }
      });
    });
    return result;
  }, [stays]);

  const audit = useMemo(() => auditItinerary({ lines, budgetZar: budget, margins: MARGINS }), [lines, budget]);
  const totalNights = stays.reduce((s, x) => s + x.nights, 0);

  const utilColor = audit.budget.utilisationPct > 105 ? T.red : audit.budget.utilisationPct > 90 ? T.green : T.amber;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost',sans-serif", fontWeight: 300, padding: 'clamp(16px,3vw,40px)' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>Admin</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 34, fontWeight: 300, lineHeight: 1.05 }}>Quote Simulator</h1>
          <p style={{ color: T.textMid, fontSize: 14, marginTop: 6 }}>Tap a lodge to add it. Edit nights, transfers, and activities inline. Pricing updates live.</p>
        </div>

        {/* Controls bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Adults"><Stepper value={adults} onChange={setAdults} min={1} max={8} /></Field>
          <Field label="Children"><Stepper value={children} onChange={setChildren} min={0} max={6} /></Field>
          <Field label="Budget (ZAR)">
            <input type="number" step={50000} value={budget} onChange={e => setBudget(parseInt(e.target.value) || 0)}
              style={{ background: T.surface2, border: `0.5px solid ${T.border}`, color: T.text, padding: '9px 12px', borderRadius: 8, fontSize: 14, width: 140 }} />
          </Field>
        </div>

        {/* Main: hotel menu (left) + itinerary (right) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 20, alignItems: 'start' }}>

          {/* Hotel menu — tap to add */}
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 16, position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Tap to add a lodge</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {HOTELS.map(hotel => {
                const count = hotelCounts[hotel.id] || 0;
                return (
                  <button
                    key={hotel.id}
                    onClick={() => addHotel(hotel.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: count > 0 ? 'rgba(212,175,55,0.08)' : T.surface2,
                      border: count > 0 ? `1px solid rgba(212,175,55,0.4)` : `0.5px solid ${T.border}`,
                      borderRadius: 10,
                      padding: '11px 14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s',
                      width: '100%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = count > 0 ? 'rgba(212,175,55,0.4)' : T.border; }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: T.text, marginBottom: 3 }}>{hotel.name}</div>
                      <div style={{ fontSize: 11, color: T.textMid }}>{hotel.destination} · {fmt(hotel.netRate)}/n</div>
                    </div>
                    {count > 0 ? (
                      <div style={{ background: T.gold, color: T.bg, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{count}</div>
                    ) : (
                      <div style={{ color: T.gold, fontSize: 18, flexShrink: 0, lineHeight: 1 }}>+</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Itinerary + pricing */}
          <div style={{ display: 'grid', gap: 16 }}>

            {/* Live pricing — always visible at top */}
            <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))', border: `0.5px solid rgba(212,175,55,0.25)`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
                <Metric label="Display total" value={fmt(audit.totals.displayZar)} sub={`Net ${fmt(audit.totals.netZar)}`} color={T.text} />
                <Metric label="Total margin" value={fmt(audit.totals.marginZar)} sub={`${pct(audit.totals.blendedMarginPct)}% blended`} color={T.gold} big />
                <Metric label="Budget used" value={`${pct(audit.budget.utilisationPct)}%`} sub={audit.budget.status.replace('_', ' ')} color={utilColor} />
                <Metric label="Per night" value={totalNights > 0 ? fmt(audit.totals.marginZar / totalNights) : 'R0'} sub={`${totalNights}n total`} color={T.textMid} />
              </div>
              {/* Utilisation bar */}
              <div style={{ marginTop: 14, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, audit.budget.utilisationPct)}%`, height: '100%', background: `linear-gradient(90deg, ${utilColor}aa, ${utilColor})`, borderRadius: 5, transition: 'width 0.25s' }} />
              </div>
            </div>

            {/* Itinerary stays */}
            {stays.length === 0 ? (
              <div style={{ background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 14, padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>🏕</div>
                <div style={{ color: T.textMid, fontSize: 14 }}>Tap a lodge on the left to start building</div>
              </div>
            ) : (
              stays.map((stay, idx) => {
                const hotel = HOTELS.find(h => h.id === stay.hotelId)!;
                const prevHotel = idx > 0 ? HOTELS.find(h => h.id === stays[idx - 1].hotelId) : null;
                const transferOpts = prevHotel ? (TRANSFERS[prevHotel.region] || []) : [];
                const stayNet = hotel.netRate * stay.nights;
                const stayDisplay = Math.round(stayNet * MARGINS.hotels);

                return (
                  <div key={stay.uid}>
                    {/* Transfer connector (between stays) */}
                    {idx > 0 && transferOpts.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 12px 0' }}>
                        <div style={{ color: T.textDim, fontSize: 16 }}>↓</div>
                        <select
                          value={stay.transferId || ''}
                          onChange={e => setTransfer(stay.uid, e.target.value)}
                          style={{
                            flex: 1,
                            background: stay.transferId ? 'rgba(96,165,250,0.08)' : T.surface,
                            border: `0.5px solid ${stay.transferId ? 'rgba(96,165,250,0.3)' : T.border}`,
                            color: stay.transferId ? T.text : T.textMid,
                            padding: '9px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">+ Add transfer from {prevHotel?.destination}...</option>
                          {transferOpts.map(t => (
                            <option key={t.id} value={t.id}>🚐 {t.label} · {fmt(t.costZAR)} · {t.duration}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Stay card */}
                    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, color: T.text, marginBottom: 3 }}>{hotel.name}</div>
                          <div style={{ fontSize: 12, color: T.textMid }}>{hotel.destination} · Trust {hotel.trustScore}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, color: T.gold }}>{fmt(stayDisplay)}</div>
                          <button onClick={() => removeStay(stay.uid)} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 13, padding: '4px 0 0 0' }}>Remove</button>
                        </div>
                      </div>

                      {/* Nights stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 50 }}>Nights</span>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <button
                              key={n}
                              onClick={() => setNights(stay.uid, n)}
                              style={{
                                width: 34,
                                height: 34,
                                background: stay.nights === n ? T.gold : 'rgba(255,255,255,0.04)',
                                border: `0.5px solid ${stay.nights === n ? T.gold : T.border}`,
                                color: stay.nights === n ? T.bg : T.text,
                                borderRadius: 8,
                                fontSize: 13,
                                cursor: 'pointer',
                                fontWeight: stay.nights === n ? 600 : 300,
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Activities */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 50, paddingTop: 6 }}>Extras</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ACTIVITIES.map(act => {
                            const on = stay.activities.includes(act.id);
                            return (
                              <button
                                key={act.id}
                                onClick={() => toggleActivity(stay.uid, act.id)}
                                style={{
                                  background: on ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                                  border: `0.5px solid ${on ? T.violet : T.border}`,
                                  color: on ? T.violet : T.textMid,
                                  padding: '6px 11px',
                                  borderRadius: 16,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  fontWeight: on ? 500 : 300,
                                }}
                              >
                                {on ? '✓ ' : '+ '}{act.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pillar breakdown (only when there are stays) */}
            {stays.length > 0 && (
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Margin by pillar</div>
                {audit.byPillar.map(p => (
                  <div key={p.pillar} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ textTransform: 'capitalize' }}>{p.pillar} <span style={{ color: T.textDim }}>· {p.lines} line{p.lines > 1 ? 's' : ''}</span></span>
                      <span><b style={{ color: T.gold }}>{fmt(p.marginZar)}</b> <span style={{ color: T.textDim }}>({pct(p.marginPct)}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (p.marginZar / Math.max(...audit.byPillar.map(x => x.marginZar), 1)) * 100)}%`, height: '100%', background: T.gold, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
                {(audit.dataGaps.length > 0 || audit.floorBreaches.length > 0) && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${T.border}` }}>
                    {audit.dataGaps.length > 0 && <div style={{ fontSize: 11, color: T.amber }}>⚠ {audit.dataGaps.length} data gap(s)</div>}
                    {audit.floorBreaches.length > 0 && <div style={{ fontSize: 11, color: T.red }}>⚠ {audit.floorBreaches.length} below margin floor</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Stepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: T.surface2, border: `0.5px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{ background: 'none', border: 'none', color: T.text, cursor: 'pointer', padding: '9px 14px', fontSize: 16 }}>−</button>
      <span style={{ minWidth: 28, textAlign: 'center', fontSize: 14 }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={{ background: 'none', border: 'none', color: T.text, cursor: 'pointer', padding: '9px 14px', fontSize: 16 }}>+</button>
    </div>
  );
}

function Metric({ label, value, sub, color, big }: { label: string; value: string; sub: string; color: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: big ? 30 : 24, fontWeight: 400, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.textMid, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
