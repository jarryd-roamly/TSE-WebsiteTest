'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/margin-analytics/page.tsx
//
// MARGIN ANALYTICS DASHBOARD: Load all completed bookings. Aggregate margin
// statistics across pillars, destinations, seasons. Visualise trends.
// Answer questions like: "Which destinations yield highest margin?" or
// "Are transfers more profitable than hotels?" or "How does season affect margin?"
//
// MOCK DATA: Replace `generateMockBookings()` with real Supabase query.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';

const T = {
  bg: '#0a0a0a', bg2: '#111', surface: '#1a1a1a', surface2: '#222',
  gold: '#d4af37', goldLight: '#f0c040',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', red: '#f87171', amber: '#fb923c', blue: '#60a5fa', violet: '#a78bfa',
};

interface Booking {
  booking_id: string;
  created_at: string;
  destination: string;
  season: 'peak' | 'shoulder' | 'green';
  pillar_margins: Record<string, { net: number; display: number; margin: number; marginPct: number }>;
  total_margin: number;
  total_margin_pct: number;
  budget_stated: number;
  utilisation_pct: number;
}

interface PillarStats {
  pillar: string;
  bookings: number;
  avgMarginPct: number;
  avgMarginRand: number;
  minMarginPct: number;
  maxMarginPct: number;
  totalMarginRand: number;
}

interface DestinationStats {
  destination: string;
  bookings: number;
  avgMarginPct: number;
  avgMarginRand: number;
  topPillar: string;
}

interface SeasonStats {
  season: 'peak' | 'shoulder' | 'green';
  bookings: number;
  avgMarginPct: number;
  avgMarginRand: number;
}

// ── MOCK DATA GENERATOR — Replace with Supabase query ────────────────────────
function generateMockBookings(): Booking[] {
  const destinations = ['Sabi Sand', 'Okavango', 'Kruger', 'Chobe', 'Cape Town', 'Kalahari'];
  const pillars = ['hotel', 'flight', 'transfer', 'activity'];
  const seasons: ('peak' | 'shoulder' | 'green')[] = ['peak', 'shoulder', 'green'];

  const bookings: Booking[] = [];
  for (let i = 0; i < 40; i++) {
    const destination = destinations[Math.floor(Math.random() * destinations.length)];
    const season = seasons[Math.floor(Math.random() * seasons.length)];
    const pillar_margins: Record<string, any> = {};

    let totalNet = 0;
    let totalDisplay = 0;

    // Generate realistic margin splits
    const hotelNet = 200000 + Math.random() * 100000;
    const hotelDisplay = hotelNet * 1.15;
    pillar_margins.hotel = { net: hotelNet, display: hotelDisplay, margin: hotelDisplay - hotelNet, marginPct: 13.1 };
    totalNet += hotelNet;
    totalDisplay += hotelDisplay;

    if (Math.random() > 0.3) {
      const flightNet = 40000 + Math.random() * 30000;
      const flightDisplay = flightNet * 1.08;
      pillar_margins.flight = { net: flightNet, display: flightDisplay, margin: flightDisplay - flightNet, marginPct: 7.4 };
      totalNet += flightNet;
      totalDisplay += flightDisplay;
    }

    if (Math.random() > 0.2) {
      const transferNet = 20000 + Math.random() * 40000;
      const transferDisplay = transferNet * 1.20;
      pillar_margins.transfer = { net: transferNet, display: transferDisplay, margin: transferDisplay - transferNet, marginPct: 16.7 };
      totalNet += transferNet;
      totalDisplay += transferDisplay;
    }

    if (Math.random() > 0.15) {
      const activityNet = 8000 + Math.random() * 15000;
      const activityDisplay = activityNet * 1.18;
      pillar_margins.activity = { net: activityNet, display: activityDisplay, margin: activityDisplay - activityNet, marginPct: 15.2 };
      totalNet += activityNet;
      totalDisplay += activityDisplay;
    }

    const marginPct = (totalDisplay - totalNet) / totalDisplay * 100;

    bookings.push({
      booking_id: `TSE-${String(i + 1).padStart(3, '0')}-2026`,
      created_at: new Date(2026, 4, Math.floor(Math.random() * 30) + 1).toISOString(),
      destination,
      season,
      pillar_margins,
      total_margin: totalDisplay - totalNet,
      total_margin_pct: marginPct,
      budget_stated: totalDisplay + Math.random() * 100000,
      utilisation_pct: (totalDisplay / (totalDisplay + Math.random() * 100000)) * 100,
    });
  }

  return bookings;
}

const BOOKINGS = generateMockBookings();

function aggregatePillars(bookings: Booking[]): PillarStats[] {
  const pillars = ['hotel', 'flight', 'transfer', 'activity'];
  const stats: PillarStats[] = [];

  for (const pillar of pillars) {
    const relevant = bookings.filter(b => b.pillar_margins[pillar]);
    if (relevant.length === 0) continue;

    const margins = relevant.map(b => ({
      marginPct: b.pillar_margins[pillar].marginPct,
      marginRand: b.pillar_margins[pillar].margin,
    }));

    stats.push({
      pillar,
      bookings: relevant.length,
      avgMarginPct: margins.reduce((s, m) => s + m.marginPct, 0) / margins.length,
      avgMarginRand: margins.reduce((s, m) => s + m.marginRand, 0) / margins.length,
      minMarginPct: Math.min(...margins.map(m => m.marginPct)),
      maxMarginPct: Math.max(...margins.map(m => m.marginPct)),
      totalMarginRand: margins.reduce((s, m) => s + m.marginRand, 0),
    });
  }

  return stats;
}

function aggregateDestinations(bookings: Booking[]): DestinationStats[] {
  const byDest: Record<string, Booking[]> = {};
  for (const b of bookings) {
    if (!byDest[b.destination]) byDest[b.destination] = [];
    byDest[b.destination].push(b);
  }

  return Object.entries(byDest).map(([dest, bs]) => {
    const margins = bs.map(b => b.total_margin_pct);
    const pillarMeans = aggregatePillars(bs);
    return {
      destination: dest,
      bookings: bs.length,
      avgMarginPct: margins.reduce((s, m) => s + m, 0) / margins.length,
      avgMarginRand: bs.reduce((s, b) => s + b.total_margin, 0) / bs.length,
      topPillar: pillarMeans.length > 0 ? pillarMeans.reduce((a, b) => b.avgMarginPct > a.avgMarginPct ? b : a).pillar : 'N/A',
    };
  });
}

function aggregateSeasons(bookings: Booking[]): SeasonStats[] {
  const bySeason: Record<string, Booking[]> = { peak: [], shoulder: [], green: [] };
  for (const b of bookings) {
    bySeason[b.season].push(b);
  }

  return Object.entries(bySeason).map(([season, bs]) => {
    const margins = bs.map(b => b.total_margin_pct);
    return {
      season: season as any,
      bookings: bs.length,
      avgMarginPct: margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : 0,
      avgMarginRand: bs.length > 0 ? bs.reduce((s, b) => s + b.total_margin, 0) / bs.length : 0,
    };
  });
}

const fmt = (n: number) => 'R' + Math.round(n).toLocaleString();
const pct = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export default function MarginAnalyticsPage() {
  const [chartTab, setChartTab] = useState<'pillar' | 'destination' | 'season'>('pillar');

  const pillarStats = useMemo(() => aggregatePillars(BOOKINGS), []);
  const destStats = useMemo(() => aggregateDestinations(BOOKINGS), []);
  const seasonStats = useMemo(() => aggregateSeasons(BOOKINGS), []);

  const overallStats = useMemo(() => {
    const margins = BOOKINGS.map(b => b.total_margin_pct);
    const marginRands = BOOKINGS.map(b => b.total_margin);
    return {
      totalBookings: BOOKINGS.length,
      avgMarginPct: margins.reduce((s, m) => s + m, 0) / margins.length,
      medianMarginPct: margins.sort((a, b) => a - b)[Math.floor(margins.length / 2)],
      avgMarginRand: marginRands.reduce((s, m) => s + m, 0) / marginRands.length,
      totalMarginRand: marginRands.reduce((s, m) => s + m, 0),
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost',sans-serif", fontWeight: 300, padding: 'clamp(20px,4vw,48px)' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>Analytics</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 300, lineHeight: 1.05 }}>Margin Analytics</h1>
          <p style={{ color: T.textMid, fontSize: 14, marginTop: 6 }}>Aggregate margin statistics across pillars, destinations, and seasons. Identify patterns and optimisation opportunities.</p>
        </div>

        {/* Overall KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
          <StatCard label="Total bookings" value={overallStats.totalBookings.toString()} sub={`Average ${fmt(overallStats.avgMarginRand)}/booking`} />
          <StatCard label="Blended margin %" value={pct(overallStats.avgMarginPct)} sub={`Median ${pct(overallStats.medianMarginPct)}%`} />
          <StatCard label="Total margin (RAND)" value={fmt(overallStats.totalMarginRand)} sub={`${BOOKINGS.length} bookings`} />
          <StatCard label="Highest margin pillar" value={pillarStats.reduce((a, b) => b.avgMarginPct > a.avgMarginPct ? b : a).pillar} sub={`${pct(pillarStats.reduce((a, b) => b.avgMarginPct > a.avgMarginPct ? b : a).avgMarginPct)}% average`} />
        </div>

        {/* Chart tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
          {(['pillar', 'destination', 'season'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setChartTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                color: chartTab === tab ? T.gold : T.textDim,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: '0 8px',
                fontWeight: chartTab === tab ? 500 : 300,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Pillar breakdown */}
        {chartTab === 'pillar' && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16, color: T.gold }}>Margin by pillar</h3>
            {pillarStats.map((stat, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, textTransform: 'capitalize', fontWeight: 500 }}>{stat.pillar}</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                    <span><span style={{ color: T.textDim }}>Avg:</span> <b style={{ color: T.gold }}>{pct(stat.avgMarginPct)}%</b></span>
                    <span><span style={{ color: T.textDim }}>Per booking:</span> <b>{fmt(stat.avgMarginRand)}</b></span>
                    <span><span style={{ color: T.textDim }}>Range:</span> {pct(stat.minMarginPct)}–{pct(stat.maxMarginPct)}%</span>
                    <span><span style={{ color: T.textDim }}>Total:</span> {fmt(stat.totalMarginRand)}</span>
                  </div>
                </div>
                {/* Bar */}
                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(stat.avgMarginPct / Math.max(...pillarStats.map(s => s.avgMarginPct))) * 100}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${T.gold}aa, ${T.goldLight})`,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Destination breakdown */}
        {chartTab === 'destination' && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 20px', fontSize: 11, letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase', borderBottom: `0.5px solid ${T.border}`, background: T.surface2 }}>
              <span>Destination</span>
              <span style={{ textAlign: 'right' }}>Bookings</span>
              <span style={{ textAlign: 'right' }}>Avg margin %</span>
              <span style={{ textAlign: 'right' }}>Top pillar</span>
            </div>
            {destStats.map((stat, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: i < destStats.length - 1 ? `0.5px solid ${T.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>{stat.destination}</span>
                <span style={{ textAlign: 'right', fontSize: 13, color: T.textMid }}>{stat.bookings}</span>
                <span style={{ textAlign: 'right', fontSize: 13, color: T.gold, fontWeight: 500 }}>{pct(stat.avgMarginPct)}%</span>
                <span style={{ textAlign: 'right', fontSize: 13, color: T.textMid, textTransform: 'capitalize' }}>{stat.topPillar}</span>
              </div>
            ))}
          </div>
        )}

        {/* Season breakdown */}
        {chartTab === 'season' && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16, color: T.gold }}>Margin by season</h3>
            {seasonStats.map((stat, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, textTransform: 'capitalize', fontWeight: 500 }}>{stat.season}</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                    <span><span style={{ color: T.textDim }}>Bookings:</span> {stat.bookings}</span>
                    <span><span style={{ color: T.textDim }}>Avg margin:</span> <b style={{ color: T.gold }}>{pct(stat.avgMarginPct)}%</b></span>
                    <span><span style={{ color: T.textDim }}>Per booking:</span> {fmt(stat.avgMarginRand)}</span>
                  </div>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(stat.avgMarginPct / Math.max(...seasonStats.map(s => s.avgMarginPct))) * 100}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${T.green}aa, ${T.greenLight || T.green})`,
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', color: T.textDim, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 400, color: T.gold, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textMid }}>{sub}</div>
    </div>
  );
}
