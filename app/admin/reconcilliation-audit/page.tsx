'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/reconciliation-audit/page.tsx
//
// RECONCILIATION AUDIT: Load actual confirmed bookings from Supabase.
// For each, recalculate margins using pricingEngine.
// Compare actual charges to calculated prices. Surface discrepancies.
//
// CRITICAL: This catches pricing engine bugs, margin drift, data entry errors.
// Every discrepancy = a bug to fix before it cascades.
//
// MOCK DATA: Replace `MOCK_BOOKINGS` with real Supabase query.
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

interface ActualBooking {
  booking_id: string;
  created_at: string;
  traveller_name: string;
  destination: string;
  check_in: string;
  nights: number;
  adults: number;
  children: number;
  budget_stated_zar: number;
  components: {
    pillar: string;
    name: string;
    location: string;
    nights: number;
    net_rate_zar: number;
    display_rate_zar: number;
    margin_pct: number;
    inclusion_source: string;
  }[];
  // What they actually paid (settled amount)
  total_charged_zar: number;
  total_net_cost_zar: number;
  deposits_collected: number;
  payment_status: string;
}

interface ReconciliationResult {
  booking_id: string;
  traveller_name: string;
  destination: string;
  nights: number;
  // What they were charged
  charged: { net: number; display: number; margin: number; marginPct: number };
  // What engine calculates
  calculated: { net: number; display: number; margin: number; marginPct: number };
  // Delta
  discrepancy: { net: number; display: number; margin: number; marginPct: number };
  severity: 'match' | 'low' | 'high' | 'critical';
  flagged: boolean;
  issues: string[];
}

// ── MOCK BOOKINGS — Replace with Supabase query ──────────────────────────────
// TODO: Swap this for real data:
//   const { data: bookings } = await supabase
//     .from('bookings')
//     .select('*')
//     .eq('state', 'completed')
//     .order('created_at', { ascending: false })
//     .limit(50)

const MOCK_BOOKINGS: ActualBooking[] = [
  {
    booking_id: 'TSE-001-2026',
    created_at: '2026-05-15T08:32:00Z',
    traveller_name: 'Smith, Richard & Elena',
    destination: 'Sabi Sand + Okavango',
    check_in: '2026-06-15',
    nights: 7,
    adults: 2,
    children: 0,
    budget_stated_zar: 600000,
    components: [
      { pillar: 'hotel', name: 'Singita Sabi Sand', location: 'Sabi Sand', nights: 4, net_rate_zar: 224000, display_rate_zar: 257600, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'hotel', name: 'Mombo Camp', location: 'Okavango', nights: 3, net_rate_zar: 186000, display_rate_zar: 214000, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'transfer', name: 'Sabi → Okavango light aircraft', location: 'Inter-camp', nights: 1, net_rate_zar: 18000, display_rate_zar: 21600, margin_pct: 16.7, inclusion_source: 'supplier_data' },
      { pillar: 'flight', name: 'LHR → JNB return × 2', location: 'International', nights: 1, net_rate_zar: 42000, display_rate_zar: 45360, margin_pct: 7.4, inclusion_source: 'supplier_data' },
      { pillar: 'activity', name: 'Helicopter mokoro experience', location: 'Okavango', nights: 1, net_rate_zar: 9000, display_rate_zar: 10620, margin_pct: 15.2, inclusion_source: 'KB' },
    ],
    total_charged_zar: 549180,
    total_net_cost_zar: 479000,
    deposits_collected: 164754,
    payment_status: 'completed',
  },
  {
    booking_id: 'TSE-002-2026',
    created_at: '2026-05-18T14:17:00Z',
    traveller_name: 'Johnson, Michael & Sarah',
    destination: 'Kruger + Cape Town',
    check_in: '2026-07-01',
    nights: 9,
    adults: 2,
    children: 0,
    budget_stated_zar: 750000,
    components: [
      { pillar: 'hotel', name: 'Tswalu Kalahari', location: 'Northern Cape', nights: 3, net_rate_zar: 117000, display_rate_zar: 134550, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'hotel', name: 'Singita Sabi Sand', location: 'Sabi Sand', nights: 4, net_rate_zar: 224000, display_rate_zar: 257600, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'hotel', name: 'Ellerman House', location: 'Cape Town', nights: 2, net_rate_zar: 38000, display_rate_zar: 43700, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'transfer', name: 'All domestic transfers', location: 'Multi-region', nights: 1, net_rate_zar: 45000, display_rate_zar: 54000, margin_pct: 16.7, inclusion_source: 'supplier_data' },
      { pillar: 'flight', name: 'International flights', location: 'International', nights: 1, net_rate_zar: 48000, display_rate_zar: 51840, margin_pct: 7.4, inclusion_source: 'supplier_data' },
      { pillar: 'activity', name: 'Private guide + vehicle', location: 'Sabi Sand', nights: 1, net_rate_zar: 11000, display_rate_zar: 12980, margin_pct: 15.2, inclusion_source: 'KB' },
    ],
    total_charged_zar: 554670,
    total_net_cost_zar: 483000,
    deposits_collected: 166401,
    payment_status: 'completed',
  },
  {
    booking_id: 'TSE-003-2026',
    created_at: '2026-05-22T10:45:00Z',
    traveller_name: 'Chen, David & Lisa',
    destination: 'Botswana explorer',
    check_in: '2026-08-10',
    nights: 10,
    adults: 2,
    children: 0,
    budget_stated_zar: 820000,
    components: [
      { pillar: 'hotel', name: 'Mombo Camp', location: 'Okavango', nights: 4, net_rate_zar: 248000, display_rate_zar: 285200, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'hotel', name: 'Chobe Chilwero', location: 'Chobe', nights: 3, net_rate_zar: 93000, display_rate_zar: 107000, margin_pct: 13.1, inclusion_source: 'contract' },
      { pillar: 'hotel', name: 'Little Vumbura', location: 'Okavango', nights: 3, net_rate_zar: 186000, display_rate_zar: 214000, margin_pct: 13.1, inclusion_source: 'contract' },
      // NOTE: Data gap — this flight was entered as an estimate, not sourced
      { pillar: 'flight', name: 'International flights', location: 'International', nights: 1, net_rate_zar: 55000, display_rate_zar: 57200, margin_pct: 3.8, inclusion_source: 'estimate' },
      { pillar: 'transfer', name: 'Multi-region transfers', location: 'Botswana', nights: 1, net_rate_zar: 52000, display_rate_zar: 62400, margin_pct: 16.7, inclusion_source: 'supplier_data' },
      { pillar: 'activity', name: 'Game drives + boat safaris', location: 'Multi', nights: 1, net_rate_zar: 15000, display_rate_zar: 17700, margin_pct: 15.2, inclusion_source: 'KB' },
    ],
    // DISCREPANCY: Total charged is higher than components sum — likely double-charged a pillar
    total_charged_zar: 723500,
    total_net_cost_zar: 649000,
    deposits_collected: 217050,
    payment_status: 'completed',
  },
];

const MARGINS: MarginConfig = { hotels: 1.15, flights: 1.08, transfers: 1.20, activities: 1.18 };

const fmt = (n: number) => 'R' + Math.round(n).toLocaleString();
const pct = (n: number) => Math.round(n * 10) / 10;

function reconcile(booking: ActualBooking, margins: MarginConfig): ReconciliationResult {
  // What they actually paid
  const chargedNet = booking.total_net_cost_zar;
  const chargedDisplay = booking.total_charged_zar;
  const chargedMargin = chargedDisplay - chargedNet;
  const chargedMarginPct = chargedDisplay > 0 ? (chargedMargin / chargedDisplay) * 100 : 0;

  // What engine calculates
  const lines: RawLine[] = booking.components.map(c => ({
    pillar: c.pillar as any,
    label: c.name,
    location: c.location,
    netZar: c.net_rate_zar,
    nights: c.nights,
    source: c.inclusion_source as any,
  }));

  const audit = auditItinerary({
    lines,
    budgetZar: booking.budget_stated_zar,
    margins,
  });

  const calcNet = audit.totals.netZar;
  const calcDisplay = audit.totals.displayZar;
  const calcMargin = audit.totals.marginZar;
  const calcMarginPct = audit.totals.blendedMarginPct;

  const deltaNet = chargedNet - calcNet;
  const deltaDisplay = chargedDisplay - calcDisplay;
  const deltaMargin = chargedMargin - calcMargin;
  const deltaMarginPct = chargedMarginPct - calcMarginPct;

  const issues: string[] = [];
  let severity: 'match' | 'low' | 'high' | 'critical' = 'match';

  // Flag data gaps
  if (audit.dataGaps.length > 0) {
    issues.push(`${audit.dataGaps.length} line(s) with data gaps (estimate/fallback)`);
    severity = severity === 'match' ? 'low' : severity;
  }

  // Flag floor breaches
  if (audit.floorBreaches.length > 0) {
    issues.push(`${audit.floorBreaches.length} line(s) below margin floor`);
    severity = 'high';
  }

  // Flag large deltas
  if (Math.abs(deltaMargin) > 5000) {
    issues.push(`Large margin delta: ${fmt(deltaMargin)}`);
    severity = 'critical';
  }

  if (Math.abs(deltaDisplay) > 10000) {
    issues.push(`Display total delta: ${fmt(deltaDisplay)}`);
    severity = 'critical';
  }

  if (Math.abs(deltaMarginPct) > 2) {
    issues.push(`Margin % drift: ${pct(deltaMarginPct)}%`);
    severity = severity === 'match' ? 'low' : severity;
  }

  const flagged = severity !== 'match';

  return {
    booking_id: booking.booking_id,
    traveller_name: booking.traveller_name,
    destination: booking.destination,
    nights: booking.nights,
    charged: { net: chargedNet, display: chargedDisplay, margin: chargedMargin, marginPct: chargedMarginPct },
    calculated: { net: calcNet, display: calcDisplay, margin: calcMargin, marginPct: calcMarginPct },
    discrepancy: { net: deltaNet, display: deltaDisplay, margin: deltaMargin, marginPct: deltaMarginPct },
    severity,
    flagged,
    issues,
  };
}

export default function ReconciliationAuditPage() {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'high' | 'critical'>('all');

  const results = useMemo(() => {
    const all = MOCK_BOOKINGS.map(b => reconcile(b, MARGINS));
    return filterSeverity === 'all' ? all : all.filter(r => r.severity === filterSeverity);
  }, [filterSeverity]);

  const stats = useMemo(() => {
    const all = MOCK_BOOKINGS.map(b => reconcile(b, MARGINS));
    return {
      total: all.length,
      flagged: all.filter(r => r.flagged).length,
      critical: all.filter(r => r.severity === 'critical').length,
      avgMarginDelta: Math.round(all.reduce((s, r) => s + Math.abs(r.discrepancy.margin), 0) / all.length),
      totalMarginDelta: all.reduce((s, r) => s + r.discrepancy.margin, 0),
    };
  }, []);

  const severityColor: Record<string, string> = {
    match: T.green,
    low: T.amber,
    high: T.amber,
    critical: T.red,
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost',sans-serif", fontWeight: 300, padding: 'clamp(20px,4vw,48px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>Operations</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 300, lineHeight: 1.05 }}>Reconciliation Audit</h1>
          <p style={{ color: T.textMid, fontSize: 14, marginTop: 6 }}>Compare actual charged amounts to engine-calculated margins. Flag data entry errors and pricing bugs before they cascade.</p>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
          <KPICard label="Bookings audited" value={stats.total.toString()} color={T.text} />
          <KPICard label="Flagged for review" value={stats.flagged.toString()} color={stats.flagged > 0 ? T.amber : T.green} />
          <KPICard label="Critical issues" value={stats.critical.toString()} color={stats.critical > 0 ? T.red : T.green} />
          <KPICard label="Avg margin delta" value={fmt(stats.avgMarginDelta)} color={stats.avgMarginDelta > 3000 ? T.red : T.amber} />
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
          {(['all', 'low', 'high', 'critical'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              style={{
                background: 'none',
                border: 'none',
                color: filterSeverity === sev ? severityColor[sev] : T.textDim,
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                padding: '0 8px',
                fontWeight: filterSeverity === sev ? 500 : 300,
              }}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Results table */}
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr', padding: '12px 18px', fontSize: 11, letterSpacing: '0.08em', color: T.textDim, textTransform: 'uppercase', borderBottom: `0.5px solid ${T.border}`, background: T.surface2 }}>
            <span>Booking</span>
            <span style={{ textAlign: 'center' }}>Nights</span>
            <span style={{ textAlign: 'right' }}>Charged margin</span>
            <span style={{ textAlign: 'right' }}>Calculated margin</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>
          {results.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: T.textMid }}>No bookings match filter.</div>
          ) : (
            results.map((r, i) => (
              <div key={i} style={{ padding: '0' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr 1fr',
                    padding: '14px 18px',
                    borderBottom: i < results.length - 1 ? `0.5px solid ${T.border}` : 'none',
                    background: r.flagged ? 'rgba(255,255,255,0.02)' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{r.traveller_name}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{r.booking_id} · {r.destination}</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 13 }}>{r.nights}n</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13 }}>{fmt(r.charged.margin)}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{pct(r.charged.marginPct)}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: Math.abs(r.discrepancy.margin) > 5000 ? T.red : T.text }}>{fmt(r.calculated.margin)}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{pct(r.calculated.marginPct)}%</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', width: 12, height: 12, background: severityColor[r.severity], borderRadius: '50%' }} />
                    {r.flagged && (
                      <div style={{ fontSize: 11, color: severityColor[r.severity], marginTop: 4, maxWidth: 120, lineHeight: 1.2 }}>
                        {r.issues[0]}
                      </div>
                    )}
                  </div>
                </div>
                {r.issues.length > 0 && (
                  <div style={{ padding: '0 18px 12px 18px', background: 'rgba(255,255,255,0.02)', borderBottom: i < results.length - 1 ? `0.5px solid ${T.border}` : 'none' }}>
                    <div style={{ fontSize: 11, color: T.textMid }}>
                      {r.issues.map((issue, j) => (
                        <div key={j} style={{ marginBottom: j < r.issues.length - 1 ? 4 : 0 }}>• {issue}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', color: T.textDim, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 400, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
