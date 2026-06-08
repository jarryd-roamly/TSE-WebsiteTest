'use client';
// components/OpsValidation.tsx
// STAFF ONLY. Renders the sequencing check from app/lib/sequencing.ts.
// Never imported by traveller pages. Gate the route with staff auth.
import React, { useEffect } from 'react';
import { Journey } from '@/app/lib/journey';
import { runSequencing } from '@/app/lib/sequencing';

const C = {
  bg: '#0a0a0a', surface: '#1a1a1a', gold: '#d4af37', text: '#f5f0e8',
  textMid: 'rgba(245,240,232,0.58)', border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', amber: '#fb923c', blue: '#60a5fa',
};
const F = { d: "'Cormorant Garamond', Georgia, serif", b: "'Jost', system-ui, sans-serif" };

export default function OpsValidation({ journey }: { journey: Journey }) {
  const j = journey;
  const checks = runSequencing(j);
  const n = (s: string) => checks.filter((c) => c.sev === s).length;
  useEffect(() => {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Jost:wght@300;400;500;600&display=swap';
    document.head.appendChild(l); return () => { try { document.head.removeChild(l); } catch (e) {} };
  }, []);
  return <div style={{ background: C.bg, color: C.text, fontFamily: F.b, fontWeight: 300, minHeight: '100vh' }}>
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 22px 60px' }}>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', fontSize: 11, letterSpacing: '.22em', padding: 6, borderRadius: 8, fontWeight: 600 }}>INTERNAL · TSE STAFF PORTAL · NOT VISIBLE TO TRAVELLER</div>
      <h1 style={{ fontFamily: F.d, fontSize: 34, fontWeight: 500, margin: '18px 0 2px' }}>Sequencing validation — {j.ref}</h1>
      <div style={{ color: C.textMid, fontSize: 14 }}>{j.title} · assigned to {j.specialist.name}</div>
      <div style={{ display: 'flex', margin: '18px 0', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {[['Checks', checks.length], ['Passed', n('pass')], ['Flagged', n('flag')], ['Info', n('info')]].map(([l, v]: any, i: number) =>
          <div key={l} style={{ flex: 1, textAlign: 'center', padding: 14, borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontFamily: F.d, fontSize: 28, color: l === 'Flagged' && v ? C.amber : C.text }}>{v}</div>
            <div style={{ fontSize: 10, letterSpacing: '.1em', color: C.textMid }}>{l.toUpperCase()}</div></div>)}
      </div>
      {n('flag') > 0 && <div style={{ border: `1px solid ${C.amber}66`, background: `${C.amber}10`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: '.12em', color: C.amber, fontWeight: 600, marginBottom: 8 }}>⚑ ACTION REQUIRED — ROUTED TO {j.specialist.name.toUpperCase()}</div>
        <ol style={{ margin: '0 0 0 18px' }}>{checks.filter((c) => c.sev === 'flag').map((c, i) => <li key={i} style={{ fontSize: 13, marginBottom: 6 }}><b>{c.t}.</b> {c.x}</li>)}</ol>
        <div style={{ fontSize: 12, color: C.textMid, marginTop: 8 }}>Status: <b style={{ color: C.amber }}>HELD — pending specialist clearance.</b> Final build is blocked from issue until resolved or accepted with reason.</div>
      </div>}
      {checks.map((c, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textAlign: 'center', padding: '12px 4px', color: c.sev === 'flag' ? C.amber : c.sev === 'info' ? C.blue : C.green }}>{c.sev.toUpperCase()}</div>
        <div style={{ padding: '10px 6px' }}><div style={{ fontSize: 14, color: C.text }}>{c.t}</div><div style={{ fontSize: 12.5, color: C.textMid, marginTop: 2 }}>{c.x}</div></div></div>)}
    </div>
  </div>;
}
