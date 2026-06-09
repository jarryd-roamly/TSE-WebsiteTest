'use client';
// components/JourneyMiniSite.tsx
// Dark, immersive post-booking / quote companion. Self-contained styling.
// Reads the ONE source: app/lib/journey.ts (+ journeyFormat). Drop-in.
import React, { useState, useEffect, useRef } from 'react';
import { Journey, Segment, Transfer, Leg, totals, balanceDue } from '@/app/lib/journey';
import { money as fmtMoney, fmtDate, statusWord, hm, durStr } from '@/app/lib/journeyFormat';

const C = {
  bg: '#0a0a0a', bg2: '#111111', surface: '#1a1a1a',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.12)', borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)', green: '#4ade80', red: '#f87171', amber: '#fb923c',
};
const F = { d: "'Cormorant Garamond', Georgia, serif", b: "'Jost', system-ui, sans-serif" };
const input: React.CSSProperties = { width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: '11px 13px', borderRadius: 9, fontFamily: F.b, fontSize: 14, fontWeight: 300, outline: 'none' };
const place = (s: Segment) => `${s.bandName}, ${s.bandRegion}`;

function useCountdown(target: string | Date) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = Math.max(0, new Date(target).getTime() - n);
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms % 864e5 / 36e5), m: Math.floor(ms % 36e5 / 6e4), s: Math.floor(ms % 6e4 / 1e3) };
}
const Btn = ({ children, onClick, kind = 'gold', full, small }: any) => {
  const base: React.CSSProperties = { fontFamily: F.b, fontWeight: 500, cursor: 'pointer', borderRadius: 9, padding: small ? '8px 14px' : '12px 22px', fontSize: small ? 13 : 14, width: full ? '100%' : 'auto' };
  const k: any = { gold: { ...base, background: `linear-gradient(180deg,${C.goldLight},${C.gold})`, color: '#1a1306', border: 'none' },
    ghost: { ...base, background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    dark: { ...base, background: C.surface, color: C.text, border: `1px solid ${C.border}` } };
  return <button onClick={onClick} style={k[kind]}>{children}</button>;
};
const SectionTitle = ({ k, t, sub }: any) => <div style={{ margin: '44px 0 18px' }}>
  <div style={{ fontFamily: F.b, fontSize: 11, letterSpacing: '.24em', color: C.gold, marginBottom: 8 }}>{k.toUpperCase()}</div>
  <h2 style={{ fontFamily: F.d, fontSize: 'clamp(28px,3.6vw,40px)', margin: 0, fontWeight: 500, lineHeight: 1.04 }}>{t}</h2>
  {sub && <p style={{ color: C.textMid, fontSize: 15, maxWidth: 640, marginTop: 8 }}>{sub}</p>}</div>;
const Chip = ({ status, small }: any) => {
  const m: any = { confirmed: C.green, confirming: C.amber, held: C.gold }[status];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: F.b, fontSize: small ? 10 : 11, color: m, border: `1px solid ${m}55`, background: `${m}14`, padding: small ? '2px 8px' : '3px 10px', borderRadius: 20 }}><span style={{ width: 5, height: 5, borderRadius: 5, background: m }} />{statusWord(status)}</span>;
};
function Scene({ tone, img, reel, immersive, dim = .45 }: any) {
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 0, background: tone }} />
    {immersive && reel
      ? <video autoPlay muted loop playsInline poster={img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .92 }}><source src={reel} /></video>
      : img && <img src={img} alt="" onError={(e: any) => (e.currentTarget.style.display = 'none')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .9, animation: `kbZoom ${immersive ? 16 : 30}s ease-in-out infinite alternate` }} />}
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg,#0007,${C.bg}${dim > .5 ? 'ee' : '99'} 72%,${C.bg})` }} />
    {immersive && !reel && <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, letterSpacing: '.12em', color: C.text, background: '#0008', border: `1px solid ${C.border}`, borderRadius: 14, padding: '3px 9px' }}>▶ REEL · supplier video patches here</span>}
  </div>;
}
function LegRow({ l }: { l: Leg }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
    <span style={{ width: 24, textAlign: 'center', color: C.textMid }}>{l.kind === 'road' ? '↣' : '✈'}</span>
    {l.kind === 'road'
      ? <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: C.text }}>{l.carrier}</div><div style={{ fontSize: 11, color: C.textMid }}>{l.depApt} → {l.arrApt} · {durStr(l.dep, l.arr)}</div></div>
      : <><div style={{ minWidth: 92 }}><div style={{ fontSize: 13, color: C.text }}>{l.carrier}</div><div style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>{l.no}</div></div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 190 }}>
          <div style={{ textAlign: 'right' }}><div style={{ fontFamily: F.d, fontSize: 17 }}>{hm(l.dep)}</div><div style={{ fontSize: 10, color: C.textMid }}>{l.depApt}</div></div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: C.textDim }}>{durStr(l.dep, l.arr)}<div style={{ height: 1, background: C.border, margin: '3px 0' }} /></div>
          <div><div style={{ fontFamily: F.d, fontSize: 17 }}>{hm(l.arr)}</div><div style={{ fontSize: 10, color: C.textMid }}>{l.arrApt}</div></div></div></>}
    <Chip status={l.status} small />
  </div>;
}
function TransferBlock({ t }: { t: Transfer }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 16px' }}>
    <div style={{ fontSize: 11, letterSpacing: '.16em', color: C.gold, marginBottom: 6 }}>{t.tag.toUpperCase()}</div>
    {t.legs.map((l, i) => <div key={i} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}><LegRow l={l} /></div>)}
    {t.notes.map((n, i) => <div key={i} style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12.5, lineHeight: 1.45, background: (n.good ? C.green : C.amber) + '10', borderRadius: 8, padding: '8px 11px' }}><span style={{ color: n.good ? C.green : C.amber }}>{n.good ? '✓' : 'ⓘ'}</span><span style={{ color: C.text }}>{n.text}</span></div>)}
  </div>;
}
function SpecialistCard({ j, onChat, showNote }: any) {
  const sp = j.specialist;
  return <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, margin: '22px 0 6px' }}>
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(140deg,${C.gold},#7a5a26)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.d, fontSize: 22, color: '#1a1206', flexShrink: 0 }}>{sp.initials}</div>
      <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 11, letterSpacing: '.14em', color: C.gold }}>{(sp.role || '').toUpperCase()}</div>
        <div style={{ fontFamily: F.d, fontSize: 22 }}>{sp.name}</div>
        {sp.response && <div style={{ fontSize: 13, color: C.textMid }}>{sp.response}</div>}</div>
      <div style={{ display: 'flex', gap: 8 }}><Btn small onClick={onChat}>WhatsApp</Btn><Btn small kind="ghost" onClick={onChat}>Chat</Btn></div>
    </div>
    {showNote && sp.rec && <p style={{ fontFamily: F.d, fontSize: 17, fontStyle: 'italic', color: C.text, margin: '12px 0 0', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>{sp.rec}</p>}
  </div>;
}
function KBItem({ title, body }: any) { const [o, setO] = useState(false);
  return <div style={{ borderBottom: `1px solid ${C.border}` }}><div onClick={() => setO(!o)} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer' }}><span style={{ fontSize: 14, color: C.text }}>{title}</span><span style={{ color: C.gold }}>{o ? '–' : '+'}</span></div>{o && <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5, margin: '0 0 12px' }}>{body}</p>}</div>;
}
function ModalShell({ title, children, onClose, wide }: any) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000000cc', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 14px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: wide ? 720 : 460, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}><div style={{ fontFamily: F.d, fontSize: 22 }}>{title}</div><button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMid, fontSize: 22, cursor: 'pointer' }}>×</button></div>
      <div style={{ padding: 20 }}>{children}</div></div></div>;
}


function ShareModal({ j, onClose }: { j: Journey; onClose: () => void }) {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/journey/${j.ref}?mode=confirmed`
    : `https://thesafariedition.com/journey/${j.ref}?mode=confirmed`;
  const [emails, setEmails] = useState('');
  const [note, setNote]     = useState('');
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent('Here is your Safari Edition journey: ' + url)}`, '_blank');
  };
  const send = async () => {
    const list = emails.split(/[\s,;]+/).map((e:string) => e.trim()).filter((e:string) => e.includes('@'));
    if (!list.length) { setErrMsg('Enter at least one valid email address.'); return; }
    setStatus('sending'); setErrMsg('');
    try {
      const res = await fetch('/api/send-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_reference: j.ref, recipients: list, note, sender_name: j.specialist?.name || 'The Safari Edition' }),
      });
      const data = await res.json();
      if (data.success) { setStatus('sent'); }
      else { setStatus('error'); setErrMsg(data.error || 'Could not send — check your email provider.'); }
    } catch (e: any) { setStatus('error'); setErrMsg(e.message); }
  };

  return (
    <ModalShell title="Share this journey" onClose={onClose}>
      <p style={{ color: C.textMid, fontSize: 13, marginTop: 0, marginBottom: 20 }}>Share the private minisite with family, friends, or anyone who should follow along.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input readOnly value={url} style={{ ...input, flex: 1, fontSize: 12, color: C.textDim }} />
        <button onClick={copy} style={{ padding: '0 16px', background: copied ? 'rgba(74,222,128,0.15)' : C.surface, border: `1px solid ${copied ? C.green : C.border}`, borderRadius: 9, color: copied ? C.green : C.text, fontFamily: F.b, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{copied ? '✓ Copied' : 'Copy link'}</button>
        <button onClick={whatsapp} style={{ padding: '0 14px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 9, color: '#25D366', fontFamily: F.b, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>WhatsApp</button>
      </div>
      <div style={{ height: '0.5px', background: C.border, margin: '0 0 20px' }} />
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: '.14em', color: C.gold, marginBottom: 8 }}>SEND BY EMAIL</div>
        <input value={emails} onChange={e => { setEmails(e.target.value); setErrMsg(''); setStatus('idle'); }} placeholder="email@example.com, another@example.com" style={{ ...input, marginBottom: 10 }} />
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a personal note (optional)..." rows={3} style={{ ...input, resize: 'vertical', lineHeight: 1.5 } as React.CSSProperties} />
      </div>
      {errMsg && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: C.red }}>{errMsg}</div>}
      {status === 'sent' && <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '10px 13px', marginBottom: 12, fontSize: 12, color: C.green }}>✓ Sent successfully</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn full kind={status === 'sent' ? 'dark' : 'gold'} onClick={status === 'sent' ? onClose : send}>{status === 'sending' ? 'Sending...' : status === 'sent' ? 'Done' : 'Send email →'}</Btn>
        {status !== 'sent' && <Btn kind="ghost" onClick={onClose}>Cancel</Btn>}
      </div>
    </ModalShell>
  );
}

export default function JourneyMiniSite({ journey, mode = 'quote', visitCount = 1 }:
  { journey: Journey; mode?: 'quote' | 'confirmed'; visitCount?: number }) {
  const j = journey;
  const sym = j.price.GBP.sym;
  const m = (n: number) => fmtMoney(n, sym);
  const tier = mode === 'quote' ? 'quote' : visitCount >= 2 ? 'immersive' : 'arrival';
  const immersive = tier === 'immersive';
  const cd = useCountdown(j.startISO);
  const [veh, setVeh] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<any>(null);
  const fired = useRef(false);

  // Store itineraryId on window so SecurePanel can access it for checkout redirect
  useEffect(() => {
    if ((j as any).itineraryId) {
      (window as any).__journeyItineraryId = (j as any).itineraryId;
    }
  }, [j]);

  useEffect(() => {
    const link = document.createElement('link'); link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Jost:wght@200;300;400;500;600&display=swap';
    document.head.appendChild(link);
    const st = document.createElement('style');
    st.innerHTML = `@keyframes kbZoom{from{transform:scale(1.04)}to{transform:scale(1.16) translateY(-2%)}}
      .tse-ms input[type=range]{-webkit-appearance:none;height:2px;background:rgba(255,255,255,.12);border-radius:2px}
      .tse-ms input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:${C.gold};cursor:pointer}
      @media print{body *{visibility:hidden!important}.tse-print,.tse-print *{visibility:visible!important}.tse-print{position:absolute!important;left:0;top:0;width:100%}}`;
    document.head.appendChild(st);
    return () => { try { document.head.removeChild(link); document.head.removeChild(st); } catch (e) {} };
  }, []);
  useEffect(() => { if (mode !== 'quote' || fired.current) return; fired.current = true;
    const t = setTimeout(() => setPriceChange({ seg: j.segments[1]?.lodge || 'A camp', from: j.segments[1]?.value || 0, to: (j.segments[1]?.value || 0) + 420 }), 2400);
    return () => clearTimeout(t); }, [mode]);

  const vehTotal = j.segments.reduce((a, s) => a + (veh[s.id] && s.vehPerDay ? s.vehPerDay * s.nights : 0), 0);
  const tt = totals(j, 'GBP', vehTotal, priceChange ? priceChange.to - priceChange.from : 0);
  const bDue = balanceDue(j);

  return <div className="tse-ms" style={{ background: C.bg, color: C.text, fontFamily: F.b, fontWeight: 300, minHeight: '100vh' }}>
    {/* HERO */}
    <section style={{ position: 'relative', height: tier === 'arrival' ? '58vh' : '76vh', minHeight: 460, display: 'flex', alignItems: 'flex-end' }}>
      <Scene tone={j.segments[0].tone} img={j.segments[0].img} reel={j.heroReel} immersive={immersive || mode === 'quote'} dim={.5} />
      <div style={{ position: 'relative', maxWidth: 1020, margin: '0 auto', padding: '0 22px 42px', width: '100%' }}>
        {mode === 'quote' && <span style={{ display: 'inline-block', background: C.goldDim, border: `1px solid ${C.borderGold}`, color: C.goldLight, padding: '5px 12px', borderRadius: 20, fontSize: 12, marginBottom: 14 }}>✦ Proposal · held for 6 days</span>}
        {tier === 'arrival' && <span style={{ display: 'inline-block', background: `${C.green}18`, border: `1px solid ${C.green}55`, color: C.green, padding: '5px 12px', borderRadius: 20, fontSize: 12, marginBottom: 14 }}>✓ Confirmed — welcome aboard</span>}
        <div style={{ letterSpacing: '.22em', fontSize: 12, color: C.gold, marginBottom: 10 }}>{j.route.join('  ·  ')}</div>
        <h1 style={{ fontFamily: F.d, fontSize: 'clamp(40px,6.4vw,76px)', lineHeight: 1, margin: 0, fontWeight: 500 }}>{j.title}</h1>
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 15 }}><span>{j.travellers.join(' & ')}</span><span style={{ color: C.textDim }}>|</span><span>{fmtDate(j.startISO)} · {j.nights} nights</span></div>
        {tier !== 'arrival' && <div style={{ marginTop: 22, display: 'flex', gap: 24 }}>{[['Days', cd.d], ['Hrs', cd.h], ['Min', cd.m], ['Sec', cd.s]].map(([l, v]: any) => <div key={l} style={{ textAlign: 'center' }}><div style={{ fontFamily: F.d, fontSize: 34, color: C.goldLight, lineHeight: 1 }}>{String(v).padStart(2, '0')}</div><div style={{ fontSize: 10, letterSpacing: '.2em', color: C.textMid, marginTop: 4 }}>{l.toUpperCase()}</div></div>)}<div style={{ alignSelf: 'center', fontSize: 12, color: C.textMid, maxWidth: 150 }}>{mode === 'quote' ? 'begins the moment you confirm' : 'until you set off'}</div></div>}
      </div>
    </section>

    <div style={{ maxWidth: 1020, margin: '0 auto', padding: '0 22px' }}>
      {tier === 'arrival' && <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', margin: '22px 0 0' }}>
        <div style={{ fontFamily: F.d, fontSize: 22, marginBottom: 4 }}>You’re all set, {j.travellers[0].split(' ')[0]}.</div>
        <p style={{ color: C.textMid, fontSize: 14, margin: 0 }}>Everything below is confirmed and looked after. There’s nothing more to do right now. Next time you visit, your full journey comes alive — every camp in motion, day-by-day planning, and notes from {j.specialist.name.split(' ')[0]}. ✦</p>
      </div>}

      {mode === 'quote' && <QuoteExcitement j={j} total={tt.total} m={m} onChat={() => setModal('chat')} />}
      {priceChange && mode === 'quote' && <div style={{ fontSize: 12, color: C.amber, margin: '10px 0' }}>1 rate refreshed since you saved ({priceChange.seg} {m(priceChange.from)}→{m(priceChange.to)}). Confirm now to lock {m(tt.total)}.</div>}

      <SpecialistCard j={j} onChat={() => setModal('chat')} showNote={mode === 'quote' || immersive} />

      <SectionTitle k="Day by day" t="Your itinerary" sub="In date order — confirmed properties and what your specialist is arranging." />
      {j.segments.map((sg, i) => <Property key={sg.id} sg={sg} start={j.segments.slice(0, i).reduce((a, x) => a + x.nights, 0)} startISO={j.startISO} mode={mode} immersive={immersive} />)}


      <SectionTitle k="Your camps" t={mode === 'quote' ? 'Held for you' : 'Confirmation status'} sub={mode === 'quote' ? 'Live availability checked for your exact dates.' : 'If it appears here, it is booked — one is finalising now.'} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: 14 }}>
        {j.segments.map((sg) => <div key={sg.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 92 }}><Scene tone={sg.tone} img={sg.img} reel={sg.reel} immersive={immersive} dim={.3} /></div>
          <div style={{ padding: 13 }}><div style={{ fontFamily: F.d, fontSize: 18 }}>{sg.lodge}</div><div style={{ fontSize: 12, color: C.textMid, marginBottom: 9 }}>{sg.lodge}, {sg.bandRegion}{sg.nights ? ` · ${sg.nights} nights` : ""}</div>
            <Chip status={mode === 'quote' ? 'held' : sg.status} small /></div></div>)}
      </div>

      <SectionTitle k="Getting you there" t="Flights & transfers" sub="Every leg, with the joins we’ve smoothed so nothing feels rushed." />
      <div style={{ display: 'grid', gap: 12 }}>{j.transfers.map((t, i) => <TransferBlock key={i} t={t} />)}<TransferBlock t={j.homeward} /></div>

      <SectionTitle k="Your own pace" t="Add a private game vehicle" sub="Only at your game-viewing camps — choose it per camp." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
        {j.segments.map((sg) => { const on = !!veh[sg.id];
          return sg.gameCamp
            ? <div key={sg.id} style={{ background: on ? C.goldDim : C.surface, border: `1px solid ${on ? C.borderGold : C.border}`, borderRadius: 12, padding: 15 }}>
                <div style={{ fontFamily: F.d, fontSize: 17 }}>{sg.lodge}</div><div style={{ fontSize: 12, color: C.textMid, margin: '4px 0 8px' }}>{sg.lodge}, {sg.bandRegion}{sg.nights ? ` · ${sg.nights} nights` : ""}</div>
                {sg.vehPerDay
                  ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: C.goldLight, fontSize: 14 }}>{m(sg.vehPerDay)}/day · {m(sg.vehPerDay * sg.nights)}</span><Btn small kind={on ? 'dark' : 'ghost'} onClick={() => setVeh({ ...veh, [sg.id]: !on })}>{on ? '✓ Added' : 'Add'}</Btn></div>
                  : <div style={{ fontSize: 12, color: C.textMid }}>Private vehicle pricing confirmed by your specialist.</div>}
              </div>
            : <div key={sg.id} style={{ background: C.bg2, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 15, opacity: .6 }}><div style={{ fontFamily: F.d, fontSize: 17 }}>{sg.lodge}</div><div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>Not applicable — no game drives.</div></div>; })}
      </div>

      {mode === 'quote'
        ? <SecurePanel j={j} total={tt.total} m={m} onChat={() => setModal('chat')} onPrint={() => setModal('print')} />
        : <PaymentPanel tt={tt} bDue={bDue} m={m} onPay={() => setModal('pay')} onPrint={() => setModal('print')} onCancel={() => setModal('cancel')} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', margin: '28px 0 12px' }}>
        <Btn kind="ghost" small onClick={() => setModal('print')}>⤓ Simple itinerary (PDF)</Btn>
        <Btn kind="ghost" small onClick={() => setModal('share')}>＋ Invite / email a copy</Btn>
        {mode !== 'quote' && <Btn kind="ghost" small onClick={() => setModal('cancel')}>Cancel or modify</Btn>}
      </div>
      <div style={{ textAlign: 'center', color: C.textDim, fontSize: 12, padding: '8px 0 40px' }}>thesafariedition.com/journey/{j.ref} · private link · The Travel Catalogue</div>
    </div>

    {/* Chat button removed — contact via specialist card WhatsApp */}

    {modal === 'chat' && <Drawer j={j} onClose={() => setModal(null)} />}
    {modal === 'print' && <ModalShell title="Simple itinerary" wide onClose={() => setModal(null)}><p style={{ color: C.textMid, fontSize: 13, marginTop: 0 }}>A plain travel document — print or save as PDF.</p><SimpleDoc j={j} /><div style={{ marginTop: 14 }}><Btn full onClick={() => window.print()}>⤓ Print / Save as PDF</Btn></div></ModalShell>}
    {modal === 'cancel' && <CancelModal j={j} paid={tt.paid} m={m} onClose={() => setModal(null)} />}
    {modal === 'pay' && <ModalShell title="Make a payment" onClose={() => setModal(null)}><p style={{ color: C.textMid, fontSize: 14, marginTop: 0 }}>Pay any amount toward {m(tt.balance)} or settle in full. Auto-collects {fmtDate(bDue)}.</p><Btn full onClick={() => setModal(null)}>Continue securely →</Btn></ModalShell>}
    {modal === 'share' && <ShareModal j={j} onClose={() => setModal(null)} />}
  </div>;
}

function Property({ sg, start, startISO, mode, immersive }: any) {
  const arrive = new Date(startISO); arrive.setDate(arrive.getDate() + start);
  const days = Array.from({ length: sg.nights }, (_, i) => { const d = new Date(arrive); d.setDate(d.getDate() + i); return d; });
  const [plan, setPlan] = useState<Record<string, number>>({}); const [pick, setPick] = useState<string | null>(null);
  const free = sg.acts.filter((a: string) => plan[a] === undefined);
  return <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, marginBottom: 22 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ width: 13, height: 13, borderRadius: '50%', background: C.gold, marginTop: 6 }} /><div style={{ flex: 1, width: 2, background: C.border }} /></div>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ position: 'relative', height: immersive ? 220 : 168 }}><Scene tone={sg.tone} img={sg.img} reel={sg.reel} immersive={immersive} dim={.4} />
        <div style={{ position: 'absolute', left: 16, bottom: 14, right: 16 }}><div style={{ fontSize: 12, color: C.goldLight, letterSpacing: '.1em' }}>DAY {start + 1}–{start + sg.nights} · {fmtDate(arrive)}</div><div style={{ fontFamily: F.d, fontSize: 28 }}>{sg.lodge}</div>{immersive && <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>{sg.sensory}</div>}</div>
        <div style={{ position: 'absolute', top: 14, right: 14 }}><Chip status={mode === 'quote' ? 'held' : sg.status} small /></div></div>
      <div style={{ padding: 16 }}><p style={{ color: C.textMid, fontSize: 14, marginTop: 0 }}>{sg.narrative}</p>
        <div style={{ fontSize: 11, letterSpacing: '.14em', color: C.gold, margin: '6px 0 8px' }}>PLAN YOUR DAYS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>{free.map((a: string) => <button key={a} onClick={() => setPick(pick === a ? null : a)} style={{ fontFamily: F.b, fontSize: 12, padding: '6px 11px', borderRadius: 18, cursor: 'pointer', border: `1px solid ${pick === a ? C.gold : C.border}`, background: pick === a ? C.goldDim : 'transparent', color: pick === a ? C.goldLight : C.textMid }}>{pick === a ? 'tap a day →' : a}</button>)}{free.length === 0 && <span style={{ fontSize: 12, color: C.textDim }}>All scheduled ✓</span>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sg.nights},1fr)`, gap: 8 }}>{days.map((d, di) => { const here = Object.entries(plan).filter(([, v]) => v === di).map(([k]) => k);
          return <div key={di} onClick={() => { if (pick) { setPlan({ ...plan, [pick]: di }); setPick(null); } }} style={{ border: `1px dashed ${pick ? C.gold : C.border}`, borderRadius: 10, padding: 8, minHeight: 70, cursor: pick ? 'pointer' : 'default', background: pick ? C.goldDim : 'transparent' }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 5 }}>{d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>
            {here.map((a) => <div key={a} onClick={(e) => { e.stopPropagation(); setPlan((p) => { const n = { ...p }; delete n[a]; return n; }); }} style={{ fontSize: 11, background: C.goldDim, color: C.goldLight, borderRadius: 6, padding: '3px 6px', marginBottom: 4, cursor: 'pointer' }}>{a} ×</div>)}</div>; })}</div>
      </div>
    </div>
  </div>;
}

function QuoteExcitement({ j, total, m, onChat }: any) {
  const hold = useCountdown(new Date(Date.now() + 6 * 864e5));
  const charter = useCountdown(new Date(Date.now() + 24 * 36e5));
  const deposit = j.price.GBP.fly + Math.round((total - j.price.GBP.fly) * 0.3);
  return <div style={{ background: `linear-gradient(160deg,${C.surface},#211d12)`, border: `1px solid ${C.borderGold}`, borderRadius: 16, padding: 22, margin: '22px 0 0' }}>
    <div style={{ fontFamily: F.d, fontSize: 26, color: C.goldLight }}>This is the journey waiting for you</div>
    <div style={{ display: 'grid', gap: 6, margin: '12px 0' }}>{j.segments.map((sg: Segment) => <div key={sg.id} style={{ display: 'flex', gap: 9, fontSize: 14 }}><span style={{ color: C.gold }}>✦</span><span style={{ color: C.text }}><b>{sg.bandName}.</b> {sg.sensory}</span></div>)}</div>
    <div style={{ background: C.goldDim, border: `1px solid ${C.borderGold}`, borderRadius: 12, padding: 14, margin: '14px 0' }}>
      <div style={{ fontFamily: F.d, fontSize: 18, color: C.goldLight, marginBottom: 6 }}>Confirm to unlock your full journey companion</div>
      {['Every camp in motion — films, sounds, the places brought to life', 'Your countdown begins, and your day-planner opens', 'A page you can share with family — and a specialist who’s already yours'].map((t, i) => <div key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: C.text, marginBottom: 4 }}><span style={{ color: C.gold }}>→</span>{t}</div>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
      <div><div style={{ fontSize: 11, letterSpacing: '.12em', color: C.textMid }}>TO CONFIRM</div><div style={{ fontFamily: F.d, fontSize: 34, color: C.text }}>{m(deposit)}</div><div style={{ fontSize: 13, color: C.textMid }}>deposit · fully refundable with Cancel-for-any-Reason Cover</div></div>
      <div style={{ textAlign: 'right' }}><div style={{ fontSize: 12, color: C.gold }}>✦ Held for you</div><div style={{ fontSize: 13, color: C.textMid }}>Price &amp; rooms: <b style={{ color: C.text }}>{hold.d}d {hold.h}h</b></div><div style={{ fontSize: 13, color: C.amber }}>Charter seats: <b>{charter.h}h {charter.m}m</b></div></div>
    </div>
    <div style={{ marginTop: 14 }}>
      <Btn onClick={() => { window.location.href = `/checkout?id=${(j as any).itineraryId || ''}`; }}>Secure this journey — fully refundable →</Btn>
    </div>
  </div>;
}
function PaymentPanel({ tt, bDue, m, onPay, onPrint, onCancel }: any) {
  const cd = useCountdown(bDue); const pct = Math.round(tt.paid / tt.total * 100);
  return <><SectionTitle k="Your investment" t="Payment" sub="Held in a protected client trust account and released to each camp as your journey is delivered." />
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        {[['Total', m(tt.total)], ['Paid', m(tt.paid)], ['Balance', m(tt.balance)], ['Balance due', fmtDate(bDue)]].map(([l, v]: any, i: number) => <div key={l}><div style={{ fontSize: 11, letterSpacing: '.12em', color: C.textMid, marginBottom: 4 }}>{l.toUpperCase()}</div><div style={{ fontFamily: F.d, fontSize: 24, color: i === 1 ? C.goldLight : C.text }}>{v}</div></div>)}</div>
      <div style={{ height: 8, background: C.bg, borderRadius: 6, overflow: 'hidden', margin: '16px 0 8px' }}><div style={{ width: pct + '%', height: '100%', background: `linear-gradient(90deg,${C.gold},${C.goldLight})` }} /></div>
      <div style={{ fontSize: 12, color: C.textMid }}>{pct}% paid · balance auto-collected in {cd.d} days — or settle early.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}><Btn onClick={onPay}>Make a payment →</Btn><Btn kind="ghost" onClick={onCancel}>Cancellation terms</Btn><Btn kind="ghost" onClick={onPrint}>Simple itinerary</Btn></div>
      <TrustRow /></div></>;
}
function SecurePanel({ total, m, onChat, onPrint }: any) {
  return <><SectionTitle k="Ready when you are" t="Secure your journey" sub="No payment is taken until you confirm. Securing now locks every price and holds your camps." />
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', gap: 9, fontSize: 14, color: C.text, marginBottom: 8 }}><span style={{ color: C.gold }}>✦</span>Today’s price is locked — flight fares and lodge rates can move for these dates.</div>
      <div style={{ display: 'flex', gap: 9, fontSize: 14, color: C.text }}><span style={{ color: C.gold }}>✦</span>Complimentary Cancel-for-any-Reason Cover — your deposit is fully refundable.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <Btn onClick={() => { if ((window as any).__journeyItineraryId) { window.location.href = `/checkout?id=${(window as any).__journeyItineraryId}`; } else { onChat(); } }}>Secure this journey →</Btn>
        <Btn kind="ghost" onClick={onPrint}>Simple itinerary</Btn>
      </div>
      <TrustRow /></div></>;
}
const TrustRow = () => <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
  {['🔒 PCI-DSS', 'Protected client trust account', 'SATSA', 'ATTA'].map((t) => <span key={t} style={{ fontSize: 11, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 16, padding: '4px 10px' }}>{t}</span>)}
  <span style={{ fontSize: 11, color: C.textDim, border: `1px dashed ${C.textDim}`, borderRadius: 16, padding: '4px 10px' }}>＋ ABTA / ATOL slot — once verified</span></div>;

function CancelModal({ j, paid, m, onClose }: any) {
  const real = Math.max(0, Math.ceil((+new Date(j.startISO) - Date.now()) / 864e5));
  const [days, setDays] = useState(real);
  const TSE: [number, number][] = [[90, 0], [61, 25], [31, 50], [15, 75], [0, 100]];
  const pct = (tiers: [number, number][]) => { for (const [f, p] of tiers) if (days >= f) return p; return 100; };
  const std = pct(TSE);
  const rows = j.segments.map((sg: Segment) => { const su = pct(sg.cancel), p = Math.max(std, su), pen = sg.value * p / 100, pd = sg.value * 0.3; return { n: sg.lodge, p, pen, pd, ref: Math.max(0, pd - pen), supplier: su >= std }; });
  const sub = rows.reduce((a: number, r: any) => a + r.ref, 0), merch = Math.round(paid * 0.029), net = Math.max(0, sub - merch - 110);
  return <ModalShell title="Cancel or modify" wide onClose={onClose}>
    <p style={{ color: C.textMid, fontSize: 14, marginTop: 0 }}>Our standard tier applies; where a lodge is stricter, that term applies first. Indicative — your specialist confirms.</p>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: C.textMid }}>Simulate days to departure</span><b style={{ color: C.goldLight }}>{days} {days === real ? '(actual)' : ''}</b></div><input type="range" min={0} max={120} value={days} onChange={(e) => setDays(+e.target.value)} style={{ width: '100%', marginTop: 8 }} /></div>
    {rows.map((r: any, i: number) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 0', borderTop: `1px solid ${C.border}`, fontSize: 13 }}><span style={{ color: C.text }}>{r.n}<div style={{ fontSize: 11, color: C.textDim }}>{r.p}% · {r.supplier ? 'supplier term' : 'TSE standard'}</div></span><span style={{ textAlign: 'right', color: C.red }}>−{m(r.pen)}</span><span style={{ textAlign: 'right', color: r.ref > 0 ? C.green : C.textDim }}>{m(r.ref)}</span></div>)}
    <div style={{ marginTop: 12, fontSize: 13 }}>
      <Row l="Recoverable from suppliers" v={m(sub)} /><Row l="Less card processing fee (kept by network)" v={'−' + m(merch)} bad /><Row l="Less admin fee" v="−£110" bad />
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}><b style={{ fontFamily: F.d, fontSize: 18 }}>Estimated refund today</b><b style={{ fontFamily: F.d, fontSize: 22, color: C.goldLight }}>{m(net)}</b></div></div>
    <div style={{ background: `${C.green}12`, border: `1px solid ${C.green}44`, borderRadius: 10, padding: 13, marginTop: 14, fontSize: 13, color: C.text }}>✦ Holding <b>Cancel-for-any-Reason Cover?</b> The insurer reimburses these penalties — your specialist files the claim for you.</div>
  </ModalShell>;
}
const Row = ({ l, v, bad }: any) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: C.textMid }}>{l}</span><span style={{ color: bad ? C.red : C.text }}>{v}</span></div>;

function SimpleDoc({ j }: { j: Journey }) {
  const legs = [...j.transfers.flatMap((t) => t.legs), ...j.homeward.legs].filter((l) => l.kind !== 'road');
  const cell: React.CSSProperties = { border: '0.6px solid #000', padding: '3px 6px', fontSize: 8.4, textAlign: 'left' };
  const th: React.CSSProperties = { ...cell, background: '#ececec', textTransform: 'uppercase', letterSpacing: '.05em', fontSize: 7, fontWeight: 'bold' };
  return <div className="tse-print" style={{ background: '#fff', color: '#000', fontFamily: 'Helvetica,Arial,sans-serif', border: '1.5px solid #000' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000', padding: '8px 10px' }}>
      <div><div style={{ fontSize: 14, fontWeight: 'bold' }}>THE SAFARI EDITION</div><div style={{ fontSize: 7.5, letterSpacing: '.16em' }}>ITINERARY &amp; TRAVEL DOCUMENT</div></div>
      <div style={{ fontFamily: 'monospace', fontSize: 7.5, textAlign: 'right' }}>REF: {j.ref}<br />{j.nights} NIGHTS · {j.segments.length} CAMPS</div></div>
    <div style={{ background: '#000', color: '#fff', fontSize: 7.5, letterSpacing: '.16em', padding: '3px 10px', fontWeight: 'bold' }}>FLIGHTS &amp; AIR (LOCAL TIME)</div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody><tr><th style={th}>No.</th><th style={th}>Carrier</th><th style={th}>Depart</th><th style={th}>Arrive</th><th style={th}>Status</th></tr>
      {legs.map((l, i) => <tr key={i}><td style={{ ...cell, fontFamily: 'monospace' }}>{l.no}</td><td style={cell}>{l.carrier}</td><td style={cell}>{l.depApt} {hm(l.dep)}</td><td style={cell}>{l.arrApt} {hm(l.arr)}</td><td style={{ ...cell, fontWeight: 'bold' }}>{statusWord(l.status).toUpperCase()}</td></tr>)}</tbody></table>
    <div style={{ background: '#000', color: '#fff', fontSize: 7.5, letterSpacing: '.16em', padding: '3px 10px', fontWeight: 'bold' }}>ACCOMMODATION</div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody><tr><th style={th}>Nts</th><th style={th}>Property</th><th style={th}>Region</th><th style={th}>Status</th></tr>
      {j.segments.map((sg, i) => <tr key={i}><td style={cell}>{sg.nights}</td><td style={cell}>{sg.lodge}</td><td style={cell}>{place(sg)}</td><td style={{ ...cell, fontWeight: 'bold' }}>{statusWord(sg.status).toUpperCase()}{sg.ref !== '—' ? ' · ' + sg.ref : ''}</td></tr>)}</tbody></table>
    <div style={{ fontSize: 7.4, padding: '5px 10px', borderTop: '0.6px solid #000' }}><b>CONSIDERED FOR YOU:</b> connection buffers on cross-border joins · borders &amp; visas arranged ahead · no same-day onward flight after long-haul · evening flight home keeps your final day free.</div>
  </div>;
}

function Drawer({ j, onClose }: any) {
  const first = j.specialist.name.split(' ')[0];
  const [msgs, setMsgs] = useState<any[]>([{ who: 'ai', t: `Hello ${j.travellers[0].split(' ')[0]} — ask me anything, or say “speak to a person”.` }]);
  const [v, setV] = useState('');
  const send = () => { if (!v.trim()) return; const t = v.trim(); setV(''); setMsgs((mm) => [...mm, { who: 'me', t }]);
    setTimeout(() => { const h = /human|person|someone|real/i.test(t) || t.toLowerCase().includes(first.toLowerCase());
      setMsgs((mm) => [...mm, h ? { who: 'ai', t: `Connecting you with ${first} now — she has your full journey. ✦`, human: true } : { who: 'ai', t: `Happy to help — ${first} is one tap away whenever you’d like a human.` }]); }, 600); };
  return <div style={{ position: 'fixed', bottom: 0, right: 0, width: 'min(380px,100vw)', height: 'min(540px,80vh)', zIndex: 150, background: C.bg2, borderLeft: `1px solid ${C.border}`, borderTop: `1px solid ${C.border}`, borderTopLeftRadius: 16, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontSize: 14 }}>The Safari Edition</div><div style={{ fontSize: 11, color: C.green }}>● {first} online · ~15 min</div></div><button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMid, fontSize: 20, cursor: 'pointer' }}>×</button></div>
    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>{msgs.map((mm, i) => <div key={i} style={{ alignSelf: mm.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '82%', background: mm.who === 'me' ? C.gold : mm.human ? `${C.green}1c` : C.surface, color: mm.who === 'me' ? '#1a1206' : C.text, border: mm.human ? `1px solid ${C.green}55` : 'none', padding: '9px 12px', borderRadius: 12, fontSize: 13.5 }}>{mm.t}</div>)}</div>
    <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}><input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Message…" style={{ ...input, padding: '10px 12px' }} /><Btn onClick={send}>→</Btn></div></div>;
}
