'use client';

import React, { useState, useEffect, useRef } from 'react';

const URL  = 'https://tkthsbxuyihoblpcfnml.supabase.co';
const KEY  = 'sb_publishable_N1f-OiHXmxQiQTv_EkELcA_IvNtnHsx';
const HDR  = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function sbGet(path: string) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: HDR });
  if (!res.ok) throw new Error(await res.text());
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

async function sbPatch(path: string, body: object) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { method: 'PATCH', headers: HDR, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
}

const C = {
  bg: '#0a0a0a', bg2: '#111111', surface: '#1a1a1a',
  gold: '#d4af37', goldL: '#f0c040', goldDim: 'rgba(212,175,55,0.12)', goldBdr: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', mid: 'rgba(245,240,232,0.58)', dim: 'rgba(245,240,232,0.32)',
  bdr: 'rgba(255,255,255,0.07)', green: '#4ade80', amber: '#fb923c', blue: '#60a5fa',
};

const GROUP = new Set(['FA', 'FN', 'TC', 'MK', 'MA', 'WA']);

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ iata, variant, url, busy, onFile, w, h }: {
  iata: string; variant: string; url: string | null;
  busy: boolean; onFile: (f: File, iata: string, v: string) => void;
  w: number; h: number;
}) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const dark = variant === 'white';

  return (
    <div
      onClick={() => !busy && ref.current?.click()}
      onDragEnter={e => { e.preventDefault(); setOver(true); }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f, iata, variant); }}
      style={{
        width: w, height: h, borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
        background: dark ? '#2a2a2a' : '#ffffff',
        border: over ? `2px solid ${C.gold}` : `1px solid ${dark ? C.bdr : 'rgba(0,0,0,0.12)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative', flexShrink: 0,
        transition: 'border 0.15s',
      }}
    >
      {url
        ? <img src={url} alt="" style={{ maxWidth: '88%', maxHeight: '88%', objectFit: 'contain' }} />
        : <span style={{ fontSize: 10, color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)', textAlign: 'center', padding: '0 6px' }}>
            {busy ? '...' : 'Drop or click'}
          </span>
      }
      {over && <div style={{ position: 'absolute', inset: 0, background: `${C.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.gold }}>Drop</div>}
      {busy && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10, color: C.gold }}>Uploading...</span></div>}
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f, iata, variant); e.target.value = ''; } }} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AirlinesAdmin() {
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving]   = useState(false);
  const [busy, setBusy]       = useState<Record<string, boolean>>({});
  const [filter, setFilter]   = useState('all');
  const [msg, setMsg]         = useState<{ t: string; ok: boolean } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await sbGet('airlines?select=*&order=name.asc');
      const sorted = data.sort((a: any, b: any) =>
        (GROUP.has(a.iata_code) ? 0 : 1) - (GROUP.has(b.iata_code) ? 0 : 1) || a.name.localeCompare(b.name)
      );
      setRows(sorted);
    } catch (e: any) {
      flash('Load failed: ' + e.message, false);
    }
    setLoading(false);
  }

  function flash(t: string, ok: boolean) {
    setMsg({ t, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function upload(file: File, iata: string, variant: string) {
    const k = `${iata}:${variant}`;
    setBusy(p => ({ ...p, [k]: true }));
    try {
      const ext  = file.name.split('.').pop() || 'png';
      const name = `${iata}${variant === 'white' ? '_white' : ''}.${ext}`;
      const res  = await fetch(`${URL}/storage/v1/object/airline-logos/${name}`, {
        method: 'POST',
        headers: {
          'apikey':        KEY,
          'Authorization': `Bearer ${KEY}`,
          'Content-Type':  file.type || 'image/png',
          'x-upsert':      'true',
        },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${URL}/storage/v1/object/public/airline-logos/${name}`;
      const patch = variant === 'colour'
        ? { logo_url: publicUrl, logo_updated_at: new Date().toISOString() }
        : { logo_white_url: publicUrl, logo_updated_at: new Date().toISOString() };
      await sbPatch(`airlines?iata_code=eq.${iata}`, patch);
      flash(`${iata} logo saved`, true);
      load();
    } catch (e: any) {
      flash('Upload failed: ' + e.message, false);
    }
    setBusy(p => { const n = { ...p }; delete n[k]; return n; });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await sbPatch(`airlines?id=eq.${editing.id}`, {
        name: editing.name, short_name: editing.short_name,
        is_duffel: editing.is_duffel, is_active: editing.is_active,
        baggage_standard_kg: editing.baggage_standard_kg,
        baggage_hard_case: editing.baggage_hard_case,
        baggage_upgrade_label: editing.baggage_upgrade_label,
        baggage_upgrade_kg: editing.baggage_upgrade_kg,
        baggage_carryon_kg: editing.baggage_carryon_kg,
        ops_note: editing.ops_note,
      });
      flash('Saved', true);
      setEditing(null);
      load();
    } catch (e: any) {
      flash('Save failed: ' + e.message, false);
    }
    setSaving(false);
  }

  const inp = { width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' };
  const lbl = { display: 'block', fontSize: 10, color: C.gold, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 };
  const visible = filter === 'all' ? rows : rows.filter((r: any) => r.airline_type === filter);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'inherit', padding: '28px 32px' }}>
      <style>{`*{box-sizing:border-box}input,textarea,button{font-family:inherit}`}</style>

      {/* Edit drawer */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 400, background: C.bg2, borderLeft: `1px solid ${C.goldBdr}`, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{editing.iata_code} &middot; {editing.name}</div>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div><label style={lbl}>Standard baggage (kg)</label><input type="number" style={inp} value={editing.baggage_standard_kg} onChange={e => setEditing({ ...editing, baggage_standard_kg: +e.target.value })} /></div>
            <div><label style={lbl}>Carry-on (kg)</label><input type="number" style={inp} value={editing.baggage_carryon_kg} onChange={e => setEditing({ ...editing, baggage_carryon_kg: +e.target.value })} /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: C.mid }}><input type="checkbox" checked={editing.baggage_hard_case} onChange={e => setEditing({ ...editing, baggage_hard_case: e.target.checked })} />Hard cases permitted</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={lbl}>Upgrade label</label><input style={inp} value={editing.baggage_upgrade_label || ''} placeholder="X Class" onChange={e => setEditing({ ...editing, baggage_upgrade_label: e.target.value || null })} /></div>
              <div><label style={lbl}>Upgrade kg</label><input type="number" style={inp} value={editing.baggage_upgrade_kg || ''} placeholder="32" onChange={e => setEditing({ ...editing, baggage_upgrade_kg: e.target.value ? +e.target.value : null })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: C.mid }}><input type="checkbox" checked={editing.is_duffel} onChange={e => setEditing({ ...editing, is_duffel: e.target.checked })} />Duffel</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 12, color: C.mid }}><input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />Active</label>
            </div>
            <div><label style={lbl}>Ops note</label><textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={editing.ops_note || ''} onChange={e => setEditing({ ...editing, ops_note: e.target.value || null })} /></div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer', background: saving ? C.bdr : `linear-gradient(135deg,${C.gold},${C.goldL})`, color: saving ? C.dim : '#0a0a0a', fontWeight: 700, fontSize: 13 }}>{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditing(null)} style={{ padding: '11px 16px', borderRadius: 8, border: `1px solid ${C.bdr}`, background: 'transparent', color: C.mid, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: C.gold, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>Admin · Airlines</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Airline Partners</h1>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: C.dim }}>Drag a logo onto any zone or click to browse · ✦ = group carrier</p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {[['all', `All (${rows.length})`], ['commercial_scheduled', 'Scheduled'], ['charter_safari', 'Charter'], ['helicopter', 'Helicopter']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: '6px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 11, border: `1px solid ${filter === v ? C.goldBdr : C.bdr}`, background: filter === v ? C.goldDim : 'transparent', color: filter === v ? C.gold : C.dim }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Flash */}
      {msg && (
        <div style={{ padding: '9px 14px', borderRadius: 9, marginBottom: 14, fontSize: 12, background: msg.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.3)'}`, color: msg.ok ? C.green : '#f87171' }}>
          {msg.t}
        </div>
      )}

      {loading && <div style={{ color: C.dim, padding: '40px 0', fontSize: 13 }}>Loading...</div>}

      {/* Cards */}
      {!loading && visible.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {visible.map((a: any) => {
            const grp = GROUP.has(a.iata_code);
            const typeColor = a.airline_type === 'charter_safari' ? C.green : a.airline_type === 'helicopter' ? '#a78bfa' : C.blue;
            const typeLabel = a.airline_type === 'charter_safari' ? 'Charter' : a.airline_type === 'helicopter' ? 'Helicopter' : 'Scheduled';
            const bag = [`${a.baggage_standard_kg}kg`, ...(!a.baggage_hard_case ? ['soft bag only'] : []), ...(a.baggage_upgrade_label ? [`${a.baggage_upgrade_label} ${a.baggage_upgrade_kg}kg`] : [])].join(' · ');

            return (
              <div key={a.id} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${grp ? C.goldBdr : C.bdr}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, opacity: a.is_active ? 1 : 0.5 }}>
                {/* Name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{a.iata_code}</span>
                  {grp && <span style={{ color: C.gold, fontSize: 11 }}>✦</span>}
                  <span style={{ fontSize: 13, color: C.text }}>{a.short_name || a.name}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: `${typeColor}18`, color: typeColor, fontWeight: 600 }}>{typeLabel}</span>
                    {a.is_duffel && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: `${C.blue}18`, color: C.blue }}>Duffel</span>}
                    {!a.is_active && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: C.dim }}>Inactive</span>}
                  </div>
                </div>
                {/* Logo zones */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div><div style={{ fontSize: 9, color: C.dim, marginBottom: 3 }}>COLOUR</div><DropZone iata={a.iata_code} variant="colour" url={a.logo_url} busy={!!busy[`${a.iata_code}:colour`]} onFile={upload} w={110} h={72} /></div>
                  <div><div style={{ fontSize: 9, color: C.dim, marginBottom: 3 }}>WHITE</div><DropZone iata={a.iata_code} variant="white" url={a.logo_white_url} busy={!!busy[`${a.iata_code}:white`]} onFile={upload} w={76} h={50} /></div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right', paddingTop: 14 }}>
                    <div style={{ fontSize: 9, color: a.logo_url ? C.green : C.amber }}>{a.logo_url ? '✓ colour' : '⚠ missing'}</div>
                    <div style={{ fontSize: 9, color: a.logo_white_url ? C.green : C.dim, marginTop: 2 }}>{a.logo_white_url ? '✓ white' : '— white'}</div>
                  </div>
                </div>
                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${C.bdr}` }}>
                  <span style={{ fontSize: 10.5, color: C.dim }}>{bag}</span>
                  <button onClick={() => setEditing({ ...a })} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.goldBdr}`, background: C.goldDim, color: C.gold, fontSize: 10.5, cursor: 'pointer' }}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.dim, fontSize: 13 }}>No airlines found.</div>
      )}
    </div>
  );
}
