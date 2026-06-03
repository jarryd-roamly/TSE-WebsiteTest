'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/audit/page.tsx
//
// Site-wide audit dashboard. Calls GET /api/audit and displays results.
// Run before any launch. Run nightly via a cron job.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

const T = {
  bg: '#0a0a0a', bg2: '#111', surface: '#1a1a1a', surface2: '#222',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.12)',
  borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', red: '#f87171', amber: '#fbbf24',
};

interface Check {
  name:     string;
  status:   'pass' | 'fail' | 'warn';
  detail:   string;
  affected?: number;
}

interface AuditResult {
  timestamp: string;
  summary:   { total: number; passed: number; failed: number; warned: number };
  checks:    Check[];
}

const StatusBadge = ({ status }: { status: Check['status'] }) => {
  const colors = {
    pass: { bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  text: T.green, label: 'pass' },
    fail: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', text: T.red,   label: 'fail' },
    warn: { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: T.amber, label: 'warn' },
  }[status];
  return (
    <div style={{
      background: colors.bg, border: `0.5px solid ${colors.border}`, color: colors.text,
      fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.1em', display: 'inline-block',
    }}>
      {colors.label}
    </div>
  );
};

export default function AuditPage() {
  const [result,  setResult]  = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<'all' | 'fail' | 'warn' | 'pass'>('all');

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.success) setResult(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { runAudit(); }, []);

  const filteredChecks = !result ? [] : filter === 'all' ? result.checks : result.checks.filter(c => c.status === filter);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Jost',sans-serif", color: T.text }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 4 }}>System health</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300 }}>Site Audit</div>
            <div style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>
              Pricing integrity · Supplier completeness · KB consistency · Security posture
            </div>
            {result?.timestamp && (
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>
                Last run: {new Date(result.timestamp).toLocaleString()}
              </div>
            )}
          </div>
          <button onClick={runAudit} disabled={loading}
            style={{ background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', color: '#0a0a0a',
              borderRadius: 8, padding: '10px 20px', cursor: loading ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Running…' : '↻ Re-run audit'}
          </button>
        </div>

        {/* Summary cards */}
        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
            <SummaryCard label="Total checks" value={result.summary.total} color={T.gold} />
            <SummaryCard label="Passed"  value={result.summary.passed}  color={T.green} />
            <SummaryCard label="Warnings" value={result.summary.warned}  color={T.amber} />
            <SummaryCard label="Failed"  value={result.summary.failed}  color={T.red} />
          </div>
        )}

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {(['all','fail','warn','pass'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                background: filter === f ? T.goldDim : T.surface,
                border: `0.5px solid ${filter === f ? T.borderGold : T.border}`,
                color: filter === f ? T.gold : T.textMid,
                borderRadius: 20, padding: '5px 14px', fontSize: 11, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600,
              }}>
              {f === 'all' ? 'All' : f}{result ? ` · ${f === 'all' ? result.summary.total : result.summary[f === 'pass' ? 'passed' : f === 'fail' ? 'failed' : 'warned']}` : ''}
            </button>
          ))}
        </div>

        {/* Check list */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: T.textDim }}>
            Running checks against Supabase…
          </div>
        )}

        {result && !loading && (
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {filteredChecks.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: T.textDim }}>
                No checks match this filter.
              </div>
            )}
            {filteredChecks.map((check, i) => (
              <div key={i} style={{
                padding: '14px 18px',
                borderBottom: i < filteredChecks.length - 1 ? `0.5px solid ${T.border}` : 'none',
                display: 'grid', gridTemplateColumns: '1fr 80px', gap: 16, alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: T.text }}>
                    {check.name}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5 }}>
                    {check.detail}
                  </div>
                  {check.affected !== undefined && check.affected > 0 && check.status !== 'pass' && (
                    <div style={{ fontSize: 11, color: check.status === 'fail' ? T.red : T.amber, marginTop: 4, fontWeight: 500 }}>
                      {check.affected} affected
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', paddingTop: 2 }}>
                  <StatusBadge status={check.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help text */}
        <div style={{ marginTop: 24, padding: 16, background: T.bg2, border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>
          <div style={{ color: T.gold, marginBottom: 6, fontWeight: 500 }}>About the audit</div>
          Runs 12 site-wide checks: environment variables, margin bounds, supplier pricing integrity, image completeness, region coverage, KB orphan detection, curated journey validity, and the security check that confirms net rates are not readable from the browser.
          <br /><br />
          Recommended cadence: before every launch, after any major supplier import, nightly via a cron job.
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300, color }}>{value}</div>
    </div>
  );
}
