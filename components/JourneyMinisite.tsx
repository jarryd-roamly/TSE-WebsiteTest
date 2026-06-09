'use client';
// components/JourneyMiniSite.tsx — v3.0
// Immersive post-booking companion. Chronological timeline. Image carousels.
// Activities inline. Left: region tips. Right: activity list. Pre-travel milestones.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Journey, Segment, Transfer, Leg, totals, balanceDue } from '@/app/lib/journey';
import { money as fmtMoney, fmtDate, statusWord, hm } from '@/app/lib/journeyFormat';

// ── design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a', bg2: '#111111', surface: '#161616', surface2: '#1c1c1c',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.12)',
  borderGold: 'rgba(212,175,55,0.28)', borderGoldBright: 'rgba(212,175,55,0.55)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)', green: '#4ade80', greenDim: 'rgba(74,222,128,0.10)',
  amber: '#fb923c', amberDim: 'rgba(251,146,60,0.10)', red: '#f87171',
  blue: '#60a5fa',
};
const F = { d: "'Cormorant Garamond', Georgia, serif", b: "'Jost', system-ui, sans-serif" };

// ── safe duration formatter (NaN-proof) ───────────────────────────────────────
function safeDur(dep: string, arr: string, durationMin?: number): string {
  if (durationMin && durationMin > 0) {
    const h = Math.floor(durationMin / 60), m = durationMin % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  }
  if (!dep || !arr) return '';
  try {
    const ms = +new Date(arr) - +new Date(dep);
    if (isNaN(ms) || ms <= 0) return '';
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  } catch { return ''; }
}

function safeHm(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.includes(':') ? iso.substring(0, 5) : '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ── reusable components ───────────────────────────────────────────────────────
function useCountdown(target: string | Date) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = Math.max(0, new Date(target).getTime() - n);
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms % 864e5 / 36e5), m: Math.floor(ms % 36e5 / 6e4), s: Math.floor(ms % 6e4 / 1e3) };
}

const Btn = ({ children, onClick, kind = 'gold', full, small }: any) => {
  const base: React.CSSProperties = { fontFamily: F.b, fontWeight: 500, cursor: 'pointer', borderRadius: 9, padding: small ? '8px 14px' : '12px 22px', fontSize: small ? 13 : 14, width: full ? '100%' : 'auto', transition: 'opacity 0.15s' };
  const k: any = {
    gold: { ...base, background: `linear-gradient(180deg,${C.goldLight},${C.gold})`, color: '#1a1306', border: 'none' },
    ghost: { ...base, background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    dark:  { ...base, background: C.surface, color: C.text, border: `1px solid ${C.border}` },
  };
  return <button onClick={onClick} style={k[kind]}>{children}</button>;
};

function Chip({ status, small }: any) {
  const col = status === 'confirmed' ? C.green : status === 'held' ? C.gold : C.amber;
  const label = status === 'confirmed' ? 'Confirmed' : status === 'held' ? 'Held' : 'Confirming';
  return <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize: small ? 10 : 11, color: col, border:`1px solid ${col}44`, background:`${col}14`, padding: small ? '2px 8px' : '3px 10px', borderRadius:20 }}>
    <span style={{ width:5, height:5, borderRadius:5, background:col }} />{label}
  </span>;
}

// ── Image carousel ────────────────────────────────────────────────────────────
function ImageCarousel({ images, name, height = 240 }: { images: string[]; name: string; height?: number }) {
  const [cur, setCur] = useState(0);
  const [dragX, setDragX] = useState<number | null>(null);
  if (!images.length) return null;
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setCur(i => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setCur(i => (i + 1) % images.length); };
  return (
    <div style={{ position:'relative', height, overflow:'hidden', borderRadius:'12px 12px 0 0', userSelect:'none' }}
      onPointerDown={e => setDragX(e.clientX)}
      onPointerUp={e => {
        if (dragX !== null) {
          const dx = e.clientX - dragX;
          if (Math.abs(dx) > 40) setCur(i => dx < 0 ? (i+1)%images.length : (i-1+images.length)%images.length);
          setDragX(null);
        }
      }}>
      <img src={images[cur]} alt={name} draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'opacity 0.2s' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
      {images.length > 1 && <>
        <button onClick={prev} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', border:'0.5px solid rgba(255,255,255,0.15)', color:C.text, width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <button onClick={next} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', border:'0.5px solid rgba(255,255,255,0.15)', color:C.text, width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'center', gap:4, pointerEvents:'none' }}>
          {images.map((_,i) => <div key={i} style={{ width: i===cur ? 18:5, height:5, borderRadius:3, background: i===cur ? C.gold : 'rgba(255,255,255,0.45)', transition:'all 0.25s' }} />)}
        </div>
        <div style={{ position:'absolute', top:10, left:10, background:'rgba(0,0,0,0.55)', borderRadius:4, padding:'2px 8px', fontSize:10, color:C.textMid, letterSpacing:'0.1em' }}>{cur+1} / {images.length}</div>
      </>}
    </div>
  );
}

// ── Flight leg row ─────────────────────────────────────────────────────────────
function LegRow({ l }: { l: Leg }) {
  const dur = safeDur(l.dep, l.arr, l.durationMin);
  const depTime = safeHm(l.dep);
  const arrTime = safeHm(l.arr);
  const isRoad  = l.kind === 'road';
  return <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop:`0.5px solid ${C.border}` }}>
    <span style={{ width:26, textAlign:'center', color:C.textMid, fontSize:18 }}>{isRoad ? '↣' : '✈'}</span>
    {isRoad
      ? <div style={{ flex:1 }}>
          <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{l.carrier}</div>
          <div style={{ fontSize:11, color:C.textMid }}>{l.depApt} → {l.arrApt}{l.no ? ` · ${l.no}` : ''}</div>
        </div>
      : <>
          <div style={{ minWidth:80 }}>
            <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{l.carrier}</div>
            {l.no && <div style={{ fontSize:10, color:C.textDim, fontFamily:'monospace' }}>{l.no}</div>}
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ textAlign:'right', minWidth:44 }}>
              <div style={{ fontFamily:F.d, fontSize:20, lineHeight:1 }}>{l.depApt}</div>
              {depTime && <div style={{ fontSize:11, color:C.gold, marginTop:2 }}>{depTime}</div>}
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ height:1, background:`linear-gradient(90deg, ${C.borderGold}, transparent)` }} />
              {dur && <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>{dur}</div>}
            </div>
            <div style={{ minWidth:44 }}>
              <div style={{ fontFamily:F.d, fontSize:20, lineHeight:1 }}>{l.arrApt}</div>
              {arrTime && <div style={{ fontSize:11, color:C.gold, marginTop:2 }}>{arrTime}</div>}
            </div>
          </div>
        </>
    }
    <Chip status="confirming" small />
  </div>;
}

function TransferBlock({ t, compact }: { t: Transfer; compact?: boolean }) {
  if (!t.legs.length && !t.notes.length) return null;
  const dateMatch = t.tag.match(/(\d{1,2} \w+ \d{4})/);
  return <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding: compact ? '12px 16px' : '16px 18px', marginBottom: compact ? 8 : 0 }}>
    <div style={{ fontSize:10, letterSpacing:'.18em', color:C.gold, marginBottom:6 }}>{t.tag.toUpperCase()}</div>
    {t.legs.map((l,i) => <LegRow key={i} l={l} />)}
    {t.notes.filter(n => n.text).map((n,i) => (
      <div key={i} style={{ display:'flex', gap:8, marginTop:8, fontSize:12.5, lineHeight:1.5, background:C.greenDim, borderRadius:7, padding:'8px 11px' }}>
        <span style={{ color:C.green }}>✓</span>
        <span style={{ color:C.textMid }}>{n.text}</span>
      </div>
    ))}
  </div>;
}

// ── Property card ─────────────────────────────────────────────────────────────
function PropertyCard({ sg, mode, activities }: { sg: Segment; mode: string; activities: any[] }) {
  const regionActs = activities.filter(a => a.regionSlug === sg.regionSlug || a.region === sg.bandRegion);
  const inclusions = sg.inclusions.length > 0 ? sg.inclusions : sg.detail;
  const formatInc = (s: string) => s.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase());

  return <div style={{ background:C.surface, border:`1px solid ${C.borderGold}`, borderRadius:12, overflow:'hidden' }}>
    {sg.images.length > 0
      ? <ImageCarousel images={sg.images} name={sg.lodge} height={260} />
      : sg.img
        ? <div style={{ height:200, overflow:'hidden', position:'relative', borderRadius:'12px 12px 0 0' }}>
            <img src={sg.img} alt={sg.lodge} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)' }} />
          </div>
        : null
    }
    <div style={{ padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ fontSize:9, color:C.gold, letterSpacing:'.28em', textTransform:'uppercase' }}>{sg.bandRegion}</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {sg.nights && <span style={{ fontSize:10, color:C.gold, background:C.goldDim, border:`0.5px solid ${C.borderGold}`, padding:'2px 10px', borderRadius:20 }}>{sg.nights} night{sg.nights !== 1 ? 's' : ''}</span>}
          <Chip status={mode === 'quote' ? 'held' : sg.status} small />
        </div>
      </div>
      <div style={{ fontFamily:F.d, fontSize:26, fontWeight:300, color:C.text, lineHeight:1.1, marginBottom:4 }}>{sg.lodge}</div>
      <div style={{ fontSize:12, color:C.textDim, marginBottom:sg.narrative ? 10 : 14 }}>{sg.dates}</div>
      {sg.narrative && <div style={{ fontSize:13, color:C.textMid, lineHeight:1.65, fontStyle:'italic', marginBottom:14, paddingLeft:12, borderLeft:`2px solid ${C.borderGold}` }}>"{sg.narrative}"</div>}
      {inclusions.length > 0 && (
        <div style={{ marginBottom: regionActs.length > 0 ? 14 : 0 }}>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:'.24em', textTransform:'uppercase', marginBottom:8 }}>Included</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:0 }}>
            {inclusions.map((inc, i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center' }}>
                <span style={{ fontSize:12, color:C.gold, fontWeight:600, letterSpacing:'0.02em' }}>{formatInc(inc)}</span>
                {i < inclusions.length - 1 && <span style={{ color:C.borderGold, margin:'0 8px', fontSize:10 }}>·</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {regionActs.length > 0 && (
        <div>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:'.24em', textTransform:'uppercase', marginBottom:8 }}>Your Experiences</div>
          {regionActs.map((act, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', marginBottom:6, background:C.goldDim, border:`0.5px solid ${C.borderGold}`, borderRadius:8 }}>
              <div style={{ width:2, height:16, background:C.gold, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{act.name}</div>
                {act.duration && <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{act.duration}</div>}
              </div>
            </div>
          ))}
          <div style={{ fontSize:9, color:C.textDim, fontStyle:'italic', marginTop:6, lineHeight:1.6 }}>
            Your specialist will confirm the ideal day for each experience with you.
          </div>
        </div>
      )}
    </div>
  </div>;
}

// ── Pre-travel timeline ────────────────────────────────────────────────────────
function PreTravelTimeline({ j }: { j: Journey }) {
  const departIn = j.departIn || 0;
  const milestones = [
    { days: 90, icon:'🛂', title:'Visa check', body:'Confirm visa requirements for all countries. Allow 6–8 weeks for applications.' },
    { days: 60, icon:'💊', title:'Malaria prophylactics', body:'Book your GP appointment. Prophylactics must start before travel.' },
    { days: 45, icon:'💉', title:'Vaccinations', body:'Confirm Hepatitis A, Typhoid, and Yellow Fever requirements for your route.' },
    { days: 30, icon:'🧳', title:'Pack smart', body:'20kg soft bag limit on all charter legs. Hard cases stored at your gateway.' },
    { days: 14, icon:'✈', title:'Check in online', body:'Check in for your international flights. Download boarding passes.' },
    { days: 7,  icon:'📱', title:'Download offline maps', body:'Download Google Maps areas offline. Save emergency numbers.' },
    { days: 3,  icon:'📋', title:'Final logistics', body:'Your specialist confirms all times and contacts for your first day.' },
    { days: 0,  icon:'🌅', title:'Departure day', body:'Your adventure begins. Your specialist is on WhatsApp throughout.' },
  ];
  const upcoming = milestones.filter(m => m.days <= departIn);
  const done     = milestones.filter(m => m.days > departIn);
  if (!upcoming.length && !done.length) return null;

  return <>
    <div style={{ margin:'44px 0 18px' }}>
      <div style={{ fontFamily:F.b, fontSize:11, letterSpacing:'.24em', color:C.gold, marginBottom:8 }}>BEFORE YOU GO</div>
      <h2 style={{ fontFamily:F.d, fontSize:'clamp(26px,3vw,36px)', margin:0, fontWeight:500 }}>Your pre-travel checklist</h2>
      <p style={{ color:C.textMid, fontSize:14, marginTop:8, maxWidth:600 }}>Everything your specialist has planned for you — and a few things to handle yourself.</p>
    </div>
    <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
      {upcoming.map((m, i) => {
        const active = departIn - m.days <= 14;
        return <div key={i} style={{ flexShrink:0, width:200, background: active ? C.goldDim : C.surface, border:`1px solid ${active ? C.borderGoldBright : C.border}`, borderRadius:12, padding:'16px 16px' }}>
          <div style={{ fontSize:24, marginBottom:8 }}>{m.icon}</div>
          <div style={{ fontSize:9, color: active ? C.goldLight : C.textDim, letterSpacing:'.18em', textTransform:'uppercase', marginBottom:4 }}>{m.days === 0 ? 'Departure' : `${m.days} days before`}</div>
          <div style={{ fontSize:14, color:C.text, fontWeight:500, marginBottom:6 }}>{m.title}</div>
          <div style={{ fontSize:12, color:C.textMid, lineHeight:1.55 }}>{m.body}</div>
        </div>;
      })}
      {done.map((m, i) => (
        <div key={i} style={{ flexShrink:0, width:180, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 16px', opacity:0.45 }}>
          <div style={{ fontSize:22, marginBottom:8 }}>{m.icon}</div>
          <div style={{ fontSize:9, color:C.textDim, letterSpacing:'.18em', textTransform:'uppercase', marginBottom:4 }}>{m.days} days before</div>
          <div style={{ fontSize:13, color:C.textDim, fontWeight:500 }}>{m.title}</div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>✓ Window passed</div>
        </div>
      ))}
    </div>
  </>;
}

// ── Emotive copy generator ────────────────────────────────────────────────────
function emoTive(j: Journey): { badge: string; headline: string; sub: string } {
  const name   = j.travellers[0]?.split(' ')[0] || '';
  const nights = j.nights;
  const route  = j.route.join(', ');
  const occ    = j.occasion || '';
  const themes = (j.themes || []).join(' · ');

  if (occ === 'honeymoon') return {
    badge: '✦ Your Honeymoon',
    headline: `${nights} nights. Wilderness, wonder, and each other.`,
    sub: `${route} — a journey designed around you, with every detail handled so you never have to think about anything except the extraordinary.`,
  };
  if (occ === 'anniversary') return {
    badge: '✦ Your Anniversary Journey',
    headline: `Africa doesn't do ordinary. Neither should your anniversary.`,
    sub: `${nights} nights across ${j.route.length} destination${j.route.length > 1 ? 's' : ''}. ${route}. This is the trip you'll still talk about in twenty years.`,
  };
  if (occ === 'family') return {
    badge: '✦ Your Family Safari',
    headline: `The Africa your family will carry forever.`,
    sub: `${nights} nights, ${route}. No two families leave the bush the same. These are the moments that become stories for life.`,
  };
  if (nights >= 10) return {
    badge: '✦ Your Grand Safari',
    headline: `${nights} nights. ${j.route.length} wildernesses. One sequence.`,
    sub: `${route}. Every camp selected for the season, the species, the experience. ${themes ? `Themes: ${themes}.` : ''} Nothing is left to chance.`,
  };
  return {
    badge: '✦ Your Journey',
    headline: `${route}. ${nights} nights. Africa at its finest.`,
    sub: j.specialist.rec || 'Every detail has been handled. Your only job is to arrive.',
  };
}

// ── Specialist card ───────────────────────────────────────────────────────────
function SpecialistCard({ j, onChat }: any) {
  const sp = j.specialist;
  return <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:16, margin:'22px 0' }}>
    <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
      <div style={{ width:52, height:52, borderRadius:'50%', background:`linear-gradient(140deg,${C.gold},#7a5a26)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F.d, fontSize:20, color:'#1a1206', flexShrink:0 }}>{sp.initials}</div>
      <div style={{ flex:1, minWidth:160 }}>
        <div style={{ fontSize:9, letterSpacing:'.14em', color:C.gold, textTransform:'uppercase', marginBottom:2 }}>{sp.role}</div>
        <div style={{ fontFamily:F.d, fontSize:20 }}>{sp.name}</div>
        {sp.response && <div style={{ fontSize:12, color:C.textMid, marginTop:2 }}>Responds in {sp.response}</div>}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn small onClick={onChat}>WhatsApp</Btn>
        <Btn small kind="ghost" onClick={onChat}>Chat</Btn>
      </div>
    </div>
    {sp.rec && <p style={{ fontFamily:F.d, fontSize:16, fontStyle:'italic', color:C.text, margin:'12px 0 0', borderTop:`1px solid ${C.border}`, paddingTop:12 }}>"{sp.rec}"</p>}
  </div>;
}

// ── Modals ────────────────────────────────────────────────────────────────────
function ModalShell({ title, children, onClose, wide }: any) {
  return <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#000000cc', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'6vh 14px', overflowY:'auto' }}>
    <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth: wide ? 720 : 460, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:F.d, fontSize:22 }}>{title}</div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:C.textMid, fontSize:22, cursor:'pointer' }}>×</button>
      </div>
      <div style={{ padding:20 }}>{children}</div>
    </div>
  </div>;
}

function SimpleDoc({ j }: { j: Journey }) {
  const allLegs = [
    ...j.transfers.flatMap(t => t.legs),
    ...j.homeward.legs,
  ].filter(l => l.kind !== 'road');
  const cell: React.CSSProperties = { border:'0.6px solid #000', padding:'3px 6px', fontSize:8.4, textAlign:'left' };
  const th: React.CSSProperties = { ...cell, background:'#ececec', textTransform:'uppercase', letterSpacing:'.05em', fontSize:7, fontWeight:'bold' };
  return <div className="tse-print" style={{ background:'#fff', color:'#000', fontFamily:'Helvetica,Arial,sans-serif', border:'1.5px solid #000' }}>
    <div style={{ display:'flex', justifyContent:'space-between', borderBottom:'1.5px solid #000', padding:'8px 10px' }}>
      <div><div style={{ fontSize:14, fontWeight:'bold' }}>THE SAFARI EDITION</div><div style={{ fontSize:7.5, letterSpacing:'.16em' }}>ITINERARY &amp; TRAVEL DOCUMENT</div></div>
      <div style={{ fontFamily:'monospace', fontSize:7.5, textAlign:'right' }}>REF: {j.ref}<br/>{j.nights} NIGHTS · {j.segments.length} CAMPS</div>
    </div>
    <div style={{ background:'#000', color:'#fff', fontSize:7.5, letterSpacing:'.16em', padding:'3px 10px', fontWeight:'bold' }}>FLIGHTS &amp; AIR (LOCAL TIME)</div>
    <table style={{ width:'100%', borderCollapse:'collapse' }}><tbody>
      <tr><th style={th}>Flight</th><th style={th}>Carrier</th><th style={th}>Depart</th><th style={th}>Arrive</th><th style={th}>Duration</th><th style={th}>Status</th></tr>
      {allLegs.length > 0 ? allLegs.map((l,i) => <tr key={i}>
        <td style={{ ...cell, fontFamily:'monospace' }}>{l.no || '—'}</td>
        <td style={cell}>{l.carrier}</td>
        <td style={cell}>{l.depApt} {safeHm(l.dep)}</td>
        <td style={cell}>{l.arrApt} {safeHm(l.arr)}</td>
        <td style={cell}>{safeDur(l.dep, l.arr, l.durationMin)}</td>
        <td style={{ ...cell, fontWeight:'bold' }}>CONFIRMING</td>
      </tr>) : <tr><td colSpan={6} style={cell}>Flights confirmed by your specialist</td></tr>}
    </tbody></table>
    <div style={{ background:'#000', color:'#fff', fontSize:7.5, letterSpacing:'.16em', padding:'3px 10px', fontWeight:'bold' }}>ACCOMMODATION</div>
    <table style={{ width:'100%', borderCollapse:'collapse' }}><tbody>
      <tr><th style={th}>Nts</th><th style={th}>Property</th><th style={th}>Region</th><th style={th}>Dates</th><th style={th}>Status</th></tr>
      {j.segments.map((sg,i) => <tr key={i}><td style={cell}>{sg.nights}</td><td style={cell}>{sg.lodge}</td><td style={cell}>{sg.bandRegion}</td><td style={cell}>{sg.dates}</td><td style={{ ...cell, fontWeight:'bold' }}>CONFIRMING · {sg.ref || j.ref}</td></tr>)}
    </tbody></table>
    {(j.activities?.length ?? 0) > 0 && <>
      <div style={{ background:'#000', color:'#fff', fontSize:7.5, letterSpacing:'.16em', padding:'3px 10px', fontWeight:'bold' }}>SELECTED EXPERIENCES</div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}><tbody>
        <tr><th style={th}>Experience</th><th style={th}>Region</th><th style={th}>Note</th></tr>
        {j.activities!.map((a,i) => <tr key={i}><td style={cell}>{a.name}</td><td style={cell}>{a.region}</td><td style={cell}>Day to be confirmed by specialist</td></tr>)}
      </tbody></table>
    </>}
    <div style={{ fontSize:7.4, padding:'5px 10px', borderTop:'0.6px solid #000' }}><b>CONSIDERED FOR YOU:</b> connection buffers on cross-border joins · borders &amp; visas arranged ahead · no same-day onward flight after long-haul · evening flight home keeps your final day free.</div>
  </div>;
}

function Drawer({ j, onClose }: any) {
  const first = j.specialist.name.split(' ')[0];
  const [msgs, setMsgs] = useState<any[]>([{ who:'ai', t:`Hello ${j.travellers[0].split(' ')[0]} — ask me anything, or say "speak to a person".` }]);
  const [v, setV] = useState('');
  const inputStyle: React.CSSProperties = { width:'100%', background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:'11px 13px', borderRadius:9, fontFamily:F.b, fontSize:14, fontWeight:300, outline:'none' };
  const send = () => { if (!v.trim()) return; const t = v.trim(); setV(''); setMsgs(mm => [...mm, { who:'me', t }]);
    setTimeout(() => { const h = /human|person|someone|real/i.test(t) || t.toLowerCase().includes(first.toLowerCase());
      setMsgs(mm => [...mm, h ? { who:'ai', t:`Connecting you with ${first} now — she has your full journey. ✦`, human:true } : { who:'ai', t:`Happy to help — ${first} is one tap away whenever you'd like a human.` }]); }, 600); };
  return <div style={{ position:'fixed', bottom:0, right:0, width:'min(380px,100vw)', height:'min(540px,80vh)', zIndex:150, background:C.bg2, borderLeft:`1px solid ${C.border}`, borderTop:`1px solid ${C.border}`, borderTopLeftRadius:16, display:'flex', flexDirection:'column' }}>
    <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between' }}>
      <div><div style={{ fontSize:14 }}>The Safari Edition</div><div style={{ fontSize:11, color:C.green }}>● {first} online · ~15 min</div></div>
      <button onClick={onClose} style={{ background:'none', border:'none', color:C.textMid, fontSize:20, cursor:'pointer' }}>×</button>
    </div>
    <div style={{ flex:1, overflowY:'auto', padding:14, display:'flex', flexDirection:'column', gap:10 }}>
      {msgs.map((mm,i) => <div key={i} style={{ alignSelf: mm.who==='me' ? 'flex-end':'flex-start', maxWidth:'82%', background: mm.who==='me' ? C.gold : mm.human ? `${C.green}1c` : C.surface, color: mm.who==='me' ? '#1a1206' : C.text, border: mm.human ? `1px solid ${C.green}55`:'none', padding:'9px 12px', borderRadius:12, fontSize:13.5 }}>{mm.t}</div>)}
    </div>
    <div style={{ padding:12, borderTop:`1px solid ${C.border}`, display:'flex', gap:8 }}>
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} placeholder="Message…" style={{ ...inputStyle, padding:'10px 12px' }} />
      <Btn onClick={send}>→</Btn>
    </div>
  </div>;
}

// ── Quote excitement ──────────────────────────────────────────────────────────
function QuoteExcitement({ j, total, m, onChat }: any) {
  const hold = useCountdown(new Date(Date.now() + 6 * 864e5));
  const deposit = j.price.GBP.fly + Math.round((total - j.price.GBP.fly) * 0.3);
  return <div style={{ background:`linear-gradient(160deg,${C.surface},#211d12)`, border:`1px solid ${C.borderGold}`, borderRadius:16, padding:22, margin:'22px 0 0' }}>
    <div style={{ fontFamily:F.d, fontSize:26, color:C.goldLight }}>This is the journey waiting for you</div>
    <div style={{ display:'grid', gap:6, margin:'12px 0' }}>{j.segments.map((sg: Segment) => <div key={sg.id} style={{ display:'flex', gap:9, fontSize:14 }}><span style={{ color:C.gold }}>✦</span><span style={{ color:C.text }}><b>{sg.bandName}.</b> {sg.narrative || sg.bandRegion}</span></div>)}</div>
    <div style={{ background:C.goldDim, border:`1px solid ${C.borderGold}`, borderRadius:12, padding:14, margin:'14px 0' }}>
      <div style={{ fontFamily:F.d, fontSize:18, color:C.goldLight, marginBottom:6 }}>Confirm to unlock your full journey companion</div>
      {['Every camp in motion — films, sounds, the places brought to life','Your countdown begins, and your day-planner opens','A page you can share with family — and a specialist who\'s already yours'].map((t,i) => <div key={i} style={{ display:'flex', gap:9, fontSize:13.5, color:C.text, marginBottom:4 }}><span style={{ color:C.gold }}>→</span>{t}</div>)}
    </div>
    <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:14, alignItems:'flex-end' }}>
      <div><div style={{ fontSize:11, letterSpacing:'.12em', color:C.textMid }}>TO CONFIRM</div><div style={{ fontFamily:F.d, fontSize:34, color:C.text }}>{m(deposit)}</div><div style={{ fontSize:13, color:C.textMid }}>deposit · fully refundable with Cancel-for-any-Reason Cover</div></div>
      <div style={{ textAlign:'right' }}><div style={{ fontSize:12, color:C.gold }}>✦ Held for you</div><div style={{ fontSize:13, color:C.textMid }}>Price &amp; rooms: <b style={{ color:C.text }}>{hold.d}d {hold.h}h</b></div></div>
    </div>
    <div style={{ marginTop:14 }}><Btn onClick={() => { window.location.href = `/checkout?id=${(j as any).itineraryId || ''}`; }}>Secure this journey — fully refundable →</Btn></div>
  </div>;
}

function PaymentPanel({ tt, bDue, m, onPay, onPrint, onCancel }: any) {
  const cd = useCountdown(bDue); const pct = Math.round(tt.paid / tt.total * 100);
  return <><div style={{ margin:'44px 0 18px' }}><div style={{ fontFamily:F.b, fontSize:11, letterSpacing:'.24em', color:C.gold, marginBottom:8 }}>YOUR INVESTMENT</div><h2 style={{ fontFamily:F.d, fontSize:'clamp(28px,3.6vw,40px)', margin:0, fontWeight:500 }}>Payment</h2><p style={{ color:C.textMid, fontSize:14, maxWidth:640, marginTop:8 }}>Held in a protected client trust account and released to each camp as your journey is delivered.</p></div>
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        {[['Total', m(tt.total)], ['Paid', m(tt.paid)], ['Balance', m(tt.balance)], ['Balance due', fmtDate(bDue)]].map(([l,v]:any,i:number) => <div key={l}><div style={{ fontSize:11, letterSpacing:'.12em', color:C.textMid, marginBottom:4 }}>{l.toUpperCase()}</div><div style={{ fontFamily:F.d, fontSize:24, color: i===1 ? C.goldLight : C.text }}>{v}</div></div>)}</div>
      <div style={{ height:8, background:C.bg, borderRadius:6, overflow:'hidden', margin:'16px 0 8px' }}><div style={{ width:pct+'%', height:'100%', background:`linear-gradient(90deg,${C.gold},${C.goldLight})` }} /></div>
      <div style={{ fontSize:12, color:C.textMid }}>{pct}% paid · balance auto-collected in {cd.d} days.</div>
      <div style={{ display:'flex', gap:10, marginTop:16, flexWrap:'wrap' }}><Btn onClick={onPay}>Make a payment →</Btn><Btn kind="ghost" onClick={onCancel}>Cancellation terms</Btn><Btn kind="ghost" onClick={onPrint}>Simple itinerary</Btn></div>
    </div></>;
}

function SecurePanel({ total, m, onChat, onPrint, j }: any) {
  return <><div style={{ margin:'44px 0 18px' }}><div style={{ fontFamily:F.b, fontSize:11, letterSpacing:'.24em', color:C.gold, marginBottom:8 }}>READY WHEN YOU ARE</div><h2 style={{ fontFamily:F.d, fontSize:'clamp(28px,3.6vw,40px)', margin:0, fontWeight:500 }}>Secure your journey</h2><p style={{ color:C.textMid, fontSize:14, maxWidth:640, marginTop:8 }}>No payment is taken until you confirm. Securing now locks every price and holds your camps.</p></div>
    <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}><Btn onClick={() => { window.location.href = `/checkout?id=${(j as any).itineraryId || ''}`; }}>Secure now — fully refundable →</Btn><Btn kind="ghost" onClick={onChat}>Speak to a specialist</Btn><Btn kind="ghost" onClick={onPrint}>Save itinerary (PDF)</Btn></div></>;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function JourneyMiniSite({ journey, mode = 'quote', visitCount = 1 }:
  { journey: Journey; mode?: 'quote' | 'confirmed'; visitCount?: number }) {
  const j = journey;
  const sym = j.price.GBP.sym;
  const m = (n: number) => fmtMoney(n, sym);
  const tier = mode === 'quote' ? 'quote' : visitCount >= 2 ? 'immersive' : 'arrival';
  const immersive = tier === 'immersive';
  const cd = useCountdown(j.startISO);
  const [modal, setModal] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<any>(null);
  const fired = useRef(false);
  const activities = j.activities || [];

  const copy = emoTive(j);

  useEffect(() => {
    if ((j as any).itineraryId) (window as any).__journeyItineraryId = (j as any).itineraryId;
  }, [j]);

  useEffect(() => {
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Jost:wght@200;300;400;500;600&display=swap';
    document.head.appendChild(link);
    const st = document.createElement('style');
    st.innerHTML = `@keyframes kbZoom{from{transform:scale(1.04)}to{transform:scale(1.16) translateY(-2%)}}\n.tse-ms *{box-sizing:border-box}\n::-webkit-scrollbar{width:2px;height:2px}::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3)}\n@media print{body *{visibility:hidden!important}.tse-print,.tse-print *{visibility:visible!important}.tse-print{position:absolute!important;left:0;top:0;width:100%}}`;
    document.head.appendChild(st);
    return () => { try { document.head.removeChild(link); document.head.removeChild(st); } catch {} };
  }, []);

  useEffect(() => { if (mode !== 'quote' || fired.current) return; fired.current = true;
    const t = setTimeout(() => setPriceChange({ seg: j.segments[1]?.lodge || '', from: j.segments[1]?.value || 0, to: (j.segments[1]?.value || 0) + 420 }), 2400);
    return () => clearTimeout(t); }, [mode]);

  const vehTotal = 0; // vehicle upsell currently disabled for simplicity
  const tt = totals(j, 'GBP', vehTotal, priceChange ? priceChange.to - priceChange.from : 0);
  const bDue = balanceDue(j);

  // Build region tips from segment narratives and kb
  const regionTips = j.segments.map(sg => ({
    region: sg.bandRegion,
    tip: sg.narrative || sg.kb || '',
  })).filter(t => t.tip);

  return <div className="tse-ms" style={{ background:C.bg, color:C.text, fontFamily:F.b, fontWeight:300, minHeight:'100vh' }}>

    {/* ── HERO ─────────────────────────────────────────────────────────────── */}
    <section style={{ position:'relative', height: tier === 'arrival' ? '58vh' : '82vh', minHeight:520, display:'flex', alignItems:'flex-end', overflow:'hidden' }}>
      {j.segments[0]?.img ? (
        <div style={{ position:'absolute', inset:0 }}>
          <img src={j.segments[0].img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', animation:'kbZoom 20s ease-in-out infinite alternate' }} />
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(0deg, ${C.bg} 0%, rgba(10,10,10,0.55) 50%, rgba(10,10,10,0.2) 100%)` }} />
        </div>
      ) : <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg, #0a0a0a, #1a1206)` }} />}
      <div style={{ position:'relative', maxWidth:1020, margin:'0 auto', padding:'0 24px 52px', width:'100%' }}>
        <div style={{ marginBottom:14, display:'flex', gap:10, flexWrap:'wrap' }}>
          {mode === 'quote' && <span style={{ display:'inline-block', background:C.goldDim, border:`1px solid ${C.borderGold}`, color:C.goldLight, padding:'5px 14px', borderRadius:20, fontSize:11, letterSpacing:'.04em' }}>{copy.badge}</span>}
          {tier === 'arrival' && <span style={{ display:'inline-block', background:`${C.green}18`, border:`1px solid ${C.green}55`, color:C.green, padding:'5px 14px', borderRadius:20, fontSize:11 }}>✓ Confirmed — welcome aboard</span>}
          {(j.themes || []).slice(0,3).map((th,i) => <span key={i} style={{ display:'inline-block', background:'rgba(255,255,255,0.06)', border:`0.5px solid rgba(255,255,255,0.12)`, color:C.textMid, padding:'4px 12px', borderRadius:20, fontSize:10, letterSpacing:'.08em' }}>{th}</span>)}
        </div>
        <div style={{ letterSpacing:'.18em', fontSize:11, color:C.gold, marginBottom:12 }}>{j.route.join('  ·  ')}</div>
        <h1 style={{ fontFamily:F.d, fontSize:'clamp(36px,5.5vw,68px)', lineHeight:1.0, margin:'0 0 16px', fontWeight:500, maxWidth:800 }}>{copy.headline}</h1>
        <p style={{ fontSize:15, color:C.textMid, maxWidth:580, lineHeight:1.65, margin:'0 0 22px' }}>{copy.sub}</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:18, fontSize:14, marginBottom:24 }}>
          <span style={{ color:C.text }}>{j.travellers.join(' & ')}</span>
          <span style={{ color:C.textDim }}>|</span>
          <span style={{ color:C.textDim }}>{fmtDate(j.startISO)} · {j.nights} nights</span>
        </div>
        {tier !== 'arrival' && (
          <div style={{ display:'flex', gap:24 }}>
            {[['Days',cd.d],['Hrs',cd.h],['Min',cd.m],['Sec',cd.s]].map(([l,v]:any) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:F.d, fontSize:38, color:C.goldLight, lineHeight:1 }}>{String(v).padStart(2,'0')}</div>
                <div style={{ fontSize:9, letterSpacing:'.2em', color:C.textMid, marginTop:4 }}>{l.toUpperCase()}</div>
              </div>
            ))}
            <div style={{ alignSelf:'center', fontSize:12, color:C.textMid, maxWidth:150, lineHeight:1.5 }}>
              {mode === 'quote' ? 'begins the moment you confirm' : 'until you set off'}
            </div>
          </div>
        )}
      </div>
    </section>

    <div style={{ maxWidth:1020, margin:'0 auto', padding:'0 24px' }}>
      {tier === 'arrival' && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px 20px', margin:'22px 0 0' }}>
          <div style={{ fontFamily:F.d, fontSize:22, marginBottom:4 }}>You're all set, {j.travellers[0].split(' ')[0]}.</div>
          <p style={{ color:C.textMid, fontSize:14, margin:0 }}>Everything below is confirmed and looked after. Come back whenever you like — your full journey lives here, day by day, until you travel. ✦</p>
        </div>
      )}

      {mode === 'quote' && <QuoteExcitement j={j} total={tt.total} m={m} onChat={() => setModal('chat')} />}
      {priceChange && mode === 'quote' && <div style={{ fontSize:12, color:C.amber, margin:'10px 0' }}>1 rate refreshed since you saved ({priceChange.seg}: {m(priceChange.from)} → {m(priceChange.to)}). Confirm now to lock.</div>}

      <SpecialistCard j={j} onChat={() => setModal('chat')} />

      {/* ── 3-COLUMN DAY BY DAY ───────────────────────────────────────────── */}
      <div style={{ margin:'44px 0 18px' }}>
        <div style={{ fontFamily:F.b, fontSize:11, letterSpacing:'.24em', color:C.gold, marginBottom:8 }}>DAY BY DAY</div>
        <h2 style={{ fontFamily:F.d, fontSize:'clamp(28px,3.6vw,40px)', margin:0, fontWeight:500 }}>Your itinerary</h2>
        <p style={{ color:C.textMid, fontSize:14, marginTop:8 }}>In date order — confirmed properties and what your specialist is arranging.</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 180px', gap:24, alignItems:'start' }}
        className="ms-3col">
        <style>{`@media(max-width:900px){.ms-3col{grid-template-columns:1fr !important}.ms-left-col,.ms-right-col{display:none!important}}`}</style>

        {/* LEFT: region tips */}
        <div className="ms-left-col" style={{ position:'sticky', top:80 }}>
          {regionTips.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:8, color:C.textDim, letterSpacing:'.32em', textTransform:'uppercase', paddingBottom:10, borderBottom:`0.5px solid ${C.border}` }}>Specialist Notes</div>
              {regionTips.map((rt,i) => (
                <div key={i} style={{ paddingBottom:14, borderBottom:`0.5px solid ${C.border}` }}>
                  <div style={{ fontSize:8, color:C.gold, letterSpacing:'.2em', textTransform:'uppercase', marginBottom:5 }}>{rt.region}</div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7, fontStyle:'italic' }}>"{rt.tip.length > 120 ? rt.tip.slice(0,120)+'…' : rt.tip}"</div>
                </div>
              ))}
              {j.specialist.rec && (
                <div style={{ paddingBottom:14 }}>
                  <div style={{ fontSize:8, color:C.gold, letterSpacing:'.2em', textTransform:'uppercase', marginBottom:5 }}>From {j.specialist.name.split(' ')[0]}</div>
                  <div style={{ fontSize:11, color:C.textMid, lineHeight:1.7, fontStyle:'italic' }}>"{j.specialist.rec.length > 140 ? j.specialist.rec.slice(0,140)+'…' : j.specialist.rec}"</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: chronological timeline */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Arrival transfer + flight */}
          {(j.transfers[0]?.legs.length > 0 || j.transfers[0]?.notes.length > 0) && (
            <TransferBlock t={j.transfers[0]} />
          )}

          {/* Properties with inter-region transfers */}
          {j.segments.map((sg, i) => (
            <React.Fragment key={sg.id}>
              <PropertyCard sg={sg} mode={mode} activities={activities} />
              {i < j.segments.length - 1 && j.transfers[i + 1] && (
                <TransferBlock t={j.transfers[i + 1]} />
              )}
            </React.Fragment>
          ))}

          {/* Homeward */}
          {(j.homeward.legs.length > 0 || j.homeward.notes.length > 0) && (
            <TransferBlock t={j.homeward} />
          )}
        </div>

        {/* RIGHT: activities + inclusions */}
        <div className="ms-right-col" style={{ position:'sticky', top:80 }}>
          {activities.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:8, color:C.textDim, letterSpacing:'.32em', textTransform:'uppercase', paddingBottom:10, borderBottom:`0.5px solid ${C.border}`, marginBottom:12 }}>Your Experiences</div>
              {activities.map((act, i) => (
                <div key={i} style={{ marginBottom:12, paddingBottom:12, borderBottom: i < activities.length-1 ? `0.5px solid ${C.border}` : 'none' }}>
                  <div style={{ fontSize:11, color:C.text, fontWeight:500, lineHeight:1.3 }}>{act.name}</div>
                  <div style={{ fontSize:9, color:C.gold, marginTop:3, letterSpacing:'.1em' }}>{act.region}</div>
                  {act.duration && <div style={{ fontSize:9, color:C.textDim, marginTop:2 }}>{act.duration}</div>}
                </div>
              ))}
              <div style={{ fontSize:9, color:C.textDim, fontStyle:'italic', lineHeight:1.6, marginTop:8 }}>Day scheduling to be confirmed by your specialist.</div>
            </div>
          )}
          {j.included.length > 0 && (
            <div>
              <div style={{ fontSize:8, color:C.textDim, letterSpacing:'.32em', textTransform:'uppercase', paddingBottom:10, borderBottom:`0.5px solid ${C.border}`, marginBottom:12 }}>Always Included</div>
              {j.included.map((inc,i) => (
                <div key={i} style={{ display:'flex', gap:7, marginBottom:7 }}>
                  <span style={{ color:C.gold, fontSize:9, marginTop:2, flexShrink:0 }}>✦</span>
                  <span style={{ fontSize:11, color:C.textMid, lineHeight:1.5 }}>{inc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PRE-TRAVEL TIMELINE ───────────────────────────────────────────── */}
      <PreTravelTimeline j={j} />

      {/* ── PAYMENT / SECURE ─────────────────────────────────────────────── */}
      {mode === 'quote'
        ? <SecurePanel j={j} total={tt.total} m={m} onChat={() => setModal('chat')} onPrint={() => setModal('print')} />
        : <PaymentPanel tt={tt} bDue={bDue} m={m} onPay={() => setModal('pay')} onPrint={() => setModal('print')} onCancel={() => setModal('cancel')} />
      }

      <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', margin:'28px 0 12px' }}>
        <Btn kind="ghost" small onClick={() => setModal('print')}>⤓ Simple itinerary (PDF)</Btn>
        <Btn kind="ghost" small onClick={() => setModal('share')}>＋ Share this journey</Btn>
        {mode !== 'quote' && <Btn kind="ghost" small onClick={() => setModal('cancel')}>Cancel or modify</Btn>}
      </div>
      <div style={{ textAlign:'center', color:C.textDim, fontSize:11, padding:'8px 0 48px', letterSpacing:'.08em' }}>
        thesafariedition.com/journey/{j.ref} · private link · The Travel Catalogue
      </div>
    </div>

    {/* ── MODALS ───────────────────────────────────────────────────────────── */}
    {modal === 'chat' && <Drawer j={j} onClose={() => setModal(null)} />}
    {modal === 'print' && <ModalShell title="Simple itinerary" wide onClose={() => setModal(null)}>
      <p style={{ color:C.textMid, fontSize:13, marginTop:0 }}>A plain travel document — print or save as PDF.</p>
      <SimpleDoc j={j} />
      <div style={{ marginTop:14 }}><Btn full onClick={() => window.print()}>⤓ Print / Save as PDF</Btn></div>
    </ModalShell>}
    {modal === 'cancel' && <ModalShell title="Cancellation terms" onClose={() => setModal(null)}>
      <p style={{ color:C.textMid, fontSize:14, marginTop:0, lineHeight:1.65 }}>To modify or cancel your journey, please contact your specialist directly. Standard terms: 50% refund up to 45 days before travel.</p>
      <Btn full kind="ghost" onClick={() => setModal(null)}>Close</Btn>
    </ModalShell>}
    {modal === 'pay' && <ModalShell title="Make a payment" onClose={() => setModal(null)}>
      <p style={{ color:C.textMid, fontSize:14, marginTop:0 }}>Pay any amount toward {m(tt.balance)} or settle in full. Auto-collects {fmtDate(bDue)}.</p>
      <Btn full onClick={() => setModal(null)}>Continue securely →</Btn>
    </ModalShell>}
    {modal === 'share' && <ModalShell title="Share this journey" onClose={() => setModal(null)}>
      <input readOnly value={`thesafariedition.com/journey/${j.ref}`} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:'11px 13px', borderRadius:9, fontFamily:F.b, fontSize:14, outline:'none' }} />
      <div style={{ marginTop:12 }}><Btn full onClick={() => setModal(null)}>Copy link</Btn></div>
    </ModalShell>}
  </div>;
}
