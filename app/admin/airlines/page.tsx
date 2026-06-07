'use client';
// app/admin/airlines/page.tsx  — REPLACE the existing file with this
// Airline logo management: drag & drop to R2, dark lib/theme T tokens, big logos
// Logos → R2: airlines/{IATA}/logo.png (colour), airlines/{IATA}/logo_white.png (white)

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { T } from '../../lib/theme';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ✦ Group / investor carriers — shown first and highlighted
const GROUP_IATA = new Set(['FA', 'FN', 'TC', 'MK', 'MA', 'WA']);

interface Airline {
  id: string; iata_code: string; name: string; short_name: string | null;
  logo_url: string | null; logo_white_url: string | null; logo_updated_at: string | null;
  airline_type: 'commercial_scheduled' | 'charter_safari' | 'helicopter';
  is_duffel: boolean; is_active: boolean;
  baggage_standard_kg: number; baggage_hard_case: boolean;
  baggage_upgrade_label: string | null; baggage_upgrade_kg: number | null;
  baggage_upgrade_pct: number | null; baggage_carryon_kg: number;
  ops_note: string | null; duffel_note: string | null;
}

const TYPE_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  commercial_scheduled: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', label: 'Scheduled'  },
  charter_safari:       { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', label: 'Charter'    },
  helicopter:           { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', label: 'Helicopter' },
};

// ── Drag-and-drop logo zone ───────────────────────────────────────────────────
function DropZone({ iata, variant, currentUrl, uploading, onUpload, w = 110, h = 74 }: {
  iata: string; variant: 'colour' | 'white'; currentUrl: string | null;
  uploading: boolean; onUpload: (file: File, iata: string, variant: 'colour' | 'white') => void;
  w?: number; h?: number;
}) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const darkBg = variant === 'white';

  return (
    <div
      onClick={() => !uploading && ref.current?.click()}
      onDragEnter={e => { e.preventDefault(); setDrag(true); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false);
        const file = e.dataTransfer.files[0];
        if (file) onUpload(file, iata, variant);
      }}
      style={{
        width: w, height: h, borderRadius: 10, cursor: uploading ? 'wait' : 'pointer',
        background: darkBg ? '#2a2a2a' : '#fff',
        border: drag ? `2px solid ${T.gold}` : `1px solid ${darkBg ? T.border : 'rgba(220,220,220,0.2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative', flexShrink: 0,
        boxShadow: drag ? `0 0 0 3px ${T.goldDim}` : 'none',
        transition: 'border 0.15s, box-shadow 0.15s',
      }}
    >
      {currentUrl
        ? <img src={currentUrl} alt="" style={{ maxWidth: '88%', maxHeight: '88%', objectFit: 'contain' }} />
        : <span style={{ fontSize: 11, color: darkBg ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)', textAlign: 'center', lineHeight: 1.4, padding: '0 6px' }}>
            {uploading ? '…' : 'Drop or click'}
          </span>
      }
      {drag && (
        <div style={{ position: 'absolute', inset: 0, background: `${T.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: T.gold }}>
          Drop logo
        </div>
      )}
      {uploading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: T.gold, fontSize: 11 }}>Uploading…</span>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f, iata, variant); e.target.value = ''; } }} />
    </div>
  );
}

// ── Edit drawer ───────────────────────────────────────────────────────────────
function EditDrawer({ airline, onSave, onClose, saving }: {
  airline: Airline; onSave: (a: Airline) => void; onClose: () => void; saving: boolean;
}) {
  const [form, setForm] = useState({ ...airline });
  const upd = (k: keyof Airline) => (v: any) => setForm(p => ({ ...p, [k]: v }));
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div style={{ width: 420, height: '100vh', background: T.bg2, borderLeft: `1px solid ${T.borderGold}`, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: T.gold, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 2 }}>Edit airline</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{form.iata_code} · {form.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 11px', color: T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
        {([['Std allowance (kg)', 'baggage_standard_kg', 'number'], ['Carry-on (kg)', 'baggage_carryon_kg', 'number']] as const).map(([l, k, t]) => (
          <div key={k}>
            <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{l}</label>
            <input type={t} value={(form as any)[k]} onChange={e => upd(k)(parseInt(e.target.value))} style={inp} />
          </div>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: T.textMid }}>
          <input type="checkbox" checked={form.baggage_hard_case} onChange={e => upd('baggage_hard_case')(e.target.checked)} style={{ accentColor: T.gold }} />
          Hard cases permitted
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([['Upgrade label', 'baggage_upgrade_label', 'text', 'X Class'], ['Upgrade kg', 'baggage_upgrade_kg', 'number', '32'], ['Upgrade %', 'baggage_upgrade_pct', 'number', '25']] as const).map(([l, k, t, ph]) => (
            <div key={k}>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{l}</label>
              <input type={t} value={(form as any)[k] || ''} placeholder={ph} onChange={e => upd(k)(e.target.value ? (t === 'number' ? parseFloat(e.target.value) : e.target.value) : null)} style={inp} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          {([['is_duffel', 'Bookable via Duffel'], ['is_active', 'Active']] as const).map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: T.textMid }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => upd(k)(e.target.checked)} style={{ accentColor: T.gold }} /> {l}
            </label>
          ))}
        </div>
        {([['ops_note', 'Ops note (shown on transfer tile)'], ['duffel_note', 'Duffel note (internal)']] as const).map(([k, l]) => (
          <div key={k}>
            <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{l}</label>
            <textarea value={(form as any)[k] || ''} rows={2} onChange={e => upd(k)(e.target.value || null)} style={{ ...inp, resize: 'vertical' }} />
          </div>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={() => onSave(form)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 9, border: 'none', cursor: saving ? 'wait' : 'pointer', background: saving ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg,${T.gold},${T.goldLight})`, color: saving ? T.textDim : '#0a0a0a', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AirlinesAdmin() {
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Airline | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('all');
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('airlines').select('*').order('airline_type').order('name');
    if (error) msg('Failed to load airlines', false);
    else setAirlines((data || []).sort((a, b) =>
      (GROUP_IATA.has(a.iata_code) ? 0 : 1) - (GROUP_IATA.has(b.iata_code) ? 0 : 1) || a.name.localeCompare(b.name)));
    setLoading(false);
  }

  function msg(text: string, ok: boolean) { setFlash({ text, ok }); setTimeout(() => setFlash(null), 3500); }

  async function uploadLogo(file: File, iata: string, variant: 'colour' | 'white') {
    const uk = `${iata}:${variant}`;
    setUploading(p => ({ ...p, [uk]: true }));
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', `airlines/${iata}/logo${variant === 'white' ? '_white' : ''}.${ext}`);
      fd.append('bucket', 'airlines');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      await supabase.from('airlines').update(variant === 'colour' ? { logo_url: url, logo_updated_at: new Date().toISOString() } : { logo_white_url: url, logo_updated_at: new Date().toISOString() }).eq('iata_code', iata);
      msg(`${iata} ${variant} logo uploaded`, true);
      load();
    } catch (e) { msg(`Upload failed: ${e instanceof Error ? e.message : 'error'}`, false); }
    setUploading(p => { const n = { ...p }; delete n[uk]; return n; });
  }

  async function save(form: Airline) {
    setSaving(true);
    const { error } = await supabase.from('airlines').update({ name: form.name, short_name: form.short_name, airline_type: form.airline_type, is_duffel: form.is_duffel, is_active: form.is_active, baggage_standard_kg: form.baggage_standard_kg, baggage_hard_case: form.baggage_hard_case, baggage_upgrade_label: form.baggage_upgrade_label, baggage_upgrade_kg: form.baggage_upgrade_kg, baggage_upgrade_pct: form.baggage_upgrade_pct, baggage_carryon_kg: form.baggage_carryon_kg, ops_note: form.ops_note, duffel_note: form.duffel_note }).eq('id', form.id);
    if (error) msg(`Save failed: ${error.message}`, false);
    else { msg('Saved', true); await load(); setEditing(null); }
    setSaving(false);
  }

  const filtered = filter === 'all' ? airlines : airlines.filter(a => a.airline_type === filter);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: "'Jost','DM Sans',sans-serif", padding: '28px 32px' }}>
      <style>{`*{box-sizing:border-box} input,textarea,select,button{font-family:inherit}`}</style>
      {editing && <EditDrawer airline={editing} onSave={save} onClose={() => setEditing(null)} saving={saving} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 3 }}>Admin · Airlines</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Airline Partners</h1>
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: T.textDim, lineHeight: 1.5 }}>
            Drag a logo onto any zone — or click to browse. R2 path: <code style={{ color: T.gold }}>airlines/{'{IATA}'}/logo.png</code> · ✦ = group carrier
          </p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {['all', 'commercial_scheduled', 'charter_safari', 'helicopter'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 11, border: `1px solid ${filter === f ? T.borderGold : T.border}`, background: filter === f ? T.goldDim : 'transparent', color: filter === f ? T.gold : T.textMid }}>
              {f === 'all' ? `All (${airlines.length})` : TYPE_CHIP[f].label}
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <div style={{ padding: '9px 14px', borderRadius: 9, marginBottom: 16, fontSize: 12, background: flash.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${flash.ok ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.3)'}`, color: flash.ok ? '#4ade80' : '#f87171' }}>
          {flash.text}
        </div>
      )}

      {loading && <div style={{ color: T.textDim, fontSize: 13, padding: '40px 0' }}>Loading airlines…</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {filtered.map(a => {
            const isGroup = GROUP_IATA.has(a.iata_code);
            const chip = TYPE_CHIP[a.airline_type];
            const bagParts = [`${a.baggage_standard_kg}kg`];
            if (!a.baggage_hard_case) bagParts.push('soft bag only');
            if (a.baggage_upgrade_label && a.baggage_upgrade_kg) bagParts.push(`${a.baggage_upgrade_label} ${a.baggage_upgrade_kg}kg`);

            return (
              <div key={a.id} style={{ background: '#1a1a1a', borderRadius: 14, border: `1px solid ${isGroup ? T.borderGold : T.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>

                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.gold, letterSpacing: 0.4 }}>{a.iata_code}</span>
                  {isGroup && <span title="Group carrier" style={{ color: T.gold, fontSize: 12 }}>✦</span>}
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{a.short_name || a.name}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 12, background: chip.bg, color: chip.color, fontWeight: 600 }}>{chip.label}</span>
                    {a.is_duffel && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 12, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>Duffel</span>}
                    {!a.is_active && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: T.textDim }}>Inactive</span>}
                  </div>
                </div>

                {/* Logo zones */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 0.8, marginBottom: 4 }}>COLOUR LOGO</div>
                    <DropZone iata={a.iata_code} variant="colour" currentUrl={a.logo_url} uploading={!!uploading[`${a.iata_code}:colour`]} onUpload={uploadLogo} w={120} h={80} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 0.8, marginBottom: 4 }}>WHITE / DARK</div>
                    <DropZone iata={a.iata_code} variant="white" currentUrl={a.logo_white_url} uploading={!!uploading[`${a.iata_code}:white`]} onUpload={uploadLogo} w={84} h={56} />
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', paddingTop: 18 }}>
                    <div style={{ fontSize: 9.5, color: a.logo_url ? '#4ade80' : '#fb923c', marginBottom: 2 }}>{a.logo_url ? '✓ colour' : '⚠ no colour'}</div>
                    <div style={{ fontSize: 9.5, color: a.logo_white_url ? '#4ade80' : T.textDim }}>{a.logo_white_url ? '✓ white' : '— no white'}</div>
                    {a.logo_url && <a href={a.logo_url} target="_blank" rel="noopener" style={{ display: 'block', marginTop: 6, fontSize: 10, color: '#60a5fa' }}>View ↗</a>}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>{bagParts.join(' · ')}</div>
                  <button onClick={() => setEditing({ ...a })} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.borderGold}`, background: T.goldDim, color: T.gold, fontSize: 11, cursor: 'pointer' }}>
                    Edit rules
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textDim, fontSize: 13 }}>
          No airlines yet. Add rows to the <code style={{ color: T.gold }}>airlines</code> Supabase table.
        </div>
      )}
    </div>
  );
}
