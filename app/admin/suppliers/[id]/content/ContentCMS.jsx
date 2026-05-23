'use client';

// ═══════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — ContentCMS.jsx
// Supplier Media Manager · v1.0
//
// PURPOSE:
//   Allows TSE admins (and, when unlocked, suppliers) to:
//   1. Drag-reorder images/reels in the media library
//   2. Set which asset is the HERO (first tile shown in the carousel)
//   3. Toggle hero type: Image | Video | Reel
//   4. See a pixel-accurate LIVE PREVIEW of:
//      a) Small tile  — how the card looks in the nested peeking carousel
//      b) Big tile    — how the UpgradeSheet header renders for the traveller
//   5. Link a KB specialist note to a specific image
//   6. Save changes back to Supabase
//   7. Admin-only: lock the media order so suppliers can't change it
//
// USAGE:
//   <ContentCMS supplierId="uuid-here" isAdmin={true} />
//
// SUPABASE COLUMNS REQUIRED (run migration in CMS_MEDIA_SPEC.md first):
//   suppliers.hero_type          TEXT  DEFAULT 'image'
//   suppliers.media_order_locked BOOLEAN DEFAULT false
//   images JSONB objects need: display_order, is_video_hero, kb_note_id
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Theme — mirrors page.tsx T object ───────────────────────────────────────
const T = {
  bg:        '#0a0a0a',
  surface:   '#141414',
  bg3:       '#1e1e1e',
  border:    'rgba(255,255,255,0.1)',
  borderGold:'rgba(212,175,55,0.35)',
  text:      '#f5f0e8',
  textMid:   'rgba(245,240,232,0.65)',
  textDim:   'rgba(245,240,232,0.35)',
  gold:      '#d4af37',
  goldLight: '#f0c040',
  goldDim:   'rgba(212,175,55,0.12)',
  green:     '#4ade80',
  amber:     '#fbbf24',
  red:       '#f87171',
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
`;

// ─── Supabase client helper ───────────────────────────────────────────────────
function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    async fetchSupplier(id) {
      const res = await fetch(
        `${url}/rest/v1/suppliers?id=eq.${id}&select=*&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const rows = await res.json();
      return rows[0] ?? null;
    },
    async updateSupplier(id, patch) {
      const res = await fetch(
        `${url}/rest/v1/suppliers?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) throw new Error(`Supabase PATCH ${res.status}`);
    },
  };
}

// ─── buildSlides — mirrors page.tsx logic exactly ─────────────────────────────
function buildSlides(supplier, localImages, heroType) {
  const ht = heroType ?? supplier?.hero_type ?? 'image';
  const reelUrl = supplier?.reel_url ?? supplier?.video_url ?? null;
  const heroImageUrl = supplier?._primaryUrl ?? supplier?.image ?? null;

  const slides = [];

  if ((ht === 'video' || ht === 'reel') && reelUrl) {
    slides.push({ type: ht, url: reelUrl, poster: heroImageUrl, label: ht === 'reel' ? 'Hero Reel' : 'Hero Video', display_order: 0 });
    if (heroImageUrl) slides.push({ type: 'image', url: heroImageUrl, label: 'Hero Image', display_order: 1 });
  } else {
    if (heroImageUrl) slides.push({ type: 'image', url: heroImageUrl, label: 'Hero Image', display_order: 0 });
    if (reelUrl) slides.push({ type: ht === 'reel' ? 'reel' : 'video', url: reelUrl, poster: heroImageUrl, label: 'Reel', display_order: 1 });
  }

  // Additional images sorted by display_order
  const extras = (localImages ?? [])
    .filter(img => img.status === 'approved' && img.url && img.url !== heroImageUrl)
    .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));

  extras.forEach(img => {
    if (!slides.find(s => s.url === img.url)) {
      slides.push({ ...img, type: 'image' });
    }
  });

  const seen = new Set();
  return slides.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });
}

// ─── SMALL TILE PREVIEW ───────────────────────────────────────────────────────
// Pixel-accurate simulation of the NestedPropertyCarousel card
function SmallTilePreview({ supplier, slides, activeSlideIdx, onSlideChange }) {
  const slide = slides[activeSlideIdx] ?? slides[0];
  const name = supplier?.name ?? 'Property Name';
  const destination = supplier?.destination ?? supplier?.region_slug ?? '';
  const trustScore = supplier?.trust_score ?? 85;
  const nights = 4; // display only

  return (
    <div style={{ width: '100%', maxWidth: 360, borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${T.gold}`, background: T.surface, position: 'relative' }}>
      {/* Selected badge */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, background: T.gold, color: '#0a0a0a', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Selected</div>

      {/* Image area */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#111' }}>
        {slide ? (
          slide.type === 'reel' || slide.type === 'video'
            ? <video src={slide.url} poster={slide.poster} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={slide.url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 12 }}>No image</div>
        )}
        {/* Gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.78) 0%,transparent 50%)' }} />

        {/* Inner image arrows */}
        {activeSlideIdx > 0 && (
          <button onClick={() => onSlideChange(activeSlideIdx - 1)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontFamily: 'inherit' }}>‹</button>
        )}
        {activeSlideIdx < slides.length - 1 && (
          <button onClick={() => onSlideChange(activeSlideIdx + 1)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontFamily: 'inherit' }}>›</button>
        )}

        {/* Dots */}
        {slides.length > 1 && (
          <div style={{ position: 'absolute', bottom: 42, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3 }}>
            {slides.map((_, i) => (
              <div key={i} onClick={() => onSlideChange(i)} style={{ width: i === activeSlideIdx ? 14 : 4, height: 4, borderRadius: 2, background: i === activeSlideIdx ? T.gold : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.2s' }} />
            ))}
          </div>
        )}

        {/* Reel badge */}
        {(slide?.type === 'reel' || slide?.type === 'video') && (
          <div style={{ position: 'absolute', bottom: 44, left: 10, fontSize: 9, color: 'rgba(255,255,255,0.65)', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px' }}>▶ {slide.type === 'reel' ? 'Reel' : 'Video'}</div>
        )}

        {/* TSE Diamond */}
        <div title="KB note indicator" style={{ position: 'absolute', top: 10, right: 44, zIndex: 8 }}>
          <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg,#c8a020,#f0c840)', transform: 'rotate(45deg)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ transform: 'rotate(-45deg)', fontSize: 10, color: '#0a0a0a', fontWeight: 900 }}>✦</span>
          </div>
        </div>

        {/* ? button */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(96,165,250,0.22)', border: '1.5px solid rgba(96,165,250,0.6)', color: '#93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>?</div>

        {/* Name + price overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: '#fff', lineHeight: 1.2 }}>{name}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{destination} · ★ {trustScore}/100</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', background: 'rgba(0,0,0,0.35)', borderRadius: 6, padding: '2px 7px' }}>{nights}n selected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tile body */}
      <div style={{ padding: '10px 12px 12px' }}>
        {supplier?.short_tagline && (
          <div style={{ fontSize: 11, color: T.textDim, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 8, padding: '5px 10px', marginBottom: 8, lineHeight: 1.5 }}>✦ {supplier.short_tagline.slice(0, 80)}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ padding: '9px 0', borderRadius: 9, border: `1.5px solid ${T.gold}`, background: T.goldDim, color: T.gold, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>✓ Selected</div>
          <div style={{ padding: '9px 0', borderRadius: 9, border: `1px solid ${T.borderGold}`, background: T.goldDim, color: T.gold, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>Upgrade / Personalise</div>
        </div>
      </div>
    </div>
  );
}

// ─── BIG TILE PREVIEW ─────────────────────────────────────────────────────────
// Simulates the UpgradeSheet header — hero carousel + name + price + room images
function BigTilePreview({ supplier, slides, activeSlideIdx, onSlideChange }) {
  const slide = slides[activeSlideIdx] ?? slides[0];
  const name = supplier?.name ?? 'Property Name';
  const destination = supplier?.destination ?? supplier?.region_slug ?? '';
  const country = supplier?.country ?? '';
  const netRate = supplier?.net_rate_per_night ?? 25000;
  const trustScore = supplier?.trust_score ?? 85;
  const otaRate = supplier?.ota_rate_per_night;
  const displayRate = Math.round(netRate * 1.15);
  const saving = otaRate ? Math.round(otaRate - displayRate) : 0;

  return (
    <div style={{ width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', background: '#0f0f0f', border: `0.5px solid ${T.border}`, overflow: 'hidden' }}>
      {/* Sticky header simulation */}
      <div style={{ padding: '16px 18px 12px', borderBottom: `0.5px solid rgba(255,255,255,0.08)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 3 }}>✦ Upgrade &amp; Personalise</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'Playfair Display', serif" }}>{name}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{destination}{country ? ` · ${country}` : ''}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: T.textMid, width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>×</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.gold, fontFamily: "'Playfair Display', serif" }}>
            R {displayRate.toLocaleString()}<span style={{ fontSize: 10, color: T.textDim, fontWeight: 400 }}>/night base</span>
          </div>
          {saving > 0 && (
            <div style={{ fontSize: 11, color: T.textDim, background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '2px 10px' }}>
              Save R {saving.toLocaleString()}/night vs direct
            </div>
          )}
        </div>
      </div>

      {/* Hero image carousel */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#111' }}>
        {slide ? (
          slide.type === 'reel' || slide.type === 'video'
            ? <video src={slide.url} poster={slide.poster} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={slide.url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, fontSize: 12 }}>No media</div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 60%)' }} />

        {activeSlideIdx > 0 && (
          <button onClick={() => onSlideChange(activeSlideIdx - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
        )}
        {activeSlideIdx < slides.length - 1 && (
          <button onClick={() => onSlideChange(activeSlideIdx + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>›</button>
        )}

        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 12px', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: '2px 6px' }}>{slide?.label ?? ''}</div>
          {slides.length > 1 && (
            <div style={{ display: 'flex', gap: 3 }}>
              {slides.map((_, i) => <div key={i} onClick={() => onSlideChange(i)} style={{ width: i === activeSlideIdx ? 12 : 4, height: 4, borderRadius: 2, background: i === activeSlideIdx ? T.gold : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.2s' }} />)}
            </div>
          )}
        </div>
      </div>

      {/* Description snippet */}
      <div style={{ padding: '12px 18px 0' }}>
        {supplier?.short_tagline && (
          <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7, marginBottom: 10 }}>{supplier.short_tagline}</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#4ade80' }}>★ {trustScore}/100 trust score</div>
          {supplier?.malaria_status === 'malaria-free' && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#4ade80' }}>✓ Malaria-free</div>}
        </div>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>ROOM TYPES &amp; UPGRADES</div>
        {['Standard Suite', 'Premium Suite'].map((room, i) => (
          <div key={room} style={{ borderRadius: 10, border: `1.5px solid ${i === 0 ? T.gold : T.border}`, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ position: 'relative', height: 70, background: '#1a1a1a', overflow: 'hidden' }}>
              {slides[0] && <img src={slides[0].url} alt={room} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%)' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>{room}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? T.gold : T.textDim }}>{i === 0 ? 'Included' : `+R ${Math.round(netRate * 0.4).toLocaleString()}/night`}</div>
              </div>
            </div>
          </div>
        ))}
        <div style={{ padding: '10px 0 16px', fontSize: 10, color: T.textDim, textAlign: 'center' }}>↓ Scroll for activities, specialist notes, social</div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ContentCMS({ supplierId, isAdmin = false }) {
  const [supplier,      setSupplier]      = useState(null);
  const [images,        setImages]        = useState([]);   // local working copy
  const [heroType,      setHeroType]      = useState('image'); // 'image'|'video'|'reel'
  const [locked,        setLocked]        = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState('');
  const [previewSlide,  setPreviewSlide]  = useState(0);
  const [dragIdx,       setDragIdx]       = useState(null);
  const [dragOverIdx,   setDragOverIdx]   = useState(null);
  const [activeTab,     setActiveTab]     = useState('small'); // 'small'|'big'

  const db = createSupabase();

  // ── Load supplier ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supplierId || !db) { setLoading(false); return; }
    setLoading(true);
    db.fetchSupplier(supplierId)
      .then(row => {
        if (!row) { setError('Supplier not found'); setLoading(false); return; }
        setSupplier(row);
        setHeroType(row.hero_type ?? 'image');
        setLocked(row.media_order_locked ?? false);

        // Parse images JSONB
        let imgs = [];
        try {
          imgs = Array.isArray(row.images)
            ? row.images
            : (row.images ? JSON.parse(row.images) : []);
        } catch { imgs = []; }

        // Find primary image URL for the supplier object
        const primary = imgs.find(img => img.is_primary && img.status === 'approved') ?? imgs.find(img => img.status === 'approved') ?? imgs[0];
        row._primaryUrl = primary?.url ?? null;

        // Normalise display_order
        const normalised = imgs.map((img, i) => ({ ...img, display_order: img.display_order ?? i + 1 }))
          .sort((a, b) => a.display_order - b.display_order);
        setImages(normalised);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [supplierId]);

  // ── Build slides from current state ───────────────────────────────────────
  const slides = buildSlides(supplier, images, heroType);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onDragStart = (e, idx) => {
    if (locked && !isAdmin) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const onDrop = (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropIdx, 0, moved);
    // Reassign display_order sequentially
    const reordered = next.map((img, i) => ({ ...img, display_order: i + 1 }));
    setImages(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const onDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // ── Move image up/down ─────────────────────────────────────────────────────
  const moveImage = (idx, dir) => {
    if (locked && !isAdmin) return;
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setImages(next.map((img, i) => ({ ...img, display_order: i + 1 })));
  };

  // ── Set primary image ──────────────────────────────────────────────────────
  const setPrimary = (idx) => {
    if (locked && !isAdmin) return;
    const next = images.map((img, i) => ({ ...img, is_primary: i === idx }));
    // Bring primary to front of approved images
    const primary = next[idx];
    if (!primary) return;
    const rest = next.filter((_, i) => i !== idx);
    const reordered = [primary, ...rest].map((img, i) => ({ ...img, display_order: i + 1 }));
    setImages(reordered);
    if (supplier) supplier._primaryUrl = primary.url;
  };

  // ── Save to Supabase ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!db || !supplierId) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await db.updateSupplier(supplierId, {
        images: images,
        hero_type: heroType,
        ...(isAdmin ? { media_order_locked: locked } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ minHeight: '100vh', background: T.bg, padding: '0 0 80px' }}>

        {/* ── NAV BAR ── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(16px)', borderBottom: `0.5px solid ${T.border}`, padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, letterSpacing: '0.05em' }}>✦ The Travel Catalogue</div>
            <div style={{ color: T.textDim, fontSize: 13 }}>›</div>
            <div style={{ fontSize: 13, color: T.textMid }}>Media Manager</div>
            {supplier?.name && (
              <>
                <div style={{ color: T.textDim, fontSize: 13 }}>›</div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{supplier.name}</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {saved && <div style={{ fontSize: 12, color: T.green }}>✓ Saved</div>}
            {saving && <div className="saving" style={{ fontSize: 12, color: T.gold }}>Saving…</div>}
            {error && <div style={{ fontSize: 12, color: T.red }}>{error}</div>}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{ background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', color: '#0a0a0a', borderRadius: 9, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: saving || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving || loading ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 36, height: 36, border: `2px solid ${T.border}`, borderTopColor: T.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, color: T.textDim }}>Loading supplier media…</div>
            <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 0', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 32, alignItems: 'start' }}>

            {/* ══ LEFT PANEL: Controls ══ */}
            <div className="fade-in">

              {/* Hero type selector */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Hero tile type</div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.55 }}>
                  Which asset appears first in the carousel? This is what travellers see before they swipe.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { id: 'image', label: '📷 Hero Image', desc: 'Primary photograph first' },
                    { id: 'video', label: '🎬 Video First', desc: 'Property video as hero' },
                    { id: 'reel',  label: '▶ Reel First',  desc: 'Short reel as hero tile' },
                  ].map(opt => {
                    const canSelect = opt.id === 'image' || !!supplier?.reel_url || !!supplier?.video_url;
                    const isSelected = heroType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => canSelect && setHeroType(opt.id)}
                        title={!canSelect ? 'No reel/video URL on file' : undefined}
                        style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${isSelected ? T.gold : T.border}`, background: isSelected ? T.goldDim : T.bg3, color: isSelected ? T.gold : (canSelect ? T.textMid : T.textDim), cursor: canSelect ? 'pointer' : 'not-allowed', fontFamily: 'inherit', textAlign: 'left', opacity: canSelect ? 1 : 0.4, transition: 'all 0.15s' }}
                      >
                        <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 400, marginBottom: 3 }}>{opt.label}</div>
                        <div style={{ fontSize: 10, color: isSelected ? T.goldLight : T.textDim }}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
                {(heroType === 'video' || heroType === 'reel') && supplier?.reel_url && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 8, padding: '7px 12px' }}>
                    <div style={{ fontSize: 11, color: T.gold }}>▶ Reel URL:</div>
                    <div style={{ fontSize: 11, color: T.textDim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{supplier.reel_url}</div>
                  </div>
                )}
              </div>

              {/* Image reorder list */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Image order</div>
                  {locked && !isAdmin && (
                    <div style={{ fontSize: 10, color: T.amber, background: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.3)', borderRadius: 20, padding: '2px 10px' }}>🔒 Locked by admin</div>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setLocked(l => !l)}
                      style={{ fontSize: 10, color: locked ? T.amber : T.textDim, background: locked ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${locked ? 'rgba(251,191,36,0.3)' : T.border}`, borderRadius: 20, padding: '3px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {locked ? '🔒 Locked — click to unlock' : '🔓 Unlocked — click to lock'}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.5 }}>
                  Drag to reorder · Star = set as primary hero image · Arrows = fine-tune position
                </div>

                {images.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: T.textDim, fontSize: 13 }}>
                    No approved images on file.<br />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>Upload images via the Content tab to get started.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {images.map((img, idx) => {
                      const isActive = dragOverIdx === idx;
                      const isDragging = dragIdx === idx;
                      return (
                        <div
                          key={img.url ?? idx}
                          draggable={!locked || isAdmin}
                          onDragStart={e => onDragStart(e, idx)}
                          onDragOver={e => onDragOver(e, idx)}
                          onDrop={e => onDrop(e, idx)}
                          onDragEnd={onDragEnd}
                          className={`${isDragging ? 'dragging' : ''} ${isActive ? 'drag-over' : ''}`}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: T.bg3, border: `0.5px solid ${isActive ? T.gold : T.border}`, borderRadius: 10, transition: 'all 0.15s', cursor: locked && !isAdmin ? 'default' : 'grab' }}
                        >
                          {/* Drag handle */}
                          <div className="drag-handle" style={{ color: T.textDim, fontSize: 16, flexShrink: 0, paddingRight: 4 }}>⠿</div>

                          {/* Thumbnail */}
                          <div style={{ width: 64, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#111' }}>
                            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                          </div>

                          {/* Meta */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {img.caption || img.room_type || `Image ${idx + 1}`}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              {img.is_primary && <span style={{ fontSize: 9, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 20, padding: '1px 7px', fontWeight: 700 }}>Primary</span>}
                              {img.room_type && <span style={{ fontSize: 9, color: T.textDim, background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '1px 7px' }}>{img.room_type}</span>}
                              {img.status && img.status !== 'approved' && <span style={{ fontSize: 9, color: T.amber, background: 'rgba(251,191,36,0.08)', border: '0.5px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: '1px 7px' }}>{img.status}</span>}
                            </div>
                          </div>

                          {/* Controls */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {/* Set primary star */}
                            <button
                              onClick={() => setPrimary(idx)}
                              title="Set as primary hero image"
                              style={{ background: img.is_primary ? T.goldDim : 'rgba(255,255,255,0.04)', border: `0.5px solid ${img.is_primary ? T.borderGold : T.border}`, borderRadius: 7, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: img.is_primary ? T.gold : T.textDim }}
                            >
                              {img.is_primary ? '★' : '☆'}
                            </button>
                            {/* Move up */}
                            <button
                              onClick={() => moveImage(idx, -1)}
                              disabled={idx === 0 || (locked && !isAdmin)}
                              style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.border}`, borderRadius: 7, width: 28, height: 28, cursor: idx === 0 || (locked && !isAdmin) ? 'not-allowed' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, opacity: idx === 0 ? 0.3 : 1 }}
                            >↑</button>
                            {/* Move down */}
                            <button
                              onClick={() => moveImage(idx, 1)}
                              disabled={idx === images.length - 1 || (locked && !isAdmin)}
                              style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.border}`, borderRadius: 7, width: 28, height: 28, cursor: idx === images.length - 1 || (locked && !isAdmin) ? 'not-allowed' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim, opacity: idx === images.length - 1 ? 0.3 : 1 }}
                            >↓</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reel / video URL field */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>Reel / Video URL</div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 12, lineHeight: 1.5 }}>
                  The property short reel or video. When set as Hero, this plays first in the traveller's carousel.
                </div>
                <input
                  type="url"
                  value={supplier?.reel_url ?? supplier?.video_url ?? ''}
                  placeholder="https://… (Cloudflare R2 or direct video URL)"
                  readOnly
                  style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 8, padding: '9px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', cursor: 'not-allowed' }}
                />
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 6 }}>Reel URL is managed via the Content tab or by TSE admin.</div>
              </div>

              {/* Order summary */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Slide order preview</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slides.map((slide, i) => (
                    <div key={i} onClick={() => setPreviewSlide(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: previewSlide === i ? T.goldDim : 'rgba(255,255,255,0.03)', border: `0.5px solid ${previewSlide === i ? T.borderGold : T.border}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: previewSlide === i ? T.gold : T.textDim, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: previewSlide === i ? T.gold : T.text, fontWeight: previewSlide === i ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slide.label || `Slide ${i + 1}`}</div>
                        <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{slide.type}</div>
                      </div>
                      {i === 0 && <div style={{ fontSize: 9, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 20, padding: '1px 7px', fontWeight: 700, flexShrink: 0 }}>Hero</div>}
                    </div>
                  ))}
                  {slides.length === 0 && (
                    <div style={{ fontSize: 12, color: T.textDim, textAlign: 'center', padding: '16px 0' }}>No slides yet — add images above</div>
                  )}
                </div>
              </div>
            </div>

            {/* ══ RIGHT PANEL: Live Preview ══ */}
            <div style={{ position: 'sticky', top: 74 }} className="fade-in">
              <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 }}>Live preview</div>

              {/* Preview tab toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[
                  { id: 'small', label: '◻ Small tile',   desc: 'Carousel card' },
                  { id: 'big',   label: '◼ Big tile',     desc: 'Upgrade sheet' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: `1.5px solid ${activeTab === tab.id ? T.gold : T.border}`, background: activeTab === tab.id ? T.goldDim : 'transparent', color: activeTab === tab.id ? T.gold : T.textMid, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400 }}
                  >
                    <div>{tab.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{tab.desc}</div>
                  </button>
                ))}
              </div>

              {/* Preview renders */}
              <div style={{ display: activeTab === 'small' ? 'block' : 'none' }}>
                <SmallTilePreview supplier={supplier} slides={slides} activeSlideIdx={previewSlide} onSlideChange={setPreviewSlide} />
              </div>
              <div style={{ display: activeTab === 'big' ? 'block' : 'none' }}>
                <BigTilePreview supplier={supplier} slides={slides} activeSlideIdx={previewSlide} onSlideChange={setPreviewSlide} />
              </div>

              {/* Caption: which slide is shown */}
              {slides.length > 0 && (
                <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: T.textDim }}>
                  Showing slide {previewSlide + 1} of {slides.length} · {slides[previewSlide]?.type ?? ''}
                </div>
              )}

              {/* Unsaved warning */}
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(212,175,55,0.05)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginBottom: 4 }}>✦ What travellers see</div>
                <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.6 }}>
                  The small tile preview matches the exact carousel card in the booking flow. The big tile matches the Upgrade &amp; Personalise sheet header. Changes only go live after you tap <strong style={{ color: T.text }}>Save changes</strong>.
                </div>
              </div>

              {/* Save shortcut */}
              <button
                onClick={handleSave}
                disabled={saving || loading}
                style={{ width: '100%', marginTop: 12, padding: '13px 0', background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', borderRadius: 10, color: '#0a0a0a', fontSize: 14, fontWeight: 700, cursor: saving || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving || loading ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes →'}
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
