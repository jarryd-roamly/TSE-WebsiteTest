'use client';
// app/admin/airlines/page.tsx
// Airline logo and operator management
// Upload logos to R2, manage baggage rules, Duffel flags

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Airline {
  id: string;
  iata_code: string;
  icao_code: string | null;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  logo_white_url: string | null;
  logo_updated_at: string | null;
  airline_type: 'commercial_scheduled' | 'charter_safari' | 'helicopter';
  is_duffel: boolean;
  is_active: boolean;
  baggage_standard_kg: number;
  baggage_hard_case: boolean;
  baggage_upgrade_label: string | null;
  baggage_upgrade_kg: number | null;
  baggage_upgrade_pct: number | null;
  baggage_carryon_kg: number;
  ops_note: string | null;
  duffel_note: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  commercial_scheduled: 'Commercial',
  charter_safari: 'Charter / Safari',
  helicopter: 'Helicopter',
};

const TYPE_COLOURS: Record<string, string> = {
  commercial_scheduled: '#E6F1FB',
  charter_safari: '#E1F5EE',
  helicopter: '#EEEDFE',
};

const TYPE_TEXT: Record<string, string> = {
  commercial_scheduled: '#0C447C',
  charter_safari: '#085041',
  helicopter: '#3C3489',
};

export default function AirlinesAdmin() {
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Airline | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileWhiteRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('airlines')
      .select('*')
      .order('airline_type')
      .order('name');
    if (error) { flash('Failed to load airlines', false); }
    else setAirlines(data || []);
    setLoading(false);
  }

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }

  async function uploadLogo(file: File, iata: string, variant: 'colour' | 'white') {
    setUploading(variant);
    try {
      // Build R2 key: airlines/4Z/logo.png or airlines/4Z/logo_white.png
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const key = `airlines/${iata}/logo${variant === 'white' ? '_white' : ''}.${ext}`;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', key);
      formData.append('bucket', 'airlines');

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();

      // Update local editing state
      if (variant === 'colour') {
        setEditing(prev => prev ? { ...prev, logo_url: url, logo_updated_at: new Date().toISOString() } : prev);
      } else {
        setEditing(prev => prev ? { ...prev, logo_white_url: url, logo_updated_at: new Date().toISOString() } : prev);
      }
      flash(`Logo uploaded — save to confirm`, true);
    } catch (e) {
      flash(`Upload failed: ${e instanceof Error ? e.message : 'unknown error'}`, false);
    }
    setUploading(null);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from('airlines')
      .update({
        name:                  editing.name,
        short_name:            editing.short_name,
        logo_url:              editing.logo_url,
        logo_white_url:        editing.logo_white_url,
        logo_updated_at:       editing.logo_updated_at,
        airline_type:          editing.airline_type,
        is_duffel:             editing.is_duffel,
        is_active:             editing.is_active,
        baggage_standard_kg:   editing.baggage_standard_kg,
        baggage_hard_case:     editing.baggage_hard_case,
        baggage_upgrade_label: editing.baggage_upgrade_label,
        baggage_upgrade_kg:    editing.baggage_upgrade_kg,
        baggage_upgrade_pct:   editing.baggage_upgrade_pct,
        baggage_carryon_kg:    editing.baggage_carryon_kg,
        ops_note:              editing.ops_note,
        duffel_note:           editing.duffel_note,
      })
      .eq('id', editing.id);

    if (error) { flash(`Save failed: ${error.message}`, false); }
    else { flash('Saved', true); await load(); setEditing(null); }
    setSaving(false);
  }

  const filtered = filter === 'all' ? airlines : airlines.filter(a => a.airline_type === filter);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Airlines</h1>
          <p style={{ fontSize: 13, color: '#666', margin: '3px 0 0' }}>
            Logos stored in R2 at <code style={{ fontSize: 11, background: '#f5f5f5', padding: '1px 5px', borderRadius: 4 }}>airlines/&#123;IATA&#125;/logo.png</code>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'commercial_scheduled', 'charter_safari', 'helicopter'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 20, border: '0.5px solid #ddd',
              background: filter === f ? '#1a3a2a' : '#fff',
              color: filter === f ? '#fff' : '#333',
              fontSize: 12, cursor: 'pointer',
            }}>
              {f === 'all' ? 'All' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.ok ? '#E1F5EE' : '#FCEBEB',
          color: msg.ok ? '#085041' : '#791F1F',
          border: `0.5px solid ${msg.ok ? '#5DCAA5' : '#F09595'}`,
        }}>{msg.text}</div>
      )}

      {loading && <p style={{ color: '#888', fontSize: 13 }}>Loading airlines…</p>}

      {/* Airline list */}
      {!loading && !editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(airline => (
            <div key={airline.id} style={{
              background: '#fff', border: '0.5px solid #e5e5e5', borderRadius: 12,
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {/* Logo preview */}
              <div style={{
                width: 48, height: 48, borderRadius: 10, border: '0.5px solid #e5e5e5',
                background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {airline.logo_url
                  ? <img src={airline.logo_url} alt={airline.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                  : <span style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>{airline.iata_code}</span>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{airline.iata_code}</span>
                  <span style={{ fontSize: 13, color: '#444' }}>{airline.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20,
                    background: TYPE_COLOURS[airline.airline_type],
                    color: TYPE_TEXT[airline.airline_type],
                  }}>{TYPE_LABELS[airline.airline_type]}</span>
                  {airline.is_duffel && (
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C' }}>
                      Duffel
                    </span>
                  )}
                  {!airline.is_active && (
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: '#f5f5f5', color: '#888' }}>
                      Inactive
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {airline.baggage_standard_kg}kg std
                  {!airline.baggage_hard_case && ' · soft bag only'}
                  {airline.baggage_upgrade_label && ` · ${airline.baggage_upgrade_label} ${airline.baggage_upgrade_kg}kg`}
                  {airline.logo_url ? ' · ✓ logo' : ' · ⚠ no logo'}
                  {airline.logo_white_url ? ' · ✓ white logo' : ''}
                </div>
              </div>

              <button onClick={() => setEditing({ ...airline })} style={{
                padding: '6px 14px', borderRadius: 8, border: '0.5px solid #ddd',
                background: '#fff', fontSize: 12, cursor: 'pointer', color: '#333',
              }}>Edit</button>
            </div>
          ))}
        </div>
      )}

      {/* Edit panel */}
      {editing && (
        <div style={{ background: '#fff', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {editing.iata_code} — {editing.name}
            </h2>
            <button onClick={() => setEditing(null)} style={{
              padding: '5px 12px', borderRadius: 8, border: '0.5px solid #ddd',
              background: '#fff', fontSize: 12, cursor: 'pointer',
            }}>Cancel</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Left column — logos */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: '#333' }}>Logos (R2)</h3>

              {/* Colour logo */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>
                  Full colour logo <span style={{ color: '#999' }}>· /airlines/{editing.iata_code}/logo.png</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 10, border: '0.5px solid #e5e5e5',
                    background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {editing.logo_url
                      ? <img src={editing.logo_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 10, color: '#aaa' }}>None</span>
                    }
                  </div>
                  <div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f, editing.iata_code, 'colour'); }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading === 'colour'} style={{
                      padding: '6px 12px', borderRadius: 7, border: '0.5px solid #ddd',
                      background: '#fff', fontSize: 12, cursor: 'pointer', display: 'block', marginBottom: 4,
                    }}>
                      {uploading === 'colour' ? 'Uploading…' : 'Upload colour logo'}
                    </button>
                    {editing.logo_url && (
                      <a href={editing.logo_url} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#185FA5' }}>
                        View current ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* White logo */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>
                  White / reversed logo <span style={{ color: '#999' }}>· /airlines/{editing.iata_code}/logo_white.png</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 10, border: '0.5px solid #e5e5e5',
                    background: '#2d2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {editing.logo_white_url
                      ? <img src={editing.logo_white_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 10, color: '#666' }}>None</span>
                    }
                  </div>
                  <div>
                    <input ref={fileWhiteRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f, editing.iata_code, 'white'); }} />
                    <button onClick={() => fileWhiteRef.current?.click()} disabled={uploading === 'white'} style={{
                      padding: '6px 12px', borderRadius: 7, border: '0.5px solid #ddd',
                      background: '#fff', fontSize: 12, cursor: 'pointer', display: 'block', marginBottom: 4,
                    }}>
                      {uploading === 'white' ? 'Uploading…' : 'Upload white logo'}
                    </button>
                    {editing.logo_white_url && (
                      <a href={editing.logo_white_url} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#185FA5' }}>
                        View current ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo tip */}
              <div style={{ background: '#F0F7F4', borderLeft: '2px solid #1D9E75', borderRadius: '0 6px 6px 0', padding: '7px 10px', fontSize: 11, color: '#085041', lineHeight: 1.5 }}>
                PNG with transparent background recommended. Min 120×120px. Colour logo used on white tile backgrounds. White logo reserved for dark/hero contexts.
              </div>
            </div>

            {/* Right column — baggage & ops */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: '#333' }}>Baggage rules</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Standard allowance (kg)</label>
                  <input type="number" value={editing.baggage_standard_kg}
                    onChange={e => setEditing({ ...editing, baggage_standard_kg: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Carry-on (kg)</label>
                  <input type="number" value={editing.baggage_carryon_kg}
                    onChange={e => setEditing({ ...editing, baggage_carryon_kg: parseInt(e.target.value) })}
                    style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#666', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editing.baggage_hard_case}
                    onChange={e => setEditing({ ...editing, baggage_hard_case: e.target.checked })} />
                  Hard cases permitted
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Upgrade label</label>
                  <input type="text" value={editing.baggage_upgrade_label || ''} placeholder="X Class"
                    onChange={e => setEditing({ ...editing, baggage_upgrade_label: e.target.value || null })}
                    style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Upgrade kg</label>
                  <input type="number" value={editing.baggage_upgrade_kg || ''} placeholder="32"
                    onChange={e => setEditing({ ...editing, baggage_upgrade_kg: e.target.value ? parseInt(e.target.value) : null })}
                    style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Upgrade % above fare</label>
                  <input type="number" value={editing.baggage_upgrade_pct || ''} placeholder="25"
                    onChange={e => setEditing({ ...editing, baggage_upgrade_pct: e.target.value ? parseFloat(e.target.value) : null })}
                    style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12 }} />
                </div>
              </div>

              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px', color: '#333' }}>Flags</h3>
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editing.is_duffel}
                    onChange={e => setEditing({ ...editing, is_duffel: e.target.checked })} />
                  Bookable via Duffel
                </label>
                <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editing.is_active}
                    onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
                  Active
                </label>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Ops note (shown in KB tip on tile)</label>
                <textarea value={editing.ops_note || ''} rows={2}
                  onChange={e => setEditing({ ...editing, ops_note: e.target.value || null })}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12, resize: 'vertical' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Duffel note (internal — not shown to guest)</label>
                <textarea value={editing.duffel_note || ''} rows={2}
                  onChange={e => setEditing({ ...editing, duffel_note: e.target.value || null })}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #ddd', borderRadius: 6, fontSize: 12, resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* Save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #eee' }}>
            <button onClick={save} disabled={saving} style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: saving ? '#ccc' : '#1a3a2a', color: '#fff',
              fontSize: 14, fontWeight: 500, cursor: saving ? 'default' : 'pointer',
            }}>
              {saving ? 'Saving…' : 'Save airline'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
