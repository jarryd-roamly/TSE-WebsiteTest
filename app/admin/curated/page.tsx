'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/curated/page.tsx — Enhanced Curated Journey Builder
// Guided 3-step workflow: Details → Build Itinerary → Pricing & Publish
// Shows package margin, KB specialist tips, real supplier selection
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const T = {
  bg: '#0a0a0a', bg2: '#111', surface: '#1a1a1a', surface2: '#1e1e1e',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.12)',
  borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', red: '#f87171', amber: '#fbbf24', blue: '#60a5fa',
};

const REGIONS = [
  { slug:'kruger-sabi-sand', label:'Kruger / Sabi Sand', country:'South Africa', minNights:3, typical:{net:48000,ota:78000} },
  { slug:'okavango-delta',   label:'Okavango Delta',     country:'Botswana',     minNights:3, typical:{net:62000,ota:100000} },
  { slug:'cape-town',        label:'Cape Town',          country:'South Africa', minNights:3, typical:{net:28000,ota:44000} },
  { slug:'madikwe',          label:'Madikwe',            country:'South Africa', minNights:2, typical:{net:28000,ota:46000} },
  { slug:'chobe-vic-falls',  label:'Chobe / Vic Falls',  country:'Zimbabwe',     minNights:2, typical:{net:38000,ota:62000} },
  { slug:'masai-mara',       label:'Masai Mara',         country:'Kenya',        minNights:3, typical:{net:42000,ota:68000} },
];
const BADGES  = ['Most popular','Signature','Classic combo','Our favourite','New','Family pick','Limited'];
const BADGE_COLORS = ['#d4af37','#a78bfa','#4ade80','#60a5fa','#fb923c','#34d399','#f87171'];
const THEMES  = ['honeymoon','anniversary','family','adventure','first-timer','returning','bucket-list'];

const fmt = (n: number) => `R ${Math.round(n).toLocaleString()}`;
const fmtUSD = (n: number) => `$${Math.round(n / 18.5).toLocaleString()}`;

interface City { regionSlug:string; city:string; country:string; nights:number; propertyId?:string; propertyName?:string; displayRate?:number; why:string; highlights:string[]; }
interface Journey {
  id?:string; name:string; tagline:string; badge:string; badge_color:string; hero_image:string;
  status:'draft'|'published'; nights:number; price_from_zar:number; ota_price_zar:number;
  themes:string[]; target_markets:string[]; cities:City[];
}
const BLANK: Journey = {
  name:'', tagline:'', badge:'Most popular', badge_color:'#d4af37', hero_image:'',
  status:'draft', nights:0, price_from_zar:0, ota_price_zar:0,
  themes:[], target_markets:['uk','us'], cities:[],
};

// ── Margin calculator ────────────────────────────────────────────────────────
function calcMargin(cities: City[]) {
  let displayTotal = 0, estNet = 0, estOTA = 0;
  for (const c of cities) {
    const reg = REGIONS.find(r => r.slug === c.regionSlug);
    const disp = (c.displayRate || reg?.typical.net ? (c.displayRate || Math.round((reg?.typical.net || 25000) * 1.15)) : 25000) * c.nights;
    const net  = Math.round(disp / 1.15) * c.nights;
    const ota  = (reg?.typical.ota || disp * 1.3) * c.nights;
    displayTotal += disp;
    estNet  += net;
    estOTA  += ota;
  }
  const gp = displayTotal - estNet;
  const gpPct = displayTotal > 0 ? Math.round((gp / displayTotal) * 100) : 0;
  return { displayTotal, estNet, estOTA, gp, gpPct };
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ['Package details','Build itinerary','Pricing & publish'];
  return (
    <div style={{ display:'flex', gap:0, marginBottom:32 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', flex:1 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background:i < current ? T.gold : i === current ? T.gold : T.surface, color:i <= current ? '#0a0a0a' : T.textDim, border:`0.5px solid ${i <= current ? T.gold : T.border}` }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div style={{ fontSize:10, color: i === current ? T.gold : T.textDim, letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center' }}>{s}</div>
          </div>
          {i < steps.length - 1 && <div style={{ height:'0.5px', flex:1, background: i < current ? T.gold : T.border, margin:'0 8px', marginBottom:16 }} />}
        </div>
      ))}
    </div>
  );
}

// ── KB tips panel ─────────────────────────────────────────────────────────────
function KBPanel({ regionSlugs }: { regionSlugs: string[] }) {
  const [tips, setTips] = useState<any[]>([]);
  useEffect(() => {
    if (!regionSlugs.length) return;
    sb.from('knowledge_base')
      .select('title,content,category,layer')
      .in('destination', regionSlugs.map(s => s.replace(/-/g,' ')))
      .eq('is_active', true)
      .limit(8)
      .then(({ data }) => setTips(data || []));
  }, [regionSlugs.join(',')]);
  if (!tips.length) return null;
  return (
    <div style={{ background:'rgba(212,175,55,0.04)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'14px 16px' }}>
      <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.18em', textTransform:'uppercase', fontWeight:600, marginBottom:10 }}>✦ Specialist KB tips</div>
      {tips.map((t, i) => (
        <div key={i} style={{ paddingTop:8, marginTop:8, borderTop:i > 0 ? `0.5px solid ${T.border}` : 'none' }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:2 }}>{t.title}</div>
          <div style={{ fontSize:11, color:T.textMid, lineHeight:1.55 }}>{t.content}</div>
        </div>
      ))}
    </div>
  );
}

// ── Supplier selector per region ──────────────────────────────────────────────
function SupplierSelector({ regionSlug, nights, selectedId, onSelect }: { regionSlug:string; nights:number; selectedId?:string; onSelect:(id:string,name:string,rate:number)=>void; }) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  useEffect(() => {
    if (!regionSlug) return;
    sb.from('suppliers')
      .select('id,name,short_tagline,display_rate_per_night,trust_score,images')
      .eq('region_slug', regionSlug)
      .eq('is_active', true)
      .order('trust_score', { ascending:false })
      .limit(6)
      .then(({ data }) => setSuppliers(data || []));
  }, [regionSlug]);
  const getImg = (s: any) => {
    try {
      const imgs = Array.isArray(s.images) ? s.images : (s.images ? JSON.parse(s.images) : []);
      return imgs.find((i: any) => i.is_primary)?.url || imgs[0]?.url || '';
    } catch { return ''; }
  };
  if (!suppliers.length) return <div style={{ fontSize:12, color:T.textDim }}>No suppliers found for this region.</div>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
      {suppliers.map((s: any) => {
        const isSel = String(s.id) === String(selectedId);
        const rate  = Number(s.display_rate_per_night) || 0;
        return (
          <div key={s.id} onClick={() => onSelect(String(s.id), s.name, rate)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, border:`1px solid ${isSel ? T.gold : T.border}`, background:isSel ? T.goldDim : 'rgba(255,255,255,0.02)', cursor:'pointer', transition:'all 0.15s' }}>
            <div style={{ width:40, height:32, borderRadius:6, overflow:'hidden', flexShrink:0, background:T.surface2 }}>
              {getImg(s) && <img src={getImg(s)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:isSel ? T.gold : T.text }}>{s.name}</div>
              <div style={{ fontSize:10, color:T.textDim }}>{s.short_tagline || ''}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              {rate > 0 && <div style={{ fontSize:12, fontWeight:600, color:isSel ? T.gold : T.textMid }}>{fmt(rate)}<span style={{ fontSize:9, color:T.textDim }}>/n</span></div>}
              <div style={{ fontSize:9, color:T.textDim }}>{nights}n = {fmt(rate * nights)}</div>
              <div style={{ fontSize:9, color:T.textDim }}>Trust {s.trust_score}/100</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Hero image drag-drop upload ───────────────────────────────────────────────
function HeroImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [drag,     setDrag]     = useState(false);
  const [status,   setStatus]   = useState<'idle'|'uploading'|'done'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setErrorMsg('Images only (JPG, PNG, WEBP)'); return; }
    if (file.size > 20 * 1024 * 1024)   { setErrorMsg('Max 20MB');                      return; }
    setStatus('uploading'); setErrorMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('supplier_id', 'system');
    fd.append('media_type', 'images');
    fd.append('caption', 'curated-hero');
    fd.append('uploaded_by', 'admin');
    try {
      const res  = await fetch('/api/upload', { method:'POST', body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange(data.url);
      setStatus('done');
    } catch(e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if(f) upload(f); }}
        style={{ border:`1.5px dashed ${drag ? T.gold : T.border}`, borderRadius:10, padding:'20px 16px', textAlign:'center', background:drag ? T.goldDim : 'rgba(255,255,255,0.02)', transition:'all 0.15s', marginBottom:8 }}>
        {status === 'uploading'
          ? <div style={{ fontSize:12, color:T.amber }}>⏳ Uploading…</div>
          : status === 'done'
          ? <div style={{ fontSize:12, color:T.green }}>✓ Uploaded</div>
          : <>
              <div style={{ fontSize:11, color:T.textDim, marginBottom:8 }}>Drag & drop an image here</div>
              <label style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, color:'#0a0a0a', borderRadius:7, padding:'6px 16px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                Choose file
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) upload(f); e.target.value=''; }} />
              </label>
            </>
        }
        {errorMsg && <div style={{ fontSize:11, color:T.red, marginTop:6 }}>{errorMsg}</div>}
      </div>
      {/* Current image preview */}
      {value && (
        <div style={{ position:'relative' }}>
          <img src={value} alt="" style={{ width:'100%', height:110, objectFit:'cover', borderRadius:8 }} onError={e=>{(e.target as any).style.display='none'}} />
          <button onClick={() => onChange('')}
            style={{ position:'absolute', top:6, right:6, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
      )}
      {/* Fallback URL paste */}
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder="Or paste an image URL…"
        style={{ width:'100%', marginTop:8, background:'rgba(255,255,255,0.04)', border:`0.5px solid ${T.border}`, borderRadius:8, padding:'8px 12px', color:T.textDim, fontSize:11, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const }} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CuratedAdminPage() {
  const [journeys, setJourneys]   = useState<Journey[]>([]);
  const [editing,  setEditing]    = useState<Journey | null>(null);
  const [step,     setStep]       = useState(0);
  const [saving,   setSaving]     = useState(false);
  const [msg,      setMsg]        = useState('');
  const [loading,  setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await sb.from('curated_journeys').select('*').order('created_at', { ascending:false });
    setJourneys(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalNights = editing?.cities.reduce((s, c) => s + c.nights, 0) ?? 0;
  const margin = editing ? calcMargin(editing.cities) : null;

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setMsg('Package name required.'); return; }
    if (!editing.cities.length) { setMsg('Add at least one destination.'); return; }
    setSaving(true); setMsg('');
    const data = { ...editing, nights: totalNights, price_from_zar: margin?.displayTotal ?? 0, updated_at: new Date().toISOString() };
    const { error } = editing.id
      ? await sb.from('curated_journeys').update(data).eq('id', editing.id)
      : await sb.from('curated_journeys').insert(data);
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg('Saved!'); await load(); setEditing(null); setStep(0); }
    setSaving(false);
  };

  const addCity = (slug: string) => {
    if (!editing) return;
    if (editing.cities.find(c => c.regionSlug === slug)) return; // no duplicates
    const reg = REGIONS.find(r => r.slug === slug)!;
    setEditing({ ...editing, cities: [...editing.cities, { regionSlug:slug, city:reg.label, country:reg.country, nights:reg.minNights, why:'', highlights:[] }] });
  };

  const updateCity = (idx: number, patch: Partial<City>) => {
    if (!editing) return;
    const next = [...editing.cities];
    next[idx] = { ...next[idx], ...patch };
    setEditing({ ...editing, cities: next });
  };

  const removeCity = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, cities: editing.cities.filter((_, i) => i !== idx) });
  };

  const inputStyle: React.CSSProperties = { width:'100%', background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:8, padding:'9px 12px', color:T.text, fontSize:13, outline:'none', fontFamily:'inherit' };
  const labelStyle: React.CSSProperties = { display:'block', fontSize:10, color:T.textDim, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:5 };

  // ── EDITOR ────────────────────────────────────────────────────────────────
  if (editing !== null) {
    return (
      <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'Jost',sans-serif", color:T.text }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'28px 20px 100px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
            <div>
              <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:4 }}>Admin · Curated Builder</div>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:300 }}>{editing.id ? 'Edit journey' : 'New journey'}</div>
            </div>
            <button onClick={() => { setEditing(null); setStep(0); setMsg(''); }}
              style={{ background:T.surface, border:`0.5px solid ${T.border}`, color:T.textMid, borderRadius:7, padding:'8px 16px', cursor:'pointer', fontSize:13 }}>← Back</button>
          </div>

          {msg && <div style={{ background:msg.startsWith('Error') ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.08)', border:`0.5px solid ${msg.startsWith('Error') ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.25)'}`, borderRadius:8, padding:'10px 16px', marginBottom:16, fontSize:13, color:msg.startsWith('Error') ? T.red : T.green }}>{msg}</div>}

          <Steps current={step} />

          {/* ── STEP 0: Details ─── */}
          {step === 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
              <div>
                <div style={{ marginBottom:14 }}>
                  <label style={labelStyle}>Package name</label>
                  <input value={editing.name} onChange={e => setEditing({...editing, name:e.target.value})} style={inputStyle} placeholder="e.g. The Grand Safari Circuit" />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={labelStyle}>Tagline (shown on card)</label>
                  <input value={editing.tagline} onChange={e => setEditing({...editing, tagline:e.target.value})} style={inputStyle} placeholder="e.g. Two countries. Three ecosystems." />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  <div>
                    <label style={labelStyle}>Badge</label>
                    <select value={editing.badge} onChange={e => setEditing({...editing, badge:e.target.value})} style={inputStyle}>
                      {BADGES.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Badge colour</label>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                      {BADGE_COLORS.map(c => (
                        <div key={c} onClick={() => setEditing({...editing, badge_color:c})}
                          style={{ width:24, height:24, borderRadius:4, background:c, cursor:'pointer', border:editing.badge_color===c?`2px solid ${T.text}`:'2px solid transparent' }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={labelStyle}>Hero image</label>
                  <HeroImageUpload
                    value={editing.hero_image}
                    onChange={url => setEditing({...editing, hero_image:url})}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Themes</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {THEMES.map(t => {
                      const on = editing.themes.includes(t);
                      return <button key={t} onClick={() => setEditing({...editing, themes:on ? editing.themes.filter(x=>x!==t) : [...editing.themes,t]})}
                        style={{ background:on?T.goldDim:T.surface2, border:`0.5px solid ${on?T.borderGold:T.border}`, color:on?T.gold:T.textDim, borderRadius:20, padding:'4px 12px', fontSize:11, cursor:'pointer' }}>{t}</button>;
                    })}
                  </div>
                </div>
              </div>
              <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:12 }}>Card preview</div>
                <div style={{ borderRadius:10, overflow:'hidden', background:T.surface2, border:`0.5px solid ${T.border}` }}>
                  <div style={{ height:120, background:editing.hero_image?`url(${editing.hero_image}) center/cover`:T.surface2, position:'relative' }}>
                    {editing.badge && <div style={{ position:'absolute', top:8, left:10, background:editing.badge_color, color:'#0a0a0a', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20 }}>{editing.badge}</div>}
                  </div>
                  <div style={{ padding:12 }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, marginBottom:3 }}>{editing.name || 'Package name'}</div>
                    <div style={{ fontSize:11, color:T.textMid, marginBottom:8 }}>{editing.tagline || 'Tagline'}</div>
                    {margin && margin.displayTotal > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <div>
                          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, color:T.gold }}>{fmt(margin.displayTotal)}</div>
                          <div style={{ fontSize:10, color:T.textDim }}>{totalNights}n · 2 pax</div>
                        </div>
                        {editing.ota_price_zar > margin.displayTotal && (
                          <div style={{ fontSize:11, color:T.green }}>Save {fmt(editing.ota_price_zar - margin.displayTotal)}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1: Build Itinerary ─── */}
          {step === 1 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
              <div>
                <div style={{ fontSize:11, color:T.textDim, marginBottom:14 }}>Add destinations in the order travellers will visit them. Minimum nights per region are enforced.</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
                  {REGIONS.map(r => {
                    const added = editing.cities.find(c => c.regionSlug === r.slug);
                    return (
                      <button key={r.slug} onClick={() => addCity(r.slug)}
                        disabled={!!added}
                        style={{ padding:'10px 12px', borderRadius:9, border:`1px solid ${added ? T.gold : T.border}`, background:added?T.goldDim:'rgba(255,255,255,0.02)', color:added?T.gold:T.textMid, fontSize:12, cursor:added?'default':'pointer', textAlign:'left' }}>
                        <div style={{ fontWeight:600 }}>{added ? '✦ ' : '+ '}{r.label}</div>
                        <div style={{ fontSize:10, color:T.textDim }}>{r.country} · min {r.minNights}n</div>
                      </button>
                    );
                  })}
                </div>

                {editing.cities.map((city, i) => (
                  <div key={i} style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.gold }}>Stop {i+1} · {city.city}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <button onClick={() => updateCity(i, { nights: Math.max(REGIONS.find(r=>r.slug===city.regionSlug)?.minNights||2, city.nights-1) })}
                            style={{ width:26, height:26, borderRadius:6, border:`0.5px solid ${T.border}`, background:T.surface2, color:T.text, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                          <span style={{ fontSize:13, fontWeight:600, minWidth:32, textAlign:'center' }}>{city.nights}n</span>
                          <button onClick={() => updateCity(i, { nights: city.nights + 1 })}
                            style={{ width:26, height:26, borderRadius:6, border:`0.5px solid ${T.border}`, background:T.surface2, color:T.text, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                        </div>
                        <button onClick={() => removeCity(i)}
                          style={{ background:'rgba(248,113,113,0.1)', border:'0.5px solid rgba(248,113,113,0.3)', color:T.red, borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>Remove</button>
                      </div>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={labelStyle}>Featured property</label>
                      <SupplierSelector
                        regionSlug={city.regionSlug}
                        nights={city.nights}
                        selectedId={city.propertyId}
                        onSelect={(id, name, rate) => updateCity(i, { propertyId:id, propertyName:name, displayRate:rate })}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Why this destination</label>
                      <input value={city.why} onChange={e => updateCity(i, { why:e.target.value })} style={inputStyle} placeholder="e.g. The finest predator territory on Earth." />
                    </div>
                  </div>
                ))}

                {editing.cities.length > 0 && (
                  <div style={{ padding:'10px 14px', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, fontSize:12, color:T.gold }}>
                    Routing: {editing.cities.map(c => c.city).join(' → ')} · {totalNights} nights total
                  </div>
                )}
              </div>

              {/* KB tips for selected regions */}
              <div>
                <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:12 }}>Specialist notes for selected regions</div>
                <KBPanel regionSlugs={editing.cities.map(c => c.regionSlug)} />
                {!editing.cities.length && (
                  <div style={{ fontSize:12, color:T.textDim, padding:20, textAlign:'center', background:T.surface, borderRadius:10, border:`0.5px solid ${T.border}` }}>
                    Add destinations to see specialist KB tips
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Pricing & Publish ─── */}
          {step === 2 && margin && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
              <div>
                {/* Margin breakdown */}
                <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
                  <div style={{ fontSize:11, color:T.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:14 }}>Package margin analysis</div>
                  {editing.cities.map((city, i) => {
                    const reg = REGIONS.find(r => r.slug === city.regionSlug);
                    const disp = (city.displayRate || Math.round((reg?.typical.net||25000)*1.15)) * city.nights;
                    const net  = Math.round(disp / 1.15);
                    const gp   = disp - net;
                    return (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`0.5px solid ${T.border}` }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600 }}>{city.propertyName || city.city}</div>
                          <div style={{ fontSize:10, color:T.textDim }}>{city.nights} nights · {fmt(city.displayRate || Math.round((reg?.typical.net||25000)*1.15))}/night</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{fmt(disp)}</div>
                          <div style={{ fontSize:10, color:T.green }}>+{fmt(gp)} GP</div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:14 }}>
                    {[
                      { label:'Display total', value:fmt(margin.displayTotal), color:T.gold },
                      { label:'Est. gross profit', value:fmt(margin.gp), color:T.green },
                      { label:'Margin %', value:`${margin.gpPct}%`, color:T.green },
                    ].map(s => (
                      <div key={s.label} style={{ background:T.surface2, borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:T.textDim, marginBottom:4 }}>{s.label}</div>
                        <div style={{ fontSize:16, fontWeight:600, color:s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OTA comparison + pricing */}
                <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
                  <div style={{ fontSize:11, color:T.textDim, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:12 }}>OTA comparison price</div>
                  <div style={{ fontSize:11, color:T.textDim, marginBottom:8 }}>What Booking.com / direct booking would charge for equivalent quality</div>
                  <input type="number" value={editing.ota_price_zar || margin.estOTA}
                    onChange={e => setEditing({...editing, ota_price_zar: Number(e.target.value)})} style={inputStyle} />
                  {editing.ota_price_zar > margin.displayTotal && (
                    <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(74,222,128,0.06)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:8, fontSize:12, color:T.green }}>
                      Traveller saves {fmt(editing.ota_price_zar - margin.displayTotal)} ({Math.round(((editing.ota_price_zar - margin.displayTotal) / editing.ota_price_zar) * 100)}% below OTA) · {fmtUSD(editing.ota_price_zar - margin.displayTotal)} in USD
                    </div>
                  )}
                </div>

                {/* Status */}
                <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, padding:'16px 18px' }}>
                  <div style={{ fontSize:11, color:T.textDim, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:10 }}>Status</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {(['draft','published'] as const).map(s => (
                      <button key={s} onClick={() => setEditing({...editing, status:s})}
                        style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${editing.status===s?T.gold:T.border}`, background:editing.status===s?T.goldDim:'transparent', color:editing.status===s?T.gold:T.textMid, cursor:'pointer', fontSize:12 }}>
                        {s === 'published' ? '● Live on landing page' : '○ Draft — not visible'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:12 }}>Summary</div>
                <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, overflow:'hidden' }}>
                  <div style={{ height:130, background:editing.hero_image?`url(${editing.hero_image}) center/cover`:T.surface2, position:'relative' }}>
                    {editing.badge && <div style={{ position:'absolute', top:10, left:12, background:editing.badge_color, color:'#0a0a0a', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20 }}>{editing.badge}</div>}
                  </div>
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, marginBottom:4 }}>{editing.name}</div>
                    <div style={{ fontSize:12, color:T.textMid, marginBottom:10 }}>{editing.tagline}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {editing.cities.map((c, i) => (
                        <div key={i} style={{ fontSize:11, color:T.textDim }}>✓ {c.nights}n {c.propertyName || c.city}</div>
                      ))}
                    </div>
                    <div style={{ marginTop:12, paddingTop:12, borderTop:`0.5px solid ${T.border}`, display:'flex', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, color:T.gold }}>{fmt(margin.displayTotal)}</div>
                        <div style={{ fontSize:10, color:T.textDim }}>{totalNights} nights · 2 pax · all-inclusive</div>
                      </div>
                      {editing.ota_price_zar > margin.displayTotal && (
                        <div style={{ fontSize:12, color:T.green }}>Save {fmt(editing.ota_price_zar - margin.displayTotal)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step nav */}
          <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'rgba(10,10,10,0.97)', borderTop:`0.5px solid ${T.border}`, padding:'14px 24px', display:'flex', gap:10, justifyContent:'space-between', alignItems:'center', zIndex:50 }}>
            <div style={{ fontSize:12, color:T.textDim }}>
              {editing.cities.length > 0 && `${totalNights} nights · ${editing.cities.length} destination${editing.cities.length!==1?'s':''}`}
              {margin && margin.gp > 0 && <span style={{ color:T.green, marginLeft:10 }}>Est. GP: {fmt(margin.gp)} ({margin.gpPct}%)</span>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {step > 0 && <button onClick={() => setStep(s => s-1)} style={{ background:T.surface, border:`0.5px solid ${T.border}`, color:T.textMid, borderRadius:7, padding:'9px 18px', cursor:'pointer', fontSize:13 }}>← Back</button>}
              {step < 2 && <button onClick={() => setStep(s => s+1)} style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:7, padding:'9px 22px', cursor:'pointer', fontSize:13, fontWeight:600 }}>Next →</button>}
              {step === 2 && <button onClick={save} disabled={saving} style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:7, padding:'9px 22px', cursor:'pointer', fontSize:13, fontWeight:600, opacity:saving?0.6:1 }}>{saving?'Saving…':'Save & publish'}</button>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'Jost',sans-serif", color:T.text }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'28px 20px 60px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
          <div>
            <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.3em', textTransform:'uppercase', marginBottom:4 }}>Admin</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:300 }}>Curated Journeys</div>
            <div style={{ fontSize:13, color:T.textDim, marginTop:4 }}>Build, price and publish packages for the landing page</div>
          </div>
          <button onClick={() => { setEditing({...BLANK}); setStep(0); setMsg(''); }}
            style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            + New package
          </button>
        </div>

        {loading && <div style={{ textAlign:'center', padding:60, color:T.textDim }}>Loading…</div>}
        {!loading && journeys.length === 0 && (
          <div style={{ textAlign:'center', padding:60, color:T.textDim }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, marginBottom:8 }}>No packages yet</div>
            <div style={{ fontSize:13, marginBottom:20 }}>Create your first curated journey package.</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {journeys.map((j: any) => {
            const m = calcMargin(j.cities || []);
            return (
              <div key={j.id} style={{ background:T.surface, border:`0.5px solid ${j.status==='published'?T.borderGold:T.border}`, borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ width:80, height:58, borderRadius:8, overflow:'hidden', flexShrink:0, background:T.surface2 }}>
                  {j.hero_image && <img src={j.hero_image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16 }}>{j.name}</div>
                    <div style={{ background:j.badge_color||'#d4af37', color:'#0a0a0a', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>{j.badge}</div>
                  </div>
                  <div style={{ fontSize:12, color:T.textMid, marginBottom:4 }}>{j.tagline}</div>
                  <div style={{ display:'flex', gap:12, fontSize:11, color:T.textDim }}>
                    {j.nights && <span>{j.nights} nights</span>}
                    {m.displayTotal > 0 && <span>{fmt(m.displayTotal)}</span>}
                    {m.gp > 0 && <span style={{ color:T.green }}>GP: {fmt(m.gp)} ({m.gpPct}%)</span>}
                    {(j.cities||[]).length > 0 && <span>{(j.cities||[]).length} destination{(j.cities||[]).length!==1?'s':''}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <div style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:j.status==='published'?'rgba(74,222,128,0.08)':'rgba(255,255,255,0.04)', border:`0.5px solid ${j.status==='published'?'rgba(74,222,128,0.25)':T.border}`, color:j.status==='published'?T.green:T.textDim }}>
                    {j.status==='published' ? '● Live' : '○ Draft'}
                  </div>
                  <button onClick={() => { setEditing(j); setStep(0); }} style={{ background:T.surface2, border:`0.5px solid ${T.border}`, color:T.textMid, borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:11 }}>Edit</button>
                  <button onClick={async () => {
                    if (!confirm('Delete?')) return;
                    await sb.from('curated_journeys').delete().eq('id', j.id);
                    load();
                  }} style={{ background:'rgba(248,113,113,0.06)', border:'0.5px solid rgba(248,113,113,0.2)', color:T.red, borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:11 }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
