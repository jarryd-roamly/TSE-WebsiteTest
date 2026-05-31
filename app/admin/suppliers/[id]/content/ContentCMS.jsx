'use client';

// ═══════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — ContentCMS.jsx  v2.0
// Supplier Media Manager — Tabbed Architecture
//
// TABS:
//   Overview   — hero type selector · content score · slide order
//   Gallery    — drag-drop image upload · reorder · inline edit
//   Reels      — YouTube clip editor (dual-handle, speed, preview)
//   Rooms      — per room_type: image gallery + reel + YouTube clip
//   Activities — per activity: image slider + reel + drag-drop
//
// ROUTES:
//   <ContentCMS supplierId="uuid" isAdmin={true} />
//   Placed at: app/admin/suppliers/[id]/content/ContentCMS.jsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ─── Theme ───────────────────────────────────────────────────────────────────
const T = {
  bg:         '#0a0a0a',
  surface:    '#141414',
  bg3:        '#1e1e1e',
  border:     'rgba(255,255,255,0.1)',
  borderGold: 'rgba(212,175,55,0.35)',
  text:       '#f5f0e8',
  textMid:    'rgba(245,240,232,0.65)',
  textDim:    'rgba(245,240,232,0.35)',
  gold:       '#d4af37',
  goldLight:  '#f0c040',
  goldDim:    'rgba(212,175,55,0.12)',
  green:      '#4ade80',
  amber:      '#fbbf24',
  red:        '#f87171',
  blue:       '#60a5fa',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text}; font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 2px; }
  .drag-handle { cursor: grab; }
  .drag-handle:active { cursor: grabbing; }
  .dragging { opacity: 0.4; }
  .drag-over { border-color: ${T.gold} !important; background: rgba(212,175,55,0.08) !important; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  .fade-in { animation: fadeIn 0.25s ease; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .saving { animation: pulse 1s ease infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
`;

// ─── Supabase helpers ─────────────────────────────────────────────────────────
function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  return {
    async fetch1(table, filter) {
      const res = await fetch(`${url}/rest/v1/${table}?${filter}&limit=1`, { headers: h });
      if (!res.ok) throw new Error(`${table} fetch ${res.status}`);
      const rows = await res.json();
      return rows[0] ?? null;
    },
    async fetchMany(table, filter) {
      const res = await fetch(`${url}/rest/v1/${table}?${filter}`, { headers: h });
      if (!res.ok) throw new Error(`${table} fetchMany ${res.status}`);
      return res.json();
    },
    async patch(table, filter, patch) {
      const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: 'PATCH',
        headers: { ...h, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`${table} PATCH ${res.status}`);
    },
    async uploadFile(supplierId, file, isAdmin) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('supplier_id', supplierId);
      fd.append('media_type', 'images');
      fd.append('caption', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80));
      fd.append('uploaded_by', isAdmin ? 'admin' : 'supplier');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text().catch(() => `Status ${res.status}`));
      return res.json();
    },
  };
}

// ─── YouTube helpers ─────────────────────────────────────────────────────────
function parseYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

const CLIP_MAX = 15;
const CLIP_MIN = 5;
const VID_MAX  = 600;

// ─── Shared sub-components ────────────────────────────────────────────────────

function Btn({ children, onClick, variant = 'ghost', disabled, style: s = {} }) {
  const base = { padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s', opacity: disabled ? 0.5 : 1, border: 'none' };
  const variants = {
    gold:    { background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, color: '#0a0a0a' },
    ghost:   { background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${T.border}`, color: T.textMid },
    danger:  { background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', color: T.red },
    blue:    { background: 'rgba(96,165,250,0.1)', border: '0.5px solid rgba(96,165,250,0.3)', color: T.blue },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...s }}>{children}</button>;
}

function Label({ children }) {
  return <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{children}</div>;
}

function Card({ children, style: s = {} }) {
  return <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20, ...s }}>{children}</div>;
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ padding: '36px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, color: T.textMid, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: T.textDim }}>{sub}</div>
    </div>
  );
}

// ─── Image thumbnail grid (shared between rooms + activities) ─────────────────
function MediaThumb({ url, onRemove, onSetPrimary, isPrimary }) {
  return (
    <div style={{ position: 'relative', width: 80, height: 60, borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${isPrimary ? T.gold : T.border}`, flexShrink: 0 }}>
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.15s' }}
           onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
           onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
        <div style={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: 3 }}>
          {onSetPrimary && (
            <div onClick={onSetPrimary} title="Set primary"
              style={{ width: 18, height: 18, borderRadius: '50%', background: isPrimary ? T.gold : 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: isPrimary ? '#0a0a0a' : T.textDim }}>★</div>
          )}
          {onRemove && (
            <div onClick={onRemove} title="Remove"
              style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(248,113,113,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: '#fff' }}>×</div>
          )}
        </div>
      </div>
      {isPrimary && <div style={{ position: 'absolute', bottom: 2, left: 3, fontSize: 8, color: T.gold, fontWeight: 700 }}>PRIMARY</div>}
    </div>
  );
}

// ─── Drop zone (reusable) ─────────────────────────────────────────────────────
function DropZone({ onFiles, compact }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragEnter={e => { e.preventDefault(); setDrag(true); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (files.length) onFiles(files); }}
      style={{
        border: `1.5px dashed ${drag ? T.gold : T.border}`,
        borderRadius: 10,
        padding: compact ? '14px 12px' : '24px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        background: drag ? T.goldDim : 'rgba(255,255,255,0.02)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: compact ? 18 : 24, marginBottom: 6 }}>📷</div>
      <div style={{ fontSize: 12, color: T.textMid }}>{compact ? 'Drop or click to add photos' : 'Drag photos here or click to choose'}</div>
      {!compact && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>JPG · PNG · WEBP · Multiple supported</div>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/')); if (files.length) onFiles(files); e.target.value = ''; }} style={{ display: 'none' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// YOUTUBE POPUP  (unchanged logic from v1, pulled into named export)
// ═══════════════════════════════════════════════════════════════════════════════
function YouTubePopup({ onSave, onClose, existing }) {
  const [url,       setUrl]       = useState(existing?.video_id ? `https://youtu.be/${existing.video_id}` : '');
  const [videoId,   setVideoId]   = useState(existing?.video_id ?? null);
  const [start,     setStart]     = useState(existing?.start ?? 0);
  const [end,       setEnd]       = useState(existing?.end ?? CLIP_MAX);
  const [speed,     setSpeed]     = useState(existing?.speed ?? 1);
  const [caption,   setCaption]   = useState(existing?.caption ?? '');
  const [previewing,setPreviewing]= useState(false);

  const handleUrl = (v) => {
    setUrl(v);
    const id = parseYouTubeId(v);
    if (id) { setVideoId(id); setStart(0); setEnd(CLIP_MAX); setPreviewing(false); }
    else setVideoId(null);
  };

  const handleStart = (val) => {
    const s = Math.max(0, Math.min(Number(val), VID_MAX - CLIP_MIN));
    setStart(s);
    setEnd(Math.min(s + CLIP_MAX, VID_MAX));
  };

  const handleEnd = (val) => {
    const e = Math.max(start + CLIP_MIN, Math.min(Number(val), Math.min(start + CLIP_MAX, VID_MAX)));
    setEnd(e);
  };

  const pct = (v) => `${Math.round((v / VID_MAX) * 100)}%`;
  const clipLen = Math.round(end - start);
  const thumbSrc = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  const previewSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?start=${Math.round(start)}&end=${Math.round(end)}&autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0`
    : null;

  const SPEEDS = [
    { v: 0.5, label: '0.5×', desc: 'Slow motion' },
    { v: 0.75, label: '0.75×', desc: 'Gentle' },
    { v: 1, label: '1×', desc: 'Normal' },
    { v: 1.25, label: '1.25×', desc: 'Faster' },
    { v: 1.5, label: '1.5×', desc: 'Fast cut' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0f0f0f', border: `0.5px solid ${T.borderGold}`, borderRadius: 16, padding: '24px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.gold }}>🎬 YouTube reel editor</div>
          <Btn onClick={onClose} style={{ padding: '4px 10px' }}>×</Btn>
        </div>

        {/* URL */}
        <div style={{ marginBottom: 14 }}>
          <Label>YouTube URL</Label>
          <input value={url} onChange={e => handleUrl(e.target.value)} placeholder="https://youtu.be/... or youtube.com/watch?v=..."
            style={{ width: '100%', padding: '9px 12px', background: T.bg3, border: `1.5px solid ${videoId ? T.borderGold : T.border}`, borderRadius: 9, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          {url && !videoId && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>⚠ Couldn't extract video ID</div>}
          {videoId && <div style={{ fontSize: 11, color: T.green, marginTop: 4 }}>✓ Video ID: {videoId}</div>}
        </div>

        {/* Thumbnail / preview */}
        {videoId && !previewing && (
          <div style={{ position: 'relative', height: 170, borderRadius: 10, overflow: 'hidden', background: '#111', marginBottom: 14, cursor: 'pointer' }} onClick={() => setPreviewing(true)}>
            <img src={thumbSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(212,175,55,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>▶</div>
            </div>
            <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 10, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 7px' }}>Click to preview</div>
          </div>
        )}
        {videoId && previewing && (
          <div style={{ position: 'relative', paddingBottom: '42%', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 14 }}>
            <iframe key={`${videoId}-${start}-${end}`} src={previewSrc}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; encrypted-media" />
            <Btn onClick={() => setPreviewing(false)} style={{ position: 'absolute', top: 8, right: 8, padding: '3px 8px' }}>✕</Btn>
          </div>
        )}

        {videoId && (
          <>
            {/* Clip window */}
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>Clip window</Label>
                <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
                  {clipLen}s · {Math.floor(start/60)}:{String(Math.round(start%60)).padStart(2,'0')} → {Math.floor(end/60)}:{String(Math.round(end%60)).padStart(2,'0')}
                </div>
              </div>
              {/* Start track */}
              <div style={{ position: 'relative', height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 10 }}>
                <div style={{ position: 'absolute', left: pct(start), width: `${Math.round(((end-start)/VID_MAX)*100)}%`, height: '100%', background: 'rgba(212,175,55,0.25)', borderRadius: 4 }} />
                <input type="range" min={0} max={VID_MAX} step={0.5} value={start} onChange={e => handleStart(e.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 3 }} />
                <div style={{ position: 'absolute', left: `calc(${pct(start)} - 14px)`, top: '50%', transform: 'translateY(-50%)', width: 28, height: 40, background: T.gold, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#0a0a0a', fontWeight: 900, zIndex: 2 }}>◂</div>
              </div>
              {/* End track */}
              <div style={{ position: 'relative', height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 10 }}>
                <div style={{ position: 'absolute', left: pct(start), width: `${Math.round(((end-start)/VID_MAX)*100)}%`, height: '100%', background: 'rgba(212,175,55,0.12)', borderRadius: 4 }} />
                <input type="range" min={start+CLIP_MIN} max={Math.min(start+CLIP_MAX,VID_MAX)} step={0.5} value={end} onChange={e => handleEnd(e.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 3 }} />
                <div style={{ position: 'absolute', left: `calc(${pct(end)} - 14px)`, top: '50%', transform: 'translateY(-50%)', width: 28, height: 40, background: '#fff', border: `2.5px solid ${T.gold}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.gold, fontWeight: 900, zIndex: 2 }}>▸</div>
              </div>
              <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.5, marginBottom: 10 }}>
                <strong style={{ color: T.gold }}>Gold ◂</strong> moves start — end follows at +{CLIP_MAX}s. &nbsp;<strong style={{ color: T.text }}>White ▸</strong> shortens clip (max {CLIP_MAX}s).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Start (s)', start, handleStart, 0, VID_MAX-CLIP_MIN], ['End (s)', end, handleEnd, start+CLIP_MIN, Math.min(start+CLIP_MAX,VID_MAX)]].map(([lbl, val, fn, min, max]) => (
                  <div key={lbl}>
                    <div style={{ fontSize: 10, color: T.textDim, marginBottom: 3 }}>{lbl}</div>
                    <input type="number" value={Math.round(val*10)/10} min={min} max={max} step={0.5}
                      onChange={e => fn(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Speed */}
            <div style={{ marginBottom: 14 }}>
              <Label>Playback speed</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SPEEDS.map(s => (
                  <button key={s.v} onClick={() => setSpeed(s.v)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${speed===s.v ? T.gold : T.border}`, background: speed===s.v ? T.goldDim : 'transparent', color: speed===s.v ? T.gold : T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: speed===s.v ? 700 : 400 }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 5 }}>{SPEEDS.find(s => s.v===speed)?.desc}</div>
            </div>

            {/* Caption */}
            <div style={{ marginBottom: 14 }}>
              <Label>Caption (optional)</Label>
              <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Arrival experience · Dawn game drive"
                style={{ width: '100%', padding: '8px 12px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="blue" onClick={() => setPreviewing(v => !v)} style={{ flex: 1 }}>{previewing ? '■ Stop' : '▶ Preview'}</Btn>
              <Btn variant="gold" onClick={() => onSave({ source: 'youtube', video_id: videoId, start: Math.round(start*10)/10, end: Math.round(end*10)/10, speed, caption, thumbnail: thumbSrc })} style={{ flex: 2 }}>Save reel →</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT SCORE (unchanged from v1)
// ═══════════════════════════════════════════════════════════════════════════════
function computeContentScore(supplier, images, reels) {
  const approved = (images ?? []).filter(i => i.status === 'approved');
  const desc = (supplier?.description ?? '').trim();
  const descWords = desc.split(/\s+/).filter(Boolean).length;
  const imgCount = approved.length;
  const reelCount = (reels ?? []).length;
  const totalTags = (supplier?.tags?.length ?? 0) + (supplier?.keywords?.length ?? 0);

  const descPts  = descWords >= 150 ? 15 : descWords >= 100 ? 11 : descWords >= 50 ? 7 : descWords >= 20 ? 4 : descWords > 0 ? 1 : 0;
  const imgPts   = imgCount >= 12 ? 20 : imgCount >= 8 ? 16 : imgCount >= 5 ? 11 : imgCount >= 2 ? 6 : imgCount >= 1 ? 2 : 0;
  const reelPts  = reelCount >= 2 ? 20 : reelCount === 1 ? 12 : 0;
  const tagPts   = totalTags >= 5 ? 5 : totalTags >= 3 ? 3 : totalTags >= 1 ? 1 : 0;
  const freshPts = supplier?.updated_at ? (() => { const d = (Date.now() - new Date(supplier.updated_at).getTime())/(86400000); return d<=90?5:d<=180?3:d<=365?1:0; })() : 0;

  const total = descPts + imgPts + reelPts + tagPts + freshPts;
  return {
    total, max: 65, pct: Math.round((total/65)*100),
    dimensions: [
      { id:'desc',  label:'Description',  pts:descPts,  max:15, hint: descWords < 150 ? `${150-descWords} words to go` : '✓' },
      { id:'img',   label:'Photography',  pts:imgPts,   max:20, hint: imgCount < 12 ? `${12-imgCount} more images` : '✓' },
      { id:'reel',  label:'Reels',        pts:reelPts,  max:20, hint: reelCount < 2 ? `${2-reelCount} more reel${reelCount===1?'':'s'}` : '✓' },
      { id:'tags',  label:'Tags',         pts:tagPts,   max:5,  hint: totalTags < 5 ? `${5-totalTags} more tags` : '✓' },
      { id:'fresh', label:'Freshness',    pts:freshPts, max:5,  hint: freshPts < 5 ? 'Update content to refresh' : '✓' },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TabOverview({ supplier, images, reels, heroType, setHeroType, locked, setLocked, isAdmin, slides, previewSlide, setPreviewSlide }) {
  const score = useMemo(() => computeContentScore(supplier, images, reels), [supplier, images, reels]);
  const [scoreOpen, setScoreOpen] = useState(true);

  return (
    <div className="fade-in">
      {/* Hero type */}
      <Card>
        <Label>Hero tile type</Label>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>Which asset appears first when travellers view this property.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { id:'image', label:'📷 Image first', desc:'Primary photo as hero' },
            { id:'reel',  label:'▶ Reel first',   desc:'YouTube clip as hero' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setHeroType(opt.id)}
              style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${heroType===opt.id ? T.gold : T.border}`, background: heroType===opt.id ? T.goldDim : T.bg3, color: heroType===opt.id ? T.gold : T.textMid, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: heroType===opt.id ? 700 : 400, marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 10, color: T.textDim }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Score */}
      <Card style={{ border: `0.5px solid ${score.pct >= 80 ? T.borderGold : T.border}` }}>
        <div onClick={() => setScoreOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 10 }}>
          <div>
            <Label>Content score</Label>
            <div style={{ fontSize: 11, color: T.textDim }}>{score.pct >= 80 ? 'Featured eligible ✓' : score.pct >= 60 ? 'Good — keep going' : 'Needs work'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: score.pct>=80?T.gold:score.pct>=60?T.text:T.amber, fontFamily:"'Playfair Display',serif" }}>{score.total}<span style={{ fontSize: 12, color: T.textDim, fontWeight: 400 }}>/65</span></div>
            <div style={{ fontSize: 11, color: T.textDim }}>{scoreOpen?'▲':'▼'}</div>
          </div>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width:`${score.pct}%`, height:'100%', background:`linear-gradient(90deg,${T.gold},${T.goldLight})`, transition:'width 0.4s' }} />
        </div>
        {scoreOpen && (
          <div style={{ marginTop: 14, borderTop: `0.5px solid ${T.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {score.dimensions.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, color: d.pts===d.max ? T.green : T.textDim, width: 12 }}>{d.pts===d.max?'✓':'·'}</div>
                <div style={{ fontSize: 12, color: T.text, flex: 1 }}>{d.label}</div>
                <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width:`${(d.pts/d.max)*100}%`, height:'100%', background: d.pts===d.max?T.green:T.gold }} />
                </div>
                <div style={{ fontSize: 11, color: T.textDim, width: 44, textAlign: 'right' }}>{d.pts}/{d.max}</div>
                <div style={{ fontSize: 10, color: T.textDim, width: 110, textAlign: 'right' }}>{d.hint}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Slide order */}
      <Card>
        <Label>Slide order</Label>
        {slides.length === 0
          ? <EmptyState icon="🎞" title="No slides yet" sub="Add images in the Gallery tab" />
          : slides.map((s, i) => (
            <div key={i} onClick={() => setPreviewSlide(i)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:previewSlide===i?T.goldDim:'rgba(255,255,255,0.02)', border:`0.5px solid ${previewSlide===i?T.borderGold:T.border}`, cursor:'pointer', marginBottom:5, transition:'all 0.15s' }}>
              <div style={{ width:20, height:20, borderRadius:5, background:T.bg3, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:previewSlide===i?T.gold:T.textDim, fontWeight:700 }}>{i+1}</div>
              <div style={{ flex:1, fontSize:12, color:previewSlide===i?T.gold:T.text }}>{s.label ?? `Slide ${i+1}`}</div>
              <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.type}</div>
              {i===0 && <div style={{ fontSize:9, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, borderRadius:20, padding:'1px 7px', fontWeight:700 }}>Hero</div>}
            </div>
          ))
        }
      </Card>

      {/* Lock toggle (admin) */}
      {isAdmin && (
        <Card>
          <Label>Media order lock</Label>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:12, color:T.textDim }}>When locked, suppliers cannot reorder images or reels.</div>
            <Btn variant={locked?'ghost':'ghost'} onClick={() => setLocked(l => !l)}>
              {locked ? '🔒 Locked' : '🔓 Unlocked'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GALLERY  (images for the property as a whole)
// ═══════════════════════════════════════════════════════════════════════════════
function TabGallery({ supplierId, isAdmin, images, setImages, locked }) {
  const db = useMemo(() => createSupabase(), []);
  const [uploads, setUploads] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const uploadOne = async (file) => {
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    let lowRes = false;
    try {
      const dims = await new Promise((res,rej) => { const img = new Image(); img.onload = () => { res({w:img.width,h:img.height}); URL.revokeObjectURL(img.src); }; img.onerror = () => rej(); img.src = URL.createObjectURL(file); });
      if (dims.w < 1200) lowRes = true;
    } catch {}
    setUploads(u => [...u, { id, name:file.name, status:'uploading', lowRes }]);
    try {
      await db.uploadFile(supplierId, file, isAdmin);
      const fresh = await db.fetch1('suppliers', `id=eq.${supplierId}&select=images`);
      if (fresh) {
        let imgs = [];
        try { imgs = Array.isArray(fresh.images) ? fresh.images : (fresh.images ? JSON.parse(fresh.images) : []); } catch {}
        setImages(imgs.map((img,i) => ({ ...img, display_order: img.display_order ?? i+1 })));
      }
      setUploads(u => u.map(x => x.id===id ? { ...x, status:'done' } : x));
      setTimeout(() => setUploads(u => u.filter(x => x.id!==id)), 4000);
    } catch(e) {
      setUploads(u => u.map(x => x.id===id ? { ...x, status:'error', error:e.message } : x));
    }
  };

  const handleFiles = async (files) => {
    for (let i=0; i<files.length; i+=4) await Promise.all(files.slice(i,i+4).map(uploadOne));
  };

  const onDragStart = (e,idx) => { if (locked && !isAdmin) return; setDragIdx(idx); e.dataTransfer.effectAllowed='move'; };
  const onDragOver  = (e,idx) => { e.preventDefault(); setDragOverIdx(idx); };
  const onDrop      = (e,dropIdx) => {
    e.preventDefault();
    if (dragIdx===null||dragIdx===dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...images];
    const [m] = next.splice(dragIdx,1);
    next.splice(dropIdx,0,m);
    setImages(next.map((img,i) => ({ ...img, display_order:i+1 })));
    setDragIdx(null); setDragOverIdx(null);
  };

  const setPrimary = (idx) => {
    setImages(images.map((img,i) => ({ ...img, is_primary:i===idx })).sort((a,b) => (b.is_primary?1:0)-(a.is_primary?1:0)).map((img,i) => ({ ...img, display_order:i+1 })));
  };

  const deleteImage = (idx) => {
    if (!window.confirm('Remove this image?')) return;
    setImages(images.filter((_,i) => i!==idx).map((img,i) => ({ ...img, display_order:i+1 })));
    setEditIdx(null); setEditDraft(null);
  };

  const openEdit = (idx) => {
    if (editIdx===idx) { setEditIdx(null); setEditDraft(null); return; }
    setEditIdx(idx);
    const img = images[idx];
    setEditDraft({ caption:img.caption??'', room_type:img.room_type??'', tags:Array.isArray(img.tags)?img.tags.join(', '):(img.tags??''), status:img.status??'approved' });
  };

  const saveEdit = () => {
    const tagList = String(editDraft.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
    setImages(images.map((img,i) => i===editIdx ? { ...img, caption:editDraft.caption, room_type:editDraft.room_type, tags:tagList, status:editDraft.status } : img));
    setEditIdx(null); setEditDraft(null);
  };

  return (
    <div className="fade-in">
      <Card>
        <Label>Upload images</Label>
        <div style={{ fontSize:11, color:T.textDim, marginBottom:12 }}>{isAdmin ? 'Goes live immediately' : 'Submitted for admin review'} · JPG/PNG/WEBP · 1600px+ recommended</div>
        <DropZone onFiles={handleFiles} />
        {uploads.length > 0 && (
          <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
            {uploads.map(u => (
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:T.bg3, border:`0.5px solid ${u.status==='error'?'rgba(248,113,113,0.3)':u.status==='done'?'rgba(74,222,128,0.3)':T.border}`, borderRadius:8 }}>
                <div style={{ fontSize:13 }}>{u.status==='uploading'?'↑':u.status==='done'?'✓':'⚠'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize:10, color:u.status==='error'?T.red:u.lowRes?T.amber:T.textDim, marginTop:2 }}>
                    {u.status==='uploading'&&'Uploading…'}{u.status==='done'&&(u.lowRes?'✓ Uploaded — consider 1600px+ next time':'✓ Uploaded')}{u.status==='error'&&(u.error||'Failed')}
                  </div>
                </div>
                {u.status==='error' && <Btn onClick={() => setUploads(p=>p.filter(x=>x.id!==u.id))} style={{ padding:'3px 8px' }}>×</Btn>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <Label>Image order</Label>
          {locked && !isAdmin && <div style={{ fontSize:10, color:T.amber, background:'rgba(251,191,36,0.1)', border:'0.5px solid rgba(251,191,36,0.3)', borderRadius:20, padding:'2px 10px' }}>🔒 Locked</div>}
        </div>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:14 }}>Drag to reorder · ★ sets primary hero · ✎ edits caption and tags</div>
        {images.length === 0
          ? <EmptyState icon="📷" title="No images yet" sub="Upload images using the drop zone above" />
          : images.map((img,idx) => (
            <div key={img.url??idx} style={{ marginBottom:6 }}>
              <div draggable={!locked||isAdmin} onDragStart={e=>onDragStart(e,idx)} onDragOver={e=>onDragOver(e,idx)} onDrop={e=>onDrop(e,idx)} onDragEnd={()=>{setDragIdx(null);setDragOverIdx(null);}}
                className={`${dragIdx===idx?'dragging':''} ${dragOverIdx===idx?'drag-over':''}`}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:T.bg3, border:`0.5px solid ${dragOverIdx===idx?T.gold:T.border}`, borderRadius:10, cursor:locked&&!isAdmin?'default':'grab', transition:'all 0.15s' }}>
                <div className="drag-handle" style={{ color:T.textDim, fontSize:16, paddingRight:4 }}>⋮</div>
                <div style={{ width:64, height:44, borderRadius:6, overflow:'hidden', flexShrink:0, background:'#111' }}>
                  <img src={img.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{e.currentTarget.style.display='none';}} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{img.caption||img.room_type||`Image ${idx+1}`}</div>
                  <div style={{ display:'flex', gap:5, marginTop:3, flexWrap:'wrap' }}>
                    {img.is_primary && <span style={{ fontSize:9, color:T.gold, background:T.goldDim, border:'0.5px solid '+T.borderGold, borderRadius:20, padding:'1px 7px', fontWeight:700 }}>Primary</span>}
                    {img.room_type && <span style={{ fontSize:9, color:T.textDim, background:'rgba(255,255,255,0.05)', border:'0.5px solid '+T.border, borderRadius:20, padding:'1px 7px' }}>{img.room_type}</span>}
                    {img.status && img.status!=='approved' && <span style={{ fontSize:9, color:T.amber, background:'rgba(251,191,36,0.08)', border:'0.5px solid rgba(251,191,36,0.2)', borderRadius:20, padding:'1px 7px' }}>{img.status}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={()=>setPrimary(idx)} style={{ background:img.is_primary?T.goldDim:'rgba(255,255,255,0.04)', border:'0.5px solid '+(img.is_primary?T.borderGold:T.border), borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', color:img.is_primary?T.gold:T.textDim }}>★</button>
                  <button onClick={()=>openEdit(idx)} style={{ background:editIdx===idx?T.goldDim:'rgba(255,255,255,0.04)', border:'0.5px solid '+(editIdx===idx?T.borderGold:T.border), borderRadius:7, width:28, height:28, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', color:editIdx===idx?T.gold:T.textDim }}>✎</button>
                </div>
              </div>
              {editIdx===idx && editDraft && (
                <div style={{ background:T.bg3, border:'0.5px solid '+T.borderGold, borderRadius:10, padding:'14px', marginTop:4 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:10 }}>
                    {[['Caption','caption','Image caption…',120],['Room type','room_type','e.g. Boulders Suite',50]].map(([lbl,key,ph,max]) => (
                      <div key={key}>
                        <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:5 }}>{lbl}</div>
                        <input value={editDraft[key]} onChange={e=>setEditDraft({...editDraft,[key]:e.target.value.slice(0,max)})} placeholder={ph}
                          style={{ width:'100%', background:T.surface, border:'0.5px solid '+T.border, color:T.text, borderRadius:7, padding:'8px 10px', fontSize:12, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:5 }}>Tags (comma-separated)</div>
                    <input value={editDraft.tags} onChange={e=>setEditDraft({...editDraft,tags:e.target.value.slice(0,200)})} placeholder="e.g. sunrise, suite, romantic, plunge-pool"
                      style={{ width:'100%', background:T.surface, border:'0.5px solid '+T.border, color:T.text, borderRadius:7, padding:'8px 10px', fontSize:12, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:5 }}>Status</div>
                    <div style={{ display:'flex', gap:6 }}>
                      {['approved','pending','rejected'].map(s => (
                        <button key={s} onClick={()=>setEditDraft({...editDraft,status:s})}
                          style={{ flex:1, padding:'7px 0', borderRadius:7, border:`1.5px solid ${editDraft.status===s?(s==='approved'?T.green:s==='pending'?T.amber:T.red):T.border}`, background:editDraft.status===s?(s==='approved'?'rgba(74,222,128,0.1)':s==='pending'?'rgba(251,191,36,0.1)':'rgba(248,113,113,0.1)'):'transparent', color:editDraft.status===s?(s==='approved'?T.green:s==='pending'?T.amber:T.red):T.textMid, fontSize:11, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize', fontWeight:editDraft.status===s?700:400 }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <Btn variant="danger" onClick={()=>deleteImage(idx)}>Delete</Btn>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn onClick={()=>{setEditIdx(null);setEditDraft(null);}}>Cancel</Btn>
                      <Btn variant="gold" onClick={saveEdit}>Save →</Btn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        }
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REELS  (property-level YouTube clips)
// ═══════════════════════════════════════════════════════════════════════════════
function TabReels({ reels, setReels }) {
  const [showPopup, setShowPopup] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div className="fade-in">
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <Label>Property reels</Label>
          <Btn variant="gold" onClick={()=>{setEditing(null);setShowPopup(true);}}>+ Add reel</Btn>
        </div>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:14, lineHeight:1.55 }}>
          Paste a YouTube URL, trim to 5–15 seconds, set playback speed. These reels appear in the property carousel and can be set as the hero tile from the Overview tab.
        </div>
        {reels.length === 0
          ? <EmptyState icon="🎬" title="No reels yet" sub="Add a YouTube clip to bring this property to life" />
          : reels.map((reel,i) => (
            <div key={i} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 12px', background:T.bg3, border:`0.5px solid ${T.border}`, borderRadius:10, marginBottom:8 }}>
              <div style={{ width:80, height:50, borderRadius:6, overflow:'hidden', flexShrink:0, background:'#111' }}>
                {reel.thumbnail ? <img src={reel.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>▶</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{reel.caption||reel.video_id}</div>
                <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{Math.round(reel.start)}s → {Math.round(reel.end)}s · {reel.speed}× · {Math.round(reel.end-reel.start)}s clip</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <Btn onClick={()=>{setEditing(reel);setShowPopup(true);}}>Edit</Btn>
                <Btn variant="danger" onClick={()=>setReels(p=>p.filter((_,idx)=>idx!==i))}>Remove</Btn>
              </div>
            </div>
          ))
        }
      </Card>

      {showPopup && (
        <YouTubePopup
          existing={editing}
          onClose={()=>{setShowPopup(false);setEditing(null);}}
          onSave={reel => {
            if (editing) setReels(p => p.map(r => r===editing ? reel : r));
            else setReels(p => [...p, reel]);
            setShowPopup(false); setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ROOMS  — per room_type: image gallery + reel + YouTube clip
// Reads from room_types table (supplier_id FK)
// ═══════════════════════════════════════════════════════════════════════════════
function TabRooms({ supplierId, isAdmin }) {
  const db = useMemo(() => createSupabase(), []);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // room id
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [ytRoom, setYtRoom] = useState(null); // room whose YouTube popup is open

  useEffect(() => {
    if (!db || !supplierId) { setLoading(false); return; }
    db.fetchMany('room_types', `supplier_id=eq.${supplierId}&order=name&select=*`)
      .then(rows => setRooms(rows.map(r => ({
        ...r,
        images: Array.isArray(r.images) ? r.images : (r.images ? JSON.parse(r.images) : []),
        reels:  Array.isArray(r.reels)  ? r.reels  : (r.reels  ? JSON.parse(r.reels)  : []),
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [supplierId]);

  const updateRoom = (id, patch) => setRooms(p => p.map(r => r.id===id ? { ...r, ...patch } : r));

  const saveRoom = async (room) => {
    if (!db) return;
    setSaving(room.id);
    try {
      await db.patch('room_types', `id=eq.${room.id}`, { images: room.images, reels: room.reels });
    } catch(e) { alert('Save failed: ' + e.message); }
    finally { setSaving(null); }
  };

  const handleRoomFiles = async (room, files) => {
    // Upload files and append URLs to room.images
    for (const file of files) {
      const id = `up-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      try {
        await db.uploadFile(supplierId, file, isAdmin);
        // After upload, the image URL is added to suppliers.images by the API.
        // We also append a local reference to this room's image array.
        const url = URL.createObjectURL(file);
        updateRoom(room.id, {
          images: [...(room.images||[]), { url, caption: file.name.replace(/\.[^.]+$/,'').slice(0,60), is_primary: (room.images||[]).length===0 }]
        });
      } catch(e) { /* silently skip failed uploads */ }
    }
  };

  const CATEGORY_COLOURS = {
    Standard:      { bg:'rgba(100,200,100,0.1)',  border:'rgba(100,200,100,0.3)',  text:'#6dc76d' },
    Premium:       { bg:'rgba(212,175,55,0.12)', border:'rgba(212,175,55,0.35)', text:T.gold },
    Family:        { bg:'rgba(96,165,250,0.1)',  border:'rgba(96,165,250,0.3)',  text:T.blue },
    Villa:         { bg:'rgba(248,113,113,0.1)', border:'rgba(248,113,113,0.3)', text:T.red },
    'Exclusive-Use':{ bg:'rgba(180,100,250,0.1)', border:'rgba(180,100,250,0.3)', text:'#b46afa' },
  };

  if (loading) return <div style={{ padding:'40px 0', textAlign:'center', color:T.textDim }}>Loading rooms…</div>;

  return (
    <div className="fade-in">
      {rooms.length === 0 ? (
        <Card>
          <EmptyState icon="🛏" title="No room types loaded" sub="Room types are added from the rate card. Once added, you can assign images and reels to each room here." />
        </Card>
      ) : (
        <>
          <div style={{ fontSize:12, color:T.textDim, marginBottom:16, lineHeight:1.6, padding:'12px 16px', background:T.surface, borderRadius:10, border:`0.5px solid ${T.border}` }}>
            ℹ Each room type can have its own image gallery, reel, and YouTube clip. These appear in the room swipe stack when travellers personalise their booking. Assign specific images to rooms using the Gallery tab and setting the room type field on each image.
          </div>
          {rooms.map(room => {
            const isExpanded = expandedRoom === room.id;
            const cat = CATEGORY_COLOURS[room.category] ?? CATEGORY_COLOURS.Standard;
            return (
              <Card key={room.id} style={{ border:`0.5px solid ${isExpanded ? T.borderGold : T.border}` }}>
                {/* Room header */}
                <div onClick={()=>setExpandedRoom(isExpanded ? null : room.id)} style={{ display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
                  {/* Primary image thumb */}
                  <div style={{ width:72, height:52, borderRadius:8, overflow:'hidden', background:'#1a1a1a', flexShrink:0 }}>
                    {(room.images||[]).find(i=>i.is_primary)?.url
                      ? <img src={(room.images||[]).find(i=>i.is_primary)?.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🛏</div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Playfair Display',serif" }}>{room.name}</div>
                      {room.category && (
                        <span style={{ fontSize:9, background:cat.bg, border:`0.5px solid ${cat.border}`, color:cat.text, borderRadius:20, padding:'2px 8px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{room.category}</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:T.textDim }}>
                      Max {room.max_occupancy} adults · {room.max_children > 0 ? `${room.max_children} child${room.max_children>1?'ren':''}` : 'No children'} · {room.bed_type||'—'} · {room.view||'—'}
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:4 }}>
                      <span style={{ fontSize:10, color:(room.images||[]).length>0?T.green:T.textDim }}>{(room.images||[]).length} image{(room.images||[]).length!==1?'s':''}</span>
                      <span style={{ fontSize:10, color:(room.reels||[]).length>0?T.gold:T.textDim }}>{(room.reels||[]).length} reel{(room.reels||[]).length!==1?'s':''}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {saving===room.id && <div className="saving" style={{ fontSize:11, color:T.gold }}>Saving…</div>}
                    <div style={{ fontSize:13, color:T.textDim }}>{isExpanded?'▲':'▼'}</div>
                  </div>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div style={{ marginTop:18, borderTop:`0.5px solid ${T.border}`, paddingTop:18 }}>
                    {/* Description (read-only — edited in rate card) */}
                    {room.description && (
                      <div style={{ fontSize:12, color:T.textDim, lineHeight:1.7, marginBottom:16, padding:'10px 14px', background:T.bg3, borderRadius:8, border:`0.5px solid ${T.border}` }}>
                        {room.description}
                      </div>
                    )}

                    {/* Images for this room */}
                    <div style={{ marginBottom:16 }}>
                      <Label>Room images</Label>
                      <div style={{ fontSize:11, color:T.textDim, marginBottom:10 }}>Images assigned to this room appear in the room swipe stack. You can also tag images from the Gallery tab with this room name.</div>
                      {(room.images||[]).length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                          {(room.images||[]).map((img,i) => (
                            <MediaThumb
                              key={i}
                              url={img.url}
                              isPrimary={img.is_primary}
                              onSetPrimary={()=>updateRoom(room.id,{ images:(room.images||[]).map((m,j)=>({...m,is_primary:j===i})) })}
                              onRemove={()=>updateRoom(room.id,{ images:(room.images||[]).filter((_,j)=>j!==i) })}
                            />
                          ))}
                        </div>
                      )}
                      <DropZone compact onFiles={files=>handleRoomFiles(room, files)} />
                    </div>

                    {/* YouTube reel for this room */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <Label>Room reel</Label>
                        <Btn variant="gold" onClick={()=>setYtRoom(room)} style={{ padding:'5px 12px', fontSize:11 }}>🎬 Add / edit YouTube clip</Btn>
                      </div>
                      {(room.reels||[]).length > 0 ? (
                        (room.reels||[]).map((reel,ri) => (
                          <div key={ri} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 10px', background:T.bg3, border:`0.5px solid ${T.border}`, borderRadius:8, marginBottom:6 }}>
                            {reel.thumbnail && <img src={reel.thumbnail} alt="" style={{ width:60, height:40, borderRadius:5, objectFit:'cover', flexShrink:0 }} />}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{reel.caption||reel.video_id}</div>
                              <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{Math.round(reel.start)}s → {Math.round(reel.end)}s · {reel.speed}× · {Math.round(reel.end-reel.start)}s</div>
                            </div>
                            <Btn variant="danger" style={{ padding:'4px 10px', fontSize:10 }} onClick={()=>updateRoom(room.id,{ reels:(room.reels||[]).filter((_,j)=>j!==ri) })}>Remove</Btn>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize:11, color:T.textDim, padding:'10px 0' }}>No reel yet — click above to add a YouTube clip for this room.</div>
                      )}
                    </div>

                    <Btn variant="gold" onClick={()=>saveRoom(room)} disabled={saving===room.id} style={{ width:'100%', padding:'10px 0', textAlign:'center', justifyContent:'center' }}>
                      {saving===room.id ? 'Saving…' : 'Save room media →'}
                    </Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}

      {/* YouTube popup for a specific room */}
      {ytRoom && (
        <YouTubePopup
          existing={(ytRoom.reels||[])[0] ?? null}
          onClose={()=>setYtRoom(null)}
          onSave={reel => {
            const existing = (ytRoom.reels||[])[0];
            if (existing) updateRoom(ytRoom.id, { reels: ytRoom.reels.map((r,i)=>i===0?reel:r) });
            else updateRoom(ytRoom.id, { reels: [...(ytRoom.reels||[]), reel] });
            setYtRoom(null);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ACTIVITIES  — per activity: image slider + reel + drag-drop upload
// Reads from activities table (edition_id + region_slug OR supplier-linked)
// ═══════════════════════════════════════════════════════════════════════════════
function TabActivities({ supplierId, supplier, isAdmin }) {
  const db = useMemo(() => createSupabase(), []);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [ytActivity, setYtActivity] = useState(null);
  const [slideIdxMap, setSlideIdxMap] = useState({});

  // Load activities for this supplier's region
  useEffect(() => {
    if (!db || !supplier) { setLoading(false); return; }
    const slug = supplier.region_slug ?? supplier.destination?.toLowerCase().replace(/\s+/g,'-');
    if (!slug) { setLoading(false); return; }
    db.fetchMany('activities', `region_slug=eq.${slug}&order=sort_order&select=*`)
      .then(rows => setActivities(rows.map(r => ({
        ...r,
        image_urls: Array.isArray(r.image_urls) ? r.image_urls : (r.image_urls ? JSON.parse(r.image_urls) : []),
        reels:      Array.isArray(r.reels)      ? r.reels      : (r.reels      ? JSON.parse(r.reels)      : []),
      }))))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [supplier]);

  const updateActivity = (id, patch) => setActivities(p => p.map(a => a.id===id ? { ...a, ...patch } : a));

  const saveActivity = async (act) => {
    if (!db) return;
    setSaving(act.id);
    try {
      await db.patch('activities', `id=eq.${act.id}`, { image_urls: act.image_urls, reels: act.reels });
    } catch(e) { alert('Save failed: ' + e.message); }
    finally { setSaving(null); }
  };

  const addImageUrl = (act, url) => {
    updateActivity(act.id, { image_urls: [...(act.image_urls||[]), { url, caption:'' }] });
  };

  const removeImageUrl = (act, idx) => {
    updateActivity(act.id, { image_urls: (act.image_urls||[]).filter((_,i)=>i!==idx) });
  };

  const setSlideIdx = (id, idx) => setSlideIdxMap(p => ({ ...p, [id]: idx }));

  const handleActivityFiles = async (act, files) => {
    for (const file of files) {
      try {
        await db.uploadFile(supplierId, file, isAdmin);
        const url = URL.createObjectURL(file);
        addImageUrl(act, url);
      } catch {}
    }
  };

  const CATEGORY_ICON = { wildlife:'🦁', transfer:'✈', dining:'🍽', wellness:'🌿', adventure:'🏔', culture:'🏛', water:'🌊' };

  if (loading) return <div style={{ padding:'40px 0', textAlign:'center', color:T.textDim }}>Loading activities…</div>;

  return (
    <div className="fade-in">
      {activities.length === 0 ? (
        <Card>
          <EmptyState icon="🎯" title="No activities in this region" sub={`Activities are linked by region slug (${supplier?.region_slug ?? supplier?.destination ?? 'unknown'}). Add activities in the Activities table with the matching region_slug.`} />
        </Card>
      ) : (
        <>
          <div style={{ fontSize:12, color:T.textDim, marginBottom:16, padding:'12px 16px', background:T.surface, borderRadius:10, border:`0.5px solid ${T.border}`, lineHeight:1.6 }}>
            {activities.length} activities in this region. Assign images and reels to each activity — these appear as swipeable add-ons in the booking flow.
          </div>
          {activities.map(act => {
            const isExp = expanded === act.id;
            const slideIdx = slideIdxMap[act.id] ?? 0;
            const images = act.image_urls || [];
            const currentImg = images[slideIdx];
            const icon = CATEGORY_ICON[act.category] ?? '🎯';
            return (
              <Card key={act.id} style={{ border:`0.5px solid ${isExp ? T.borderGold : T.border}` }}>
                <div onClick={()=>setExpanded(isExp ? null : act.id)} style={{ display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
                  {/* Image slider thumbnail */}
                  <div style={{ width:80, height:56, borderRadius:8, overflow:'hidden', background:'#1a1a1a', flexShrink:0, position:'relative' }}>
                    {currentImg?.url
                      ? <img src={currentImg.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{icon}</div>}
                    {/* Mini slider arrows */}
                    {images.length > 1 && (
                      <>
                        {slideIdx > 0 && <div onClick={e=>{e.stopPropagation();setSlideIdx(act.id,slideIdx-1);}} style={{ position:'absolute', left:2, top:'50%', transform:'translateY(-50%)', width:16, height:16, borderRadius:'50%', background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', cursor:'pointer' }}>‹</div>}
                        {slideIdx < images.length-1 && <div onClick={e=>{e.stopPropagation();setSlideIdx(act.id,slideIdx+1);}} style={{ position:'absolute', right:2, top:'50%', transform:'translateY(-50%)', width:16, height:16, borderRadius:'50%', background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', cursor:'pointer' }}>›</div>}
                        <div style={{ position:'absolute', bottom:3, left:0, right:0, display:'flex', justifyContent:'center', gap:2 }}>
                          {images.map((_,i) => <div key={i} style={{ width:i===slideIdx?8:3, height:3, borderRadius:2, background:i===slideIdx?T.gold:'rgba(255,255,255,0.4)', transition:'all 0.15s' }} />)}
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Playfair Display',serif" }}>{act.name}</div>
                      {act.category && <span style={{ fontSize:9, color:T.textDim, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'1px 7px' }}>{act.category}</span>}
                    </div>
                    {act.description && <div style={{ fontSize:11, color:T.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{act.description}</div>}
                    <div style={{ display:'flex', gap:10, marginTop:4 }}>
                      <span style={{ fontSize:10, color:images.length>0?T.green:T.textDim }}>{images.length} image{images.length!==1?'s':''}</span>
                      <span style={{ fontSize:10, color:(act.reels||[]).length>0?T.gold:T.textDim }}>{(act.reels||[]).length} reel{(act.reels||[]).length!==1?'s':''}</span>
                      {act.duration && <span style={{ fontSize:10, color:T.textDim }}>⏱ {act.duration}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:13, color:T.textDim }}>{isExp?'▲':'▼'}</div>
                </div>

                {/* Expanded editor */}
                {isExp && (
                  <div style={{ marginTop:18, borderTop:`0.5px solid ${T.border}`, paddingTop:18 }}>

                    {/* Image slider (full-size in edit mode) */}
                    <div style={{ marginBottom:16 }}>
                      <Label>Activity images ({images.length})</Label>
                      <div style={{ fontSize:11, color:T.textDim, marginBottom:10 }}>Add multiple images — travellers swipe through them in the activity card.</div>

                      {/* Full image slider */}
                      {images.length > 0 && (
                        <div style={{ position:'relative', height:180, borderRadius:10, overflow:'hidden', background:'#111', marginBottom:10 }}>
                          <img src={images[slideIdx]?.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 50%)' }} />
                          {/* Arrows */}
                          {slideIdx > 0 && <div onClick={()=>setSlideIdx(act.id,slideIdx-1)} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff', cursor:'pointer' }}>‹</div>}
                          {slideIdx < images.length-1 && <div onClick={()=>setSlideIdx(act.id,slideIdx+1)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'#fff', cursor:'pointer' }}>›</div>}
                          {/* Dots */}
                          <div style={{ position:'absolute', bottom:10, left:0, right:0, display:'flex', justifyContent:'center', gap:5 }}>
                            {images.map((_,i) => <div key={i} onClick={()=>setSlideIdx(act.id,i)} style={{ width:i===slideIdx?16:5, height:5, borderRadius:3, background:i===slideIdx?T.gold:'rgba(255,255,255,0.4)', cursor:'pointer', transition:'all 0.2s' }} />)}
                          </div>
                          {/* Caption */}
                          {images[slideIdx]?.caption && <div style={{ position:'absolute', bottom:28, left:12, fontSize:11, color:'rgba(255,255,255,0.7)', background:'rgba(0,0,0,0.4)', borderRadius:4, padding:'2px 8px' }}>{images[slideIdx].caption}</div>}
                          {/* Remove current */}
                          <div onClick={()=>removeImageUrl(act,slideIdx)} style={{ position:'absolute', top:8, right:8, width:24, height:24, borderRadius:'50%', background:'rgba(248,113,113,0.8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#fff', cursor:'pointer' }}>×</div>
                        </div>
                      )}

                      {/* Thumbnail strip */}
                      {images.length > 1 && (
                        <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:10, paddingBottom:4 }}>
                          {images.map((img,i) => (
                            <div key={i} onClick={()=>setSlideIdx(act.id,i)} style={{ width:60, height:42, borderRadius:6, overflow:'hidden', flexShrink:0, border:`1.5px solid ${i===slideIdx?T.gold:T.border}`, cursor:'pointer' }}>
                              <img src={img.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            </div>
                          ))}
                        </div>
                      )}

                      <DropZone compact onFiles={files=>handleActivityFiles(act,files)} />
                    </div>

                    {/* YouTube reel */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <Label>Activity reel</Label>
                        <Btn variant="gold" onClick={()=>setYtActivity(act)} style={{ padding:'5px 12px', fontSize:11 }}>🎬 Add / edit YouTube clip</Btn>
                      </div>
                      {(act.reels||[]).length > 0 ? (
                        (act.reels||[]).map((reel,ri) => (
                          <div key={ri} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 10px', background:T.bg3, border:`0.5px solid ${T.border}`, borderRadius:8, marginBottom:6 }}>
                            {reel.thumbnail && <img src={reel.thumbnail} alt="" style={{ width:60, height:40, borderRadius:5, objectFit:'cover', flexShrink:0 }} />}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, color:T.text }}>{reel.caption||reel.video_id}</div>
                              <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{Math.round(reel.start)}s → {Math.round(reel.end)}s · {reel.speed}×</div>
                            </div>
                            <Btn variant="danger" style={{ padding:'4px 10px', fontSize:10 }} onClick={()=>updateActivity(act.id,{ reels:(act.reels||[]).filter((_,j)=>j!==ri) })}>Remove</Btn>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize:11, color:T.textDim, padding:'8px 0' }}>No reel — add a YouTube clip above.</div>
                      )}
                    </div>

                    <Btn variant="gold" onClick={()=>saveActivity(act)} disabled={saving===act.id} style={{ width:'100%', padding:'10px 0', textAlign:'center', justifyContent:'center' }}>
                      {saving===act.id ? 'Saving…' : 'Save activity media →'}
                    </Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}

      {/* YouTube popup for activity */}
      {ytActivity && (
        <YouTubePopup
          existing={(ytActivity.reels||[])[0] ?? null}
          onClose={()=>setYtActivity(null)}
          onSave={reel => {
            const existing = (ytActivity.reels||[])[0];
            if (existing) updateActivity(ytActivity.id, { reels: ytActivity.reels.map((r,i)=>i===0?reel:r) });
            else updateActivity(ytActivity.id, { reels: [...(ytActivity.reels||[]), reel] });
            setYtActivity(null);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE PREVIEW PANEL (right panel — unchanged from v1)
// ═══════════════════════════════════════════════════════════════════════════════
function buildSlides(supplier, images, heroType, reels) {
  const ht = heroType ?? supplier?.hero_type ?? 'image';
  const firstReel = (reels ?? []).find(r => r.source==='youtube' && r.video_id);
  const reelSrc = firstReel
    ? `https://www.youtube.com/embed/${firstReel.video_id}?start=${Math.round(firstReel.start)}&end=${Math.round(firstReel.end)}&autoplay=1&mute=1&loop=1&playlist=${firstReel.video_id}&controls=0`
    : supplier?.reel_url ?? null;
  const heroUrl = supplier?._primaryUrl ?? supplier?.image ?? null;
  const slides = [];
  if ((ht==='reel') && reelSrc) { slides.push({ type:'reel', url:reelSrc, poster:heroUrl, label:'Hero Reel', display_order:0 }); if (heroUrl) slides.push({ type:'image', url:heroUrl, label:'Hero Image', display_order:1 }); }
  else { if (heroUrl) slides.push({ type:'image', url:heroUrl, label:'Hero Image', display_order:0 }); if (reelSrc) slides.push({ type:'reel', url:reelSrc, poster:heroUrl, label:'Reel', display_order:1 }); }
  const extras = (images ?? []).filter(img => img.status==='approved' && img.url && img.url!==heroUrl).sort((a,b)=>(a.display_order??99)-(b.display_order??99));
  extras.forEach(img => { if (!slides.find(s=>s.url===img.url)) slides.push({ ...img, type:'image' }); });
  const seen = new Set();
  return slides.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });
}

function PreviewPanel({ supplier, slides, activeSlideIdx, onSlideChange }) {
  const [tab, setTab] = useState('small');
  const slide = slides[activeSlideIdx] ?? slides[0];
  const name = supplier?.name ?? 'Property Name';
  const destination = supplier?.destination ?? '';
  const trust = supplier?.trust_score ?? 85;
  const rate = Math.round((supplier?.net_rate_per_night ?? 25000) * 1.15);

  return (
    <div style={{ position:'sticky', top:74 }}>
      <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700, marginBottom:12 }}>Live preview</div>
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[{id:'small',label:'◻ Small'},{id:'big',label:'◼ Big'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:'8px 0', borderRadius:9, border:`1.5px solid ${tab===t.id?T.gold:T.border}`, background:tab===t.id?T.goldDim:'transparent', color:tab===t.id?T.gold:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:tab===t.id?600:400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Small tile */}
      {tab==='small' && (
        <div style={{ width:'100%', maxWidth:340, borderRadius:14, overflow:'hidden', border:`1.5px solid ${T.gold}`, background:T.surface }}>
          <div style={{ position:'relative', height:190, overflow:'hidden', background:'#111' }}>
            {slide ? (slide.type==='reel'||slide.type==='video' ? <video src={slide.url} poster={slide.poster} autoPlay muted loop playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <img src={slide.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />) : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:T.textDim, fontSize:12 }}>No image</div>}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,transparent 50%)' }} />
            {activeSlideIdx>0&&<button onClick={()=>onSlideChange(activeSlideIdx-1)} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>‹</button>}
            {activeSlideIdx<slides.length-1&&<button onClick={()=>onSlideChange(activeSlideIdx+1)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(255,255,255,0.2)', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>›</button>}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'10px 12px 10px' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:"'Playfair Display',serif", lineHeight:1.2 }}>{name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{destination} · ★ {trust}/100</div>
            </div>
          </div>
          <div style={{ padding:'10px 12px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ padding:'8px 0', borderRadius:8, border:`1.5px solid ${T.gold}`, background:T.goldDim, color:T.gold, fontSize:11, fontWeight:700, textAlign:'center' }}>✓ Selected</div>
              <div style={{ padding:'8px 0', borderRadius:8, border:`1px solid ${T.borderGold}`, color:T.gold, fontSize:11, textAlign:'center' }}>Personalise</div>
            </div>
          </div>
        </div>
      )}

      {/* Big tile */}
      {tab==='big' && (
        <div style={{ width:'100%', maxWidth:420, borderRadius:'14px 14px 0 0', background:'#0f0f0f', border:`0.5px solid ${T.border}`, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px 10px', borderBottom:`0.5px solid rgba(255,255,255,0.08)` }}>
            <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:3 }}>✦ Upgrade & Personalise</div>
            <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'Playfair Display',serif" }}>{name}</div>
            <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{destination}</div>
            <div style={{ fontSize:17, fontWeight:700, color:T.gold, fontFamily:"'Playfair Display',serif", marginTop:8 }}>R {rate.toLocaleString()}<span style={{ fontSize:10, color:T.textDim, fontWeight:400 }}>/night</span></div>
          </div>
          <div style={{ position:'relative', height:180, overflow:'hidden', background:'#111' }}>
            {slide ? <img src={slide.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:T.textDim }}>No image</div>}
            {slides.length>1&&<div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex', justifyContent:'center', gap:4 }}>{slides.map((_,i)=><div key={i} onClick={()=>onSlideChange(i)} style={{ width:i===activeSlideIdx?12:4, height:4, borderRadius:2, background:i===activeSlideIdx?T.gold:'rgba(255,255,255,0.35)', cursor:'pointer', transition:'all 0.2s' }} />)}</div>}
          </div>
          <div style={{ padding:'12px 16px', fontSize:11, color:T.textDim, textAlign:'center' }}>ROOM TYPES ↓</div>
        </div>
      )}

      {slides.length>0 && <div style={{ marginTop:8, textAlign:'center', fontSize:11, color:T.textDim }}>Slide {activeSlideIdx+1} of {slides.length} · {slides[activeSlideIdx]?.type??''}</div>}

      <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:10 }}>
        <div style={{ fontSize:11, color:T.gold, fontWeight:600, marginBottom:4 }}>✦ What travellers see</div>
        <div style={{ fontSize:11, color:T.textDim, lineHeight:1.6 }}>Changes only go live after you tap <strong style={{ color:T.text }}>Save changes</strong> in the nav bar.</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:'overview',    label:'Overview',    icon:'◈' },
  { id:'gallery',     label:'Gallery',     icon:'📷' },
  { id:'reels',       label:'Reels',       icon:'▶' },
  { id:'rooms',       label:'Rooms',       icon:'🛏' },
  { id:'activities',  label:'Activities',  icon:'🎯' },
];

export default function ContentCMS({ supplierId, isAdmin = false }) {
  const [supplier,     setSupplier]     = useState(null);
  const [images,       setImages]       = useState([]);
  const [reels,        setReels]        = useState([]);
  const [heroType,     setHeroType]     = useState('image');
  const [locked,       setLocked]       = useState(false);
  const [tab,          setTab]          = useState('overview');
  const [previewSlide, setPreviewSlide] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState('');

  const db = useMemo(() => createSupabase(), []);

  // Load supplier
  useEffect(() => {
    if (!supplierId || !db) { setLoading(false); return; }
    setLoading(true);
    db.fetch1('suppliers', `id=eq.${supplierId}&select=*`)
      .then(row => {
        if (!row) { setError('Supplier not found'); return; }
        setSupplier(row);
        setHeroType(row.hero_type ?? 'image');
        setLocked(row.media_order_locked ?? false);
        let imgs = [];
        try { imgs = Array.isArray(row.images) ? row.images : (row.images ? JSON.parse(row.images) : []); } catch {}
        const primary = imgs.find(i=>i.is_primary&&i.status==='approved') ?? imgs.find(i=>i.status==='approved') ?? imgs[0];
        row._primaryUrl = primary?.url ?? null;
        setImages(imgs.map((img,i) => ({ ...img, display_order: img.display_order ?? i+1 })).sort((a,b)=>a.display_order-b.display_order));
        let rls = [];
        try { rls = Array.isArray(row.reels) ? row.reels : (row.reels ? JSON.parse(row.reels) : []); } catch {}
        setReels(rls);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [supplierId]);

  const slides = buildSlides(supplier, images, heroType, reels);

  const handleSave = async () => {
    if (!db || !supplierId) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await db.patch('suppliers', `id=eq.${supplierId}`, {
        images, reels, hero_type: heroType,
        ...(isAdmin ? { media_order_locked: locked } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch(e) { setError(`Save failed: ${e.message}`); }
    finally { setSaving(false); }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ minHeight:'100vh', background:T.bg, paddingBottom:80 }}>

        {/* NAV BAR */}
        <div style={{ position:'sticky', top:0, zIndex:50, background:'rgba(10,10,10,0.97)', backdropFilter:'blur(16px)', borderBottom:`0.5px solid ${T.border}`, padding:'0 24px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.gold, letterSpacing:'0.05em' }}>✦ The Travel Catalogue</div>
            <div style={{ color:T.textDim, fontSize:13 }}>›</div>
            <div style={{ fontSize:13, color:T.textMid }}>Media Manager</div>
            {supplier?.name && <><div style={{ color:T.textDim, fontSize:13 }}>›</div><div style={{ fontSize:13, color:T.text, fontWeight:600 }}>{supplier.name}</div></>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {saved   && <div style={{ fontSize:12, color:T.green }}>✓ Saved</div>}
            {saving  && <div className="saving" style={{ fontSize:12, color:T.gold }}>Saving…</div>}
            {error   && <div style={{ fontSize:12, color:T.red, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{error}</div>}
            <button onClick={handleSave} disabled={saving||loading}
              style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', color:'#0a0a0a', borderRadius:9, padding:'8px 20px', fontSize:13, fontWeight:700, cursor:saving||loading?'not-allowed':'pointer', fontFamily:'inherit', opacity:saving||loading?0.6:1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:16 }}>
            <div style={{ width:36, height:36, border:`2px solid ${T.border}`, borderTopColor:T.gold, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            <div style={{ fontSize:13, color:T.textDim }}>Loading supplier media…</div>
          </div>
        ) : (
          <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>

            {/* TAB BAR */}
            <div style={{ display:'flex', gap:2, borderBottom:`0.5px solid ${T.border}`, marginBottom:24, paddingTop:20 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px', background:'transparent', border:'none', borderBottom:`2px solid ${tab===t.id?T.gold:'transparent'}`, color:tab===t.id?T.gold:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:tab===t.id?600:400, transition:'all 0.15s', marginBottom:-1 }}>
                  <span style={{ fontSize:14 }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>

            {/* CONTENT GRID */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:32, alignItems:'start' }}>

              {/* LEFT — active tab content */}
              <div>
                {tab==='overview' && <TabOverview supplier={supplier} images={images} reels={reels} heroType={heroType} setHeroType={setHeroType} locked={locked} setLocked={setLocked} isAdmin={isAdmin} slides={slides} previewSlide={previewSlide} setPreviewSlide={setPreviewSlide} />}
                {tab==='gallery'  && <TabGallery  supplierId={supplierId} isAdmin={isAdmin} images={images} setImages={setImages} locked={locked} />}
                {tab==='reels'    && <TabReels    reels={reels} setReels={setReels} />}
                {tab==='rooms'    && <TabRooms    supplierId={supplierId} isAdmin={isAdmin} />}
                {tab==='activities' && <TabActivities supplierId={supplierId} supplier={supplier} isAdmin={isAdmin} />}
              </div>

              {/* RIGHT — live preview (always visible) */}
              <PreviewPanel supplier={supplier} slides={slides} activeSlideIdx={previewSlide} onSlideChange={setPreviewSlide} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
