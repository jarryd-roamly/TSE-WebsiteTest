'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/quote-simulator/page.tsx — PROFESSIONAL VERSION
//
// Build multi-stop itineraries like the real booking flow:
// - Select actual hotels from the Curated 10
// - Set nights per hotel
// - Choose transfers between regions
// - Add activities
// - See real margins from pricingEngine in real time
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

// Real hotel data from Curated 10
const HOTELS = [
  { id: 1, name: 'Singita Boulders Lodge', destination: 'Kruger / Sabi Sand', region: 'kruger-sabi-sand', netRate: 56000, image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&q=80', trustScore: 99 },
  { id: 2, name: 'Londolozi Tree Camp', destination: 'Kruger / Sabi Sand', region: 'kruger-sabi-sand', netRate: 48000, image: 'https://images.unsplash.com/photo-1500491460312-c32fc2dbc751?w=400&q=80', trustScore: 97 },
  { id: 3, name: 'Wilderness Mombo Camp', destination: 'Okavango Delta', region: 'okavango-delta', netRate: 62000, image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&q=80', trustScore: 98 },
  { id: 4, name: 'andBeyond Xaranna', destination: 'Okavango Delta', region: 'okavango-delta', netRate: 52000, image: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=400&q=80', trustScore: 95 },
  { id: 5, name: 'Matetsi Victoria Falls', destination: 'Chobe / Victoria Falls', region: 'chobe-vic-falls', netRate: 38000, image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=80', trustScore: 96 },
  { id: 6, name: 'Ellerman House', destination: 'Cape Town', region: 'cape-town', netRate: 28000, image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b814?w=400&q=80', trustScore: 94 },
  { id: 7, name: 'Jamala Madikwe', destination: 'Madikwe', region: 'madikwe', netRate: 28000, image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&q=80', trustScore: 93 },
  { id: 8, name: 'Mara Plains Camp', destination: 'Masai Mara', region: 'masai-mara', netRate: 42000, image: 'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=400&q=80', trustScore: 96 },
];

const TRANSFERS = {
  'kruger-sabi-sand': [
    { id: 'fed-air', label: 'Federal Air charter', provider: 'Federal Air', costZAR: 3800, duration: '1h 30m' },
    { id: 'road', label: 'Private road transfer', provider: 'Private vehicle', costZAR: 2200, duration: '4–5 hrs' },
  ],
  'okavango-delta': [
    { id: 'charter', label: 'Light aircraft charter', provider: 'Wilderness Air / Mack Air', costZAR: 6800, duration: '45 min' },
    { id: 'maun-charter', label: 'Via Maun + charter', provider: 'Commercial to Maun + charter', costZAR: 9200, duration: '3–4 hrs total' },
  ],
  'cape-town': [
    { id: 'private', label: 'Private transfer', provider: 'Private vehicle', costZAR: 2800, duration: '30–45 min' },
    { id: 'helicopter', label: 'Helicopter transfer', provider: 'NAC Helicopters', costZAR: 18000, duration: '12 min' },
  ],
  'chobe-vic-falls': [
    { id: 'airlink', label: 'Airlink VFA → JNB', provider: 'Airlink + lodge transfer', costZAR: 8500, duration: '3h 30m' },
  ],
  'madikwe': [
    { id: 'charter', label: 'Federal Air charter', provider: 'Federal Air', costZAR: 3200, duration: '1h 15m' },
    { id: 'road', label: 'Road from JNB', provider: 'Private 4WD', costZAR: 1500, duration: '4.5–5.5 hrs' },
  ],
  'masai-mara': [
    { id: 'charter', label: 'Light aircraft charter', provider: 'Safarilink / Air Kenya', costZAR: 6800, duration: '45 min' },
  ],
};

const ACTIVITIES = [
  { id: 'game-drive', label: 'Game drive package', netRate: 6000 },
  { id: 'mokoro', label: 'Helicopter mokoro experience', netRate: 9000 },
  { id: 'photographic', label: 'Private photographic hide', netRate: 6000 },
  { id: 'gorilla', label: 'Gorilla trekking', netRate: 15000 },
  { id: 'guide', label: 'Private guide (full stay)', netRate: 11000 },
];

const MARGINS: MarginConfig = { hotels: 1.15, flights: 1.08, transfers: 1.20, activities: 1.18 };

interface City {
  id: string;
  hotelId: number;
  nights: number;
  transfer?: string;
  activities: string[];
}

const fmt = (n: number) => 'R' + Math.round(n).toLocaleString();
const pct = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export default function QuoteSimulatorPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [budget, setBudget] = useState(600000);
  const [pax, setPax] = useState({ adults: 2, children: 0 });
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [selectedNights, setSelectedNights] = useState(4);

  // Add a city to the itinerary
  const handleAddCity = () => {
    if (!selectedHotelId) return;
    const hotel = HOTELS.find(h => h.id === selectedHotelId);
    if (!hotel) return;

    setCities([
      ...cities,
      {
        id: Date.now().toString(),
        hotelId: selectedHotelId,
        nights: selectedNights,
        transfer: undefined,
        activities: [],
      },
    ]);
    setSelectedHotelId(null);
  };

  // Remove a city
  const handleRemoveCity = (id: string) => {
    setCities(cities.filter(c => c.id !== id));
  };

  // Update city nights
  const handleUpdateNights = (id: string, nights: number) => {
    setCities(cities.map(c => c.id === id ? { ...c, nights } : c));
  };

  // Update city transfer
  const handleUpdateTransfer = (id: string, transfer: string) => {
    setCities(cities.map(c => c.id === id ? { ...c, transfer } : c));
  };

  // Toggle activity for city
  const handleToggleActivity = (id: string, actId: string) => {
    setCities(cities.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        activities: c.activities.includes(actId)
          ? c.activities.filter(a => a !== actId)
          : [...c.activities, actId],
      };
    }));
  };

  // Build pricing lines for the audit
  const lines: RawLine[] = useMemo(() => {
    const result: RawLine[] = [];

    cities.forEach((city) => {
      const hotel = HOTELS.find(h => h.id === city.hotelId);
      if (hotel) {
        result.push({
          pillar: 'hotel',
          label: hotel.name,
          location: hotel.destination,
          netZar: hotel.netRate * city.nights,
          nights: city.nights,
          source: 'contract',
        });
      }

      // Transfer between cities (only if not the first city)
      if (city.transfer && cities.indexOf(city) > 0) {
        const prevCity = cities[cities.indexOf(city) - 1];
        const prevHotel = HOTELS.find(h => h.id === prevCity.hotelId);
        if (prevHotel) {
          const transfers = TRANSFERS[prevHotel.region as keyof typeof TRANSFERS] || [];
          const selectedTransfer = transfers.find(t => t.id === city.transfer);
          if (selectedTransfer) {
            result.push({
              pillar: 'transfer',
              label: `${prevHotel.destination} → ${hotel.destination}`,
              location: 'Inter-camp',
              netZar: selectedTransfer.costZAR,
              source: 'supplier_data',
            });
          }
        }
      }

      // Activities
      city.activities.forEach(actId => {
        const activity = ACTIVITIES.find(a => a.id === actId);
        if (activity) {
          result.push({
            pillar: 'activity',
            label: activity.label,
            location: hotel.destination,
            netZar: activity.netRate,
            source: 'KB',
          });
        }
      });
    });

    return result;
  }, [cities]);

  const audit = useMemo(() => {
    return auditItinerary({ lines, budgetZar: budget, margins: MARGINS });
  }, [lines, budget]);

  const totalNights = cities.reduce((s, c) => s + c.nights, 0);
  const hotelsByRegion = cities.reduce((acc, c) => {
    const h = HOTELS.find(h => h.id === c.hotelId);
    if (h) {
      if (!acc[h.region]) acc[h.region] = [];
      acc[h.region].push(h);
    }
    return acc;
  }, {} as Record<string, typeof HOTELS>);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost',sans-serif", fontWeight: 300, padding: 'clamp(20px,4vw,48px)' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>Admin</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 300, lineHeight: 1.05 }}>Quote Simulator</h1>
          <p style={{ color: T.textMid, fontSize: 14, marginTop: 6 }}>Build real itineraries with actual hotels, transfers, and activities. See pricing and margins update in real time.</p>
        </div>

        {/* Pax + Budget */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Adults</label>
            <input type="number" min="1" max="6" value={pax.adults} onChange={e => setPax({ ...pax, adults: parseInt(e.target.value) })} style={{ width: '100%', background: T.surface2, border: `0.5px solid ${T.border}`, color: T.text, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Children</label>
            <input type="number" min="0" max="4" value={pax.children} onChange={e => setPax({ ...pax, children: parseInt(e.target.value) })} style={{ width: '100%', background: T.surface2, border: `0.5px solid ${T.border}`, color: T.text, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Budget (ZAR)</label>
            <input type="number" min="200000" step="50000" value={budget} onChange={e => setBudget(parseInt(e.target.value))} style={{ width: '100%', background: T.surface2, border: `0.5px solid ${T.border}`, color: T.text, padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
          </div>
        </div>

        {/* Two columns: add hotel + itinerary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1fr', gap: 24, marginBottom: 24 }}>

          {/* Add Hotel */}
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 20, height: 'fit-content' }}>
            <h3 style={{ fontSize: 13, marginBottom: 14, color: T.gold }}>Select & Add Hotel</h3>

            {/* Hotel cards */}
            <div style={{ display: 'grid', gap: 10, marginBottom: 16, maxHeight: 400, overflowY: 'auto' }}>
              {HOTELS.map(hotel => (
                <button
                  key={hotel.id}
                  onClick={() => setSelectedHotelId(hotel.id)}
                  style={{
                    background: selectedHotelId === hotel.id ? 'rgba(212,175,55,0.1)' : T.surface2,
                    border: selectedHotelId === hotel.id ? `1px solid ${T.gold}` : `0.5px solid ${T.border}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 4 }}>{hotel.name}</div>
                  <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>{hotel.destination}</div>
                  <div style={{ fontSize: 11, color: T.gold }}>{fmt(hotel.netRate)}/night</div>
                </button>
              ))}
            </div>

            {/* Nights selector */}
            {selectedHotelId && (
              <>
                <label style={{ display: 'block', fontSize: 11, color: T.textDim, textTransform: 'uppercase', marginBottom: 8 }}>Nights</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {[2, 3, 4, 5, 6, 7].map(n => (
                    <button
                      key={n}
                      onClick={() => setSelectedNights(n)}
                      style={{
                        flex: 1,
                        background: selectedNights === n ? T.gold : 'rgba(255,255,255,0.05)',
                        border: `0.5px solid ${selectedNights === n ? T.gold : T.border}`,
                        color: selectedNights === n ? T.bg : T.text,
                        padding: '8px',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: selectedNights === n ? 500 : 300,
                      }}
                    >
                      {n}n
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAddCity}
                  style={{
                    width: '100%',
                    background: T.gold,
                    color: T.bg,
                    border: 'none',
                    padding: '10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  + Add to itinerary
                </button>
              </>
            )}
          </div>

          {/* Itinerary builder */}
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 13, marginBottom: 14, color: T.gold }}>Itinerary ({totalNights}n)</h3>

            {cities.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textMid }}>Select hotels to build an itinerary</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {cities.map((city, idx) => {
                  const hotel = HOTELS.find(h => h.id === city.hotelId);
                  const prevHotel = idx > 0 ? HOTELS.find(h => h.id === cities[idx - 1].hotelId) : null;
                  const transfers = prevHotel ? (TRANSFERS[prevHotel.region as keyof typeof TRANSFERS] || []) : [];

                  return (
                    <div key={city.id} style={{ background: T.surface2, borderRadius: 10, padding: 12, border: `0.5px solid ${T.border}` }}>
                      {/* Hotel + nights */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{hotel?.name}</div>
                          <div style={{ fontSize: 11, color: T.textMid }}>{hotel?.destination}</div>
                        </div>
                        <button onClick={() => handleRemoveCity(city.id)} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                      </div>

                      {/* Nights editor */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {[1, 2, 3, 4, 5, 6, 7].map(n => (
                          <button
                            key={n}
                            onClick={() => handleUpdateNights(city.id, n)}
                            style={{
                              flex: 1,
                              background: city.nights === n ? T.gold : 'rgba(255,255,255,0.05)',
                              border: `0.5px solid ${city.nights === n ? T.gold : T.border}`,
                              color: city.nights === n ? T.bg : T.text,
                              padding: '6px',
                              borderRadius: 6,
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            {n}n
                          </button>
                        ))}
                      </div>

                      {/* Transfer (if not first city) */}
                      {idx > 0 && transfers.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Transfer from {prevHotel?.destination}</label>
                          <select
                            value={city.transfer || ''}
                            onChange={e => handleUpdateTransfer(city.id, e.target.value)}
                            style={{
                              width: '100%',
                              background: T.bg,
                              border: `0.5px solid ${T.border}`,
                              color: T.text,
                              padding: '6px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                            }}
                          >
                            <option value="">Select transfer...</option>
                            {transfers.map(t => (
                              <option key={t.id} value={t.id}>{t.label} ({fmt(t.costZAR)})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Activities */}
                      <div>
                        <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Activities</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ACTIVITIES.map(act => (
                            <button
                              key={act.id}
                              onClick={() => handleToggleActivity(city.id, act.id)}
                              style={{
                                background: city.activities.includes(act.id) ? T.gold : 'rgba(255,255,255,0.05)',
                                color: city.activities.includes(act.id) ? T.bg : T.text,
                                border: `0.5px solid ${city.activities.includes(act.id) ? T.gold : T.border}`,
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontSize: 10,
                                cursor: 'pointer',
                                fontWeight: city.activities.includes(act.id) ? 500 : 300,
                              }}
                            >
                              {act.label.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pricing audit */}
        {cities.length > 0 && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 13, marginBottom: 16, color: T.gold }}>Pricing Breakdown</h3>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Total margin</div>
                <div style={{ fontSize: 20, color: T.gold, fontWeight: 500 }}>{fmt(audit.totals.marginZar)}</div>
                <div style={{ fontSize: 11, color: T.textMid }}>{pct(audit.totals.blendedMarginPct)}% blended</div>
              </div>
              <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Display total</div>
                <div style={{ fontSize: 20, color: T.text, fontWeight: 500 }}>{fmt(audit.totals.displayZar)}</div>
                <div style={{ fontSize: 11, color: T.textMid }}>Net: {fmt(audit.totals.netZar)}</div>
              </div>
              <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Budget utilisation</div>
                <div style={{ fontSize: 20, color: audit.budget.utilisationPct > 105 ? T.red : audit.budget.utilisationPct > 90 ? T.green : T.amber, fontWeight: 500 }}>{pct(audit.budget.utilisationPct)}%</div>
                <div style={{ fontSize: 11, color: T.textMid }}>{audit.budget.status.replace('_', ' ')}</div>
              </div>
              <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Per-night margin</div>
                <div style={{ fontSize: 20, color: T.gold, fontWeight: 500 }}>{fmt(audit.totals.marginZar / totalNights)}</div>
                <div style={{ fontSize: 11, color: T.textMid }}>Across {totalNights}n</div>
              </div>
            </div>

            {/* Per-pillar breakdown */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, color: T.textMid, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Margin by pillar</h4>
              {audit.byPillar.map(p => (
                <div key={p.pillar} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ textTransform: 'capitalize' }}>{p.pillar}</span>
                    <span><b style={{ color: T.gold }}>{fmt(p.marginZar)}</b> <span style={{ color: T.textDim }}>({pct(p.marginPct)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (p.marginZar / Math.max(...audit.byPillar.map(x => x.marginZar))) * 100)}%`, height: '100%', background: T.gold, borderRadius: 3 }} />
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
    </div>
  );
}
