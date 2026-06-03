'use client';

// ─────────────────────────────────────────────────────────────────────────────
// /admin/curated/page.tsx
// Curated Journey Package Builder — Journey Specialist admin module
//
// Lets sales/admin create pre-built journey packages without touching code.
// These packages appear on the landing page "Curated Journeys" section.
// Saves to the `curated_journeys` Supabase table.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const T = {
  bg: '#0a0a0a', bg2: '#111', surface: '#1a1a1a', surface2: '#222',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.12)',
  borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)',
  green: '#4ade80', red: '#f87171', blue: '#60a5fa',
};

const REGIONS = [
  { slug: 'kruger-sabi-sand',  label: 'Kruger / Sabi Sand',   country: 'South Africa' },
  { slug: 'okavango-delta',    label: 'Okavango Delta',        country: 'Botswana'     },
  { slug: 'cape-town',         label: 'Cape Town',             country: 'South Africa' },
  { slug: 'madikwe',           label: 'Madikwe',               country: 'South Africa' },
  { slug: 'chobe-vic-falls',   label: 'Chobe / Vic Falls',     country: 'Zimbabwe'     },
  { slug: 'masai-mara',        label: 'Masai Mara',            country: 'Kenya'        },
  { slug: 'bwindi',            label: 'Bwindi',                country: 'Uganda'       },
  { slug: 'phinda',            label: 'Phinda',                country: 'South Africa' },
];

const THEMES = ['honeymoon', 'family', 'adventure', 'first-timer', 'returning', 'anniversary'];
const MARKETS = ['uk', 'us', 'de', 'fr', 'cn'];
const BADGES  = ['Most popular', 'Signature', 'Classic', 'Our favourite', 'New', 'Limited'];
const BADGE_COLORS = ['#d4af37', '#a78bfa', '#4ade80', '#60a5fa', '#f87171', '#fb923c'];

interface CuratedCity {
  city:        string;
  country:     string;
  regionSlug:  string;
  nights:      number;
  propertyId?: string;
  why:         string;
  highlights:  string[];
}

interface CuratedJourney {
  id?:             string;
  name:            string;
  tagline:         string;
  badge:           string;
  badge_color:     string;
  hero_image:      string;
  status:          'draft' | 'published';
  nights:          number;
  price_from_zar:  number;
  ota_price_zar:   number;
  themes:          string[];
  target_markets:  string[];
  cities:          CuratedCity[];
}

const BLANK: CuratedJourney = {
  name: '', tagline: '', badge: 'Most popular', badge_color: '#d4af37',
  hero_image: '', status: 'draft', nights: 7, price_from_zar: 0,
  ota_price_zar: 0, themes: [], target_markets: ['uk', 'us'], cities: [],
};

function fmt(n: number) { return `R ${Math.round(n).toLocaleString()}`; }

// ── City editor row ───────────────────────────────────────────────────────────
function CityRow({ city, index, onChange, onRemove, suppliers }: any) {
  const regionSuppliers = suppliers.filter((s: any) => s.region_slug === city.regionSlug);

  return (
    <div style={{ background: T.surface2, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: T.gold, fontWeight: 600, minWidth: 24 }}>{index + 1}</span>
        <select value={city.regionSlug} onChange={e => {
          const r = REGIONS.find(r => r.slug === e.target.value);
          onChange({ ...city, regionSlug: e.target.value, city: r?.label || '', country: r?.country || '', propertyId: '' });
        }} style={selStyle}>
          <option value="">Select region</option>
          {REGIONS.map(r => <option key={r.slug} value={r.slug}>{r.label}</option>)}
        </select>
        <input type="number" min={1} max={14} value={city.nights}
          onChange={e => onChange({ ...city, nights: Number(e.target.value) })}
          style={{ ...inputStyle, width: 64 }} placeholder="Nights" />
        <button onClick={onRemove} style={{ background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.3)', color: T.red, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
          Remove
        </button>
      </div>

      {/* Property selection */}
      {city.regionSlug && (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Featured property (optional — leave blank to auto-assign)</label>
          <select value={city.propertyId || ''} onChange={e => onChange({ ...city, propertyId: e.target.value })} style={selStyle}>
            <option value="">Auto-assign (highest scoring)</option>
            {regionSuppliers.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} — {s.trust_score ? `Trust ${Math.round(s.trust_score)}/100` : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>Why this destination (1 sentence)</label>
        <input value={city.why} onChange={e => onChange({ ...city, why: e.target.value })}
          style={inputStyle} placeholder="e.g. The finest predator territory on Earth." />
      </div>

      <div>
        <label style={labelStyle}>Highlights (comma-separated)</label>
        <input value={city.highlights.join(', ')}
          onChange={e => onChange({ ...city, highlights: e.target.value.split(',').map(h => h.trim()).filter(Boolean) })}
          style={inputStyle} placeholder="Leopard, Lion at sunset, Night drive" />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: T.surface, border: `0.5px solid ${T.border}`,
  borderRadius: 7, padding: '9px 12px', color: T.text, fontSize: 13, outline: 'none', fontFamily: "'Jost',sans-serif",
};
const selStyle: React.CSSProperties = {
  ...inputStyle, flex: 1, cursor: 'pointer',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, color: T.textDim, letterSpacing: '0.2em',
  textTransform: 'uppercase', marginBottom: 5,
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CuratedAdminPage() {
  const [journeys,   setJourneys]  = useState<CuratedJourney[]>([]);
  const [suppliers,  setSuppliers] = useState<any[]>([]);
  const [editing,    setEditing]   = useState<CuratedJourney | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [msg,        setMsg]       = useState('');
  const [loading,    setLoading]   = useState(true);
  const [priceCalc,  setPriceCalc] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: jData }, { data: sData }] = await Promise.all([
      supabase.from('curated_journeys').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id,name,trust_score,region_slug,display_rate_per_night').eq('is_active', true).order('trust_score', { ascending: false }),
    ]);
    setJourneys(jData || []);
    setSuppliers(sData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-calculate price from property selections
  const calculatePrice = async (journey: CuratedJourney) => {
    if (!journey.cities.length) return;
    setCalcLoading(true);
    try {
      const selections = journey.cities
        .filter(c => c.propertyId)
        .map(c => ({ propertyId: c.propertyId, nights: c.nights, upgrades: {} }));
      if (!selections.length) { setCalcLoading(false); return; }
      const res = await fetch('/api/price-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, adults: 2 }),
      });
      const d = await res.json();
      if (d.success) {
        setPriceCalc(d);
        setEditing(prev => prev ? { ...prev, price_from_zar: d.displayTotal, nights: journey.cities.reduce((s, c) => s + c.nights, 0) } : prev);
      }
    } catch {}
    setCalcLoading(false);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setMsg('Please enter a journey name.'); return; }
    if (!editing.cities.length) { setMsg('Please add at least one destination.'); return; }
    setSaving(true); setMsg('');
    const totalNights = editing.cities.reduce((s, c) => s + c.nights, 0);
    const data = { ...editing, nights: totalNights, updated_at: new Date().toISOString() };
    const { error } = editing.id
      ? await supabase.from('curated_journeys').update(data).eq('id', editing.id)
      : await supabase.from('curated_journeys').insert(data);
    if (error) { setMsg(`Error: ${error.message}`); }
    else { setMsg('Saved successfully.'); await loadData(); setEditing(null); }
    setSaving(false);
  };

  const deleteJourney = async (id: string) => {
    if (!confirm('Delete this journey?')) return;
    await supabase.from('curated_journeys').delete().eq('id', id);
    await loadData();
  };

  const togglePublish = async (j: CuratedJourney) => {
    const newStatus = j.status === 'published' ? 'draft' : 'published';
    await supabase.from('curated_journeys').update({ status: newStatus }).eq('id', j.id!);
    await loadData();
  };

  const addCity = () => {
    if (!editing) return;
    setEditing({ ...editing, cities: [...editing.cities, { city: '', country: '', regionSlug: '', nights: 3, propertyId: '', why: '', highlights: [] }] });
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold, fontFamily: "'Jost',sans-serif" }}>
      Loading curated journeys…
    </div>
  );

  // ── EDITOR ────────────────────────────────────────────────────────────────
  if (editing !== null) {
    const totalNights = editing.cities.reduce((s, c) => s + c.nights, 0);
    return (
      <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Jost',sans-serif", color: T.text }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 80px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 4 }}>
                {editing.id ? 'Edit journey' : 'New journey'}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 300 }}>
                Curated Journey Builder
              </div>
            </div>
            <button onClick={() => { setEditing(null); setMsg(''); setPriceCalc(null); }}
              style={{ background: T.surface, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 7, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
              ← Back
            </button>
          </div>

          {msg && <div style={{ background: msg.startsWith('Error') ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.08)', border: `0.5px solid ${msg.startsWith('Error') ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.25)'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: msg.startsWith('Error') ? T.red : T.green }}>{msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* LEFT COLUMN */}
            <div>
              {/* Basic info */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.gold, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Journey details</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Journey name</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inputStyle} placeholder="e.g. The Grand Safari Circuit" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Tagline (shown on card)</label>
                  <input value={editing.tagline} onChange={e => setEditing({ ...editing, tagline: e.target.value })} style={inputStyle} placeholder="e.g. Two countries. Three ecosystems." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Badge label</label>
                    <select value={editing.badge} onChange={e => setEditing({ ...editing, badge: e.target.value })} style={selStyle}>
                      {BADGES.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Badge colour</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {BADGE_COLORS.map(c => (
                        <div key={c} onClick={() => setEditing({ ...editing, badge_color: c })}
                          style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer', border: editing.badge_color === c ? `2px solid ${T.text}` : '2px solid transparent' }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Hero image URL</label>
                  <input value={editing.hero_image} onChange={e => setEditing({ ...editing, hero_image: e.target.value })} style={inputStyle} placeholder="https://… or leave blank to auto-select from first property" />
                  {editing.hero_image && <img src={editing.hero_image} alt="preview" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 7, marginTop: 8 }} />}
                </div>
              </div>

              {/* Pricing */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.gold, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Pricing</div>
                {priceCalc && (
                  <div style={{ background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ color: T.gold, marginBottom: 4 }}>Auto-calculated from property selections</div>
                    <div>Display total: <strong>{fmt(priceCalc.displayTotal)}</strong></div>
                    <div style={{ color: T.textDim, marginTop: 2, fontSize: 11 }}>{priceCalc.components?.map((c: any) => `${c.propertyName || c.name}: ${fmt(c.lineTotal)}`).join(' · ')}</div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Price from (ZAR)</label>
                    <input type="number" value={editing.price_from_zar} onChange={e => setEditing({ ...editing, price_from_zar: Number(e.target.value) })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>OTA comparison price (ZAR)</label>
                    <input type="number" value={editing.ota_price_zar} onChange={e => setEditing({ ...editing, ota_price_zar: Number(e.target.value) })} style={inputStyle} />
                  </div>
                </div>
                {editing.ota_price_zar > editing.price_from_zar && (
                  <div style={{ marginTop: 8, fontSize: 12, color: T.green }}>
                    Saving: {fmt(editing.ota_price_zar - editing.price_from_zar)} ({Math.round((editing.ota_price_zar - editing.price_from_zar) / editing.ota_price_zar * 100)}% below OTA)
                  </div>
                )}
                <button onClick={() => calculatePrice(editing)} disabled={calcLoading}
                  style={{ marginTop: 10, background: T.surface2, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 7, padding: '7px 14px', cursor: 'pointer', fontSize: 12, width: '100%' }}>
                  {calcLoading ? 'Calculating…' : '⟳ Auto-calculate from property selections'}
                </button>
              </div>

              {/* Tags */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: T.gold, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Tags & targeting</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Themes</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {THEMES.map(th => (
                      <button key={th} onClick={() => setEditing({ ...editing, themes: editing.themes.includes(th) ? editing.themes.filter(t => t !== th) : [...editing.themes, th] })}
                        style={{ background: editing.themes.includes(th) ? T.goldDim : T.surface2, border: `0.5px solid ${editing.themes.includes(th) ? T.borderGold : T.border}`, color: editing.themes.includes(th) ? T.gold : T.textDim, borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                        {th}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Target markets</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {MARKETS.map(m => (
                      <button key={m} onClick={() => setEditing({ ...editing, target_markets: editing.target_markets.includes(m) ? editing.target_markets.filter(x => x !== m) : [...editing.target_markets, m] })}
                        style={{ background: editing.target_markets.includes(m) ? 'rgba(96,165,250,0.1)' : T.surface2, border: `0.5px solid ${editing.target_markets.includes(m) ? 'rgba(96,165,250,0.3)' : T.border}`, color: editing.target_markets.includes(m) ? T.blue : T.textDim, borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer' }}>
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — cities */}
            <div>
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.gold, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 2 }}>Itinerary</div>
                    {totalNights > 0 && <div style={{ fontSize: 12, color: T.textDim }}>{totalNights} nights total · {editing.cities.length} destination{editing.cities.length !== 1 ? 's' : ''}</div>}
                  </div>
                  <button onClick={addCity}
                    style={{ background: T.goldDim, border: `0.5px solid ${T.borderGold}`, color: T.gold, borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>
                    + Add destination
                  </button>
                </div>

                {editing.cities.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: T.textDim, fontSize: 13 }}>
                    Add destinations to build the itinerary
                  </div>
                )}

                {editing.cities.map((city, i) => (
                  <CityRow key={i} city={city} index={i} suppliers={suppliers}
                    onChange={(updated: CuratedCity) => {
                      const cities = [...editing.cities];
                      cities[i] = updated;
                      setEditing({ ...editing, cities });
                    }}
                    onRemove={() => setEditing({ ...editing, cities: editing.cities.filter((_, j) => j !== i) })}
                  />
                ))}

                {editing.cities.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: T.gold }}>
                      Routing: {editing.cities.map(c => c.city || '?').join(' → ')}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview card */}
              {editing.name && editing.cities.length > 0 && (
                <div style={{ marginTop: 16, background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, color: T.textDim, padding: '10px 16px', borderBottom: `0.5px solid ${T.border}`, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    Landing page preview
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ height: 140, background: editing.hero_image ? `url(${editing.hero_image}) center/cover` : T.surface2, borderBottom: `0.5px solid ${T.border}` }} />
                    <div style={{ position: 'absolute', top: 10, left: 12, background: editing.badge_color, color: '#0a0a0a', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{editing.badge}</div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, marginBottom: 3 }}>{editing.name}</div>
                    <div style={{ fontSize: 11, color: T.textMid, marginBottom: 10 }}>{editing.tagline}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.gold }}>{editing.price_from_zar > 0 ? fmt(editing.price_from_zar) : '—'}</div>
                        <div style={{ fontSize: 10, color: T.textDim }}>{totalNights} nights · 2 pax</div>
                      </div>
                      {editing.ota_price_zar > editing.price_from_zar && (
                        <div style={{ fontSize: 11, color: T.green }}>Save {fmt(editing.ota_price_zar - editing.price_from_zar)}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save bar */}
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: T.bg2, borderTop: `0.5px solid ${T.border}`, padding: '14px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 }}>
            <div style={{ marginRight: 'auto', fontSize: 12, color: T.textDim }}>
              {totalNights > 0 ? `${totalNights} nights · ${editing.cities.length} destinations` : 'No destinations added yet'}
            </div>
            <button onClick={() => setEditing({ ...editing, status: editing.status === 'published' ? 'draft' : 'published' })}
              style={{ background: editing.status === 'published' ? 'rgba(74,222,128,0.08)' : T.surface, border: `0.5px solid ${editing.status === 'published' ? 'rgba(74,222,128,0.25)' : T.border}`, color: editing.status === 'published' ? T.green : T.textMid, borderRadius: 7, padding: '9px 16px', cursor: 'pointer', fontSize: 12 }}>
              {editing.status === 'published' ? '✓ Published' : 'Draft'}
            </button>
            <button onClick={save} disabled={saving}
              style={{ background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', color: '#0a0a0a', borderRadius: 7, padding: '9px 22px', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save journey'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Jost',sans-serif", color: T.text }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: 4 }}>Admin</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300 }}>Curated Journeys</div>
            <div style={{ fontSize: 13, color: T.textDim, marginTop: 4 }}>Build pre-packaged itineraries for the landing page</div>
          </div>
          <button onClick={() => { setEditing({ ...BLANK }); setPriceCalc(null); setMsg(''); }}
            style={{ background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', color: '#0a0a0a', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + New journey
          </button>
        </div>

        {journeys.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.textDim }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>No curated journeys yet</div>
            <div style={{ fontSize: 12 }}>Create your first package journey to feature on the landing page.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {journeys.map(j => (
            <div key={j.id} style={{ background: T.surface, border: `0.5px solid ${j.status === 'published' ? T.borderGold : T.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Image */}
              <div style={{ width: 80, height: 60, borderRadius: 8, background: j.hero_image ? `url(${j.hero_image}) center/cover` : T.surface2, flexShrink: 0 }} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 400 }}>{j.name || 'Untitled'}</div>
                  <div style={{ background: j.badge_color, color: '#0a0a0a', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>{j.badge}</div>
                </div>
                <div style={{ fontSize: 12, color: T.textMid, marginBottom: 4 }}>{j.tagline}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.textDim }}>
                  {j.nights && <span>{j.nights} nights</span>}
                  {j.price_from_zar > 0 && <span>{fmt(j.price_from_zar)}</span>}
                  {j.cities?.length > 0 && <span>{j.cities.length} destination{j.cities.length !== 1 ? 's' : ''}</span>}
                  {j.themes?.length > 0 && <span>{j.themes.slice(0, 2).join(', ')}</span>}
                </div>
              </div>

              {/* Status + actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: j.status === 'published' ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${j.status === 'published' ? 'rgba(74,222,128,0.25)' : T.border}`, color: j.status === 'published' ? T.green : T.textDim }}>
                  {j.status === 'published' ? '● Live' : '○ Draft'}
                </div>
                <button onClick={() => setEditing(j)} style={{ background: T.surface2, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                <button onClick={() => togglePublish(j)} style={{ background: T.surface2, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }}>
                  {j.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => deleteJourney(j.id!)} style={{ background: 'rgba(248,113,113,0.06)', border: '0.5px solid rgba(248,113,113,0.2)', color: T.red, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 11 }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
