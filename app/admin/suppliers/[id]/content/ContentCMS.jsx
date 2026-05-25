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
function buildSlides(supplier, localImages, heroType, localReels) {
  const ht = heroType ?? supplier?.hero_type ?? 'image';
  // Use first saved reel if available, otherwise fall back to reel_url column
  const firstReel = (localReels ?? []).find(r => r.source === 'youtube' && r.video_id);
  const reelUrl = firstReel
    ? `https://www.youtube.com/embed/${firstReel.video_id}?start=${Math.round(firstReel.start)}&end=${Math.round(firstReel.end)}&autoplay=1&mute=1&loop=1&playlist=${firstReel.video_id}`
    : supplier?.reel_url ?? supplier?.video_url ?? null;
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

// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE EMBED POPUP
// Paste URL → player loads → set start point → end follows automatically
// at start + 15s. Drag end handle back to shorten clip.
// Speed selector. Preview. Save to Supabase reels column.
// ─────────────────────────────────────────────────────────────────────────────
function parseYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const CLIP_DURATION = 15; // seconds — end always starts at start + this
const MIN_CLIP = 5;

function YouTubePopup({ onSave, onClose, existing }) {
  const [url,      setUrl]      = useState(existing?.video_id ? `https://youtu.be/${existing.video_id}` : '');
  const [videoId,  setVideoId]  = useState(existing?.video_id ?? null);
  const [vidDur,   setVidDur]   = useState(120); // fallback; YouTube iframe API gives real value
  const [start,    setStart]    = useState(existing?.start ?? 0);
  const [end,      setEnd]      = useState(existing?.end   ?? CLIP_DURATION);
  const [speed,    setSpeed]    = useState(existing?.speed ?? 1);
  const [caption,  setCaption]  = useState(existing?.caption ?? '');
  const [previewing, setPreviewing] = useState(false);
  const playerRef = useRef(null);

  // Parse URL as user types
  const handleUrlChange = (v) => {
    setUrl(v);
    const id = parseYouTubeId(v);
    if (id) {
      setVideoId(id);
      setStart(0);
      setEnd(CLIP_DURATION);
      setPreviewing(false);
    } else {
      setVideoId(null);
    }
  };

  // Moving START: end follows automatically (start + CLIP_DURATION)
  // unless the user has already manually shortened the end
  const handleStartChange = (val) => {
    const s = Math.max(0, Math.min(val, vidDur - MIN_CLIP));
    const newEnd = Math.min(s + CLIP_DURATION, vidDur);
    setStart(s);
    setEnd(newEnd);
  };

  // Moving END independently (only shorten — can't exceed start + CLIP_DURATION)
  const handleEndChange = (val) => {
    const e = Math.max(start + MIN_CLIP, Math.min(val, Math.min(start + CLIP_DURATION, vidDur)));
    setEnd(e);
  };

  const clipLen = Math.round(end - start);
  const pct = (v) => `${Math.round((v / Math.max(vidDur, 1)) * 100)}%`;

  const previewSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?start=${Math.round(start)}&end=${Math.round(end)}&autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0&playbackRate=${speed}`
    : null;

  const thumbnailSrc = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null;

  const SPEEDS = [
    { v: 0.5,  label: '0.5×', desc: 'Slow motion — wildlife at its most dramatic' },
    { v: 0.75, label: '0.75×', desc: 'Gentle — landscapes, arrivals, sundowners' },
    { v: 1,    label: '1×',   desc: 'Normal speed' },
    { v: 1.25, label: '1.25×', desc: 'Slightly faster — activity montages' },
    { v: 1.5,  label: '1.5×', desc: 'Fast cut — aerial footage, overviews' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0f0f0f', border: `0.5px solid ${T.borderGold}`, borderRadius: 16, padding: '24px 24px 20px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.gold }}>🎬 YouTube reel editor</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: T.textMid, width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* URL input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 5 }}>YouTube URL</div>
          <input
            value={url}
            onChange={e => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
            style={{ width: '100%', padding: '9px 12px', background: T.bg3, border: `1.5px solid ${videoId ? T.borderGold : T.border}`, borderRadius: 9, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          {url && !videoId && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>⚠ Couldn't extract video ID — try the full YouTube URL</div>}
          {videoId && <div style={{ fontSize: 11, color: T.green, marginTop: 4 }}>✓ Video ID: {videoId}</div>}
        </div>

        {/* Thumbnail preview */}
        {videoId && !previewing && (
          <div style={{ position: 'relative', height: 180, borderRadius: 10, overflow: 'hidden', background: '#111', marginBottom: 16, cursor: 'pointer' }} onClick={() => setPreviewing(true)}>
            <img src={thumbnailSrc} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(212,175,55,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>▶</div>
            </div>
            <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 10, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 7px' }}>Click to preview clip</div>
          </div>
        )}

        {/* Live preview iframe */}
        {videoId && previewing && (
          <div style={{ position: 'relative', paddingBottom: '42%', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 16 }}>
            <iframe
              key={`${videoId}-${start}-${end}-${speed}`}
              src={previewSrc}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            <button onClick={() => setPreviewing(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
          </div>
        )}

        {videoId && (
          <>
            {/* Clip window */}
            <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Clip window</div>
                <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{clipLen}s clip · {Math.round(start)}s → {Math.round(end)}s</div>
              </div>

              {/* Visual timeline bar */}
              <div style={{ position: 'relative', height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 12, overflow: 'visible' }}>
                {/* Selected region highlight */}
                <div style={{ position: 'absolute', left: pct(start), width: `${Math.round(((end - start) / Math.max(vidDur, 1)) * 100)}%`, height: '100%', background: 'rgba(212,175,55,0.25)', borderRadius: 4 }} />

                {/* START handle */}
                <input
                  type="range"
                  min={0}
                  max={vidDur}
                  step={0.5}
                  value={start}
                  onChange={e => handleStartChange(Number(e.target.value))}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 3 }}
                />
                {/* Visual start handle */}
                <div style={{ position: 'absolute', left: `calc(${pct(start)} - 10px)`, top: '50%', transform: 'translateY(-50%)', width: 20, height: 28, background: T.gold, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#0a0a0a', fontWeight: 800, cursor: 'ew-resize', zIndex: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  ◂
                </div>
              </div>

              {/* END handle — separate row */}
              <div style={{ position: 'relative', height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 10, overflow: 'visible' }}>
                <div style={{ position: 'absolute', left: pct(start), width: `${Math.round(((end - start) / Math.max(vidDur, 1)) * 100)}%`, height: '100%', background: 'rgba(212,175,55,0.15)', borderRadius: 4 }} />
                <input
                  type="range"
                  min={start + MIN_CLIP}
                  max={Math.min(start + CLIP_DURATION, vidDur)}
                  step={0.5}
                  value={end}
                  onChange={e => handleEndChange(Number(e.target.value))}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', zIndex: 3 }}
                />
                <div style={{ position: 'absolute', left: `calc(${pct(end)} - 10px)`, top: '50%', transform: 'translateY(-50%)', width: 20, height: 28, background: '#fff', border: `2px solid ${T.gold}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: T.gold, fontWeight: 800, cursor: 'ew-resize', zIndex: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  ▸
                </div>
              </div>

              <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.5 }}>
                <strong style={{ color: T.gold }}>Gold handle (◂)</strong> — move start. End adjusts automatically to start +{CLIP_DURATION}s.<br/>
                <strong style={{ color: T.text }}>White handle (▸)</strong> — drag back to shorten clip. Cannot exceed {CLIP_DURATION}s.
              </div>

              {/* Fine-tune number inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: T.textDim, marginBottom: 3 }}>Start (seconds)</div>
                  <input type="number" value={Math.round(start * 10) / 10} min={0} max={vidDur - MIN_CLIP} step={0.5}
                    onChange={e => handleStartChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 10px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: T.textDim, marginBottom: 3 }}>End (seconds)</div>
                  <input type="number" value={Math.round(end * 10) / 10} min={start + MIN_CLIP} max={Math.min(start + CLIP_DURATION, vidDur)} step={0.5}
                    onChange={e => handleEndChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 10px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
            </div>

            {/* Speed selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 8 }}>Playback speed</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SPEEDS.map(s => (
                  <button key={s.v} onClick={() => setSpeed(s.v)}
                    style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${speed === s.v ? T.gold : T.border}`, background: speed === s.v ? T.goldDim : 'transparent', color: speed === s.v ? T.gold : T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: speed === s.v ? 700 : 400 }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 6 }}>{SPEEDS.find(s => s.v === speed)?.desc}</div>
            </div>

            {/* Caption */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 5 }}>Caption (optional)</div>
              <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Arrival experience · Singita Boulders"
                style={{ width: '100%', padding: '8px 12px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>

            {/* Preview + Save */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPreviewing(v => !v)}
                style={{ flex: 1, padding: '10px 0', background: 'rgba(96,165,250,0.1)', border: '0.5px solid rgba(96,165,250,0.3)', borderRadius: 9, color: '#60a5fa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {previewing ? '■ Stop preview' : '▶ Preview clip'}
              </button>
              <button onClick={() => onSave({ source: 'youtube', video_id: videoId, start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, speed, caption, thumbnail: thumbnailSrc })}
                style={{ flex: 2, padding: '10px 0', background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', borderRadius: 9, color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Save reel →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT SCORE ENGINE — 65 points total (room descriptions + social = future)
// Computed live from the in-memory supplier + images + reels state.
// ═══════════════════════════════════════════════════════════════════════════════
function computeContentScore(supplier, images, reels, kbEntryCount = 0) {
  const approved = (images ?? []).filter(i => i.status === 'approved');

  // 1. Property description (15 pts)
  const desc = (supplier?.description ?? '').trim();
  const descWords = desc.split(/\s+/).filter(Boolean).length;
  let descPts = 0;
  if (descWords >= 150) descPts = 15;
  else if (descWords >= 100) descPts = 11;
  else if (descWords >= 50) descPts = 7;
  else if (descWords >= 20) descPts = 4;
  else if (descWords > 0) descPts = 1;

  // 2. Photography (20 pts) — 12+ approved images full marks, scaled below
  const imgCount = approved.length;
  let imgPts = 0;
  if (imgCount >= 12) imgPts = 20;
  else if (imgCount >= 8) imgPts = 16;
  else if (imgCount >= 5) imgPts = 11;
  else if (imgCount >= 2) imgPts = 6;
  else if (imgCount >= 1) imgPts = 2;

  // 3. Reels (20 pts) — 2 approved reels full marks. 3rd = bonus capped at 20.
  const reelCount = (reels ?? []).length;
  let reelPts = 0;
  if (reelCount >= 2) reelPts = 20;
  else if (reelCount === 1) reelPts = 12;

  // 4. Knowledge Base entries (10 pts) — 3+ specialist notes full marks
  let kbPts = 0;
  if (kbEntryCount >= 3) kbPts = 10;
  else if (kbEntryCount === 2) kbPts = 7;
  else if (kbEntryCount === 1) kbPts = 4;

  // 5. Keywords & tags (5 pts) — 5+ tags full marks
  const tagCount = Array.isArray(supplier?.tags) ? supplier.tags.length : 0;
  const kwCount  = Array.isArray(supplier?.keywords) ? supplier.keywords.length : 0;
  const totalTags = tagCount + kwCount;
  let tagPts = 0;
  if (totalTags >= 5) tagPts = 5;
  else if (totalTags >= 3) tagPts = 3;
  else if (totalTags >= 1) tagPts = 1;

  // 6. Content freshness (5 pts) — updated in last 12 months
  let freshPts = 0;
  if (supplier?.updated_at) {
    const ageDays = (Date.now() - new Date(supplier.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 90) freshPts = 5;
    else if (ageDays <= 180) freshPts = 3;
    else if (ageDays <= 365) freshPts = 1;
  }

  const total = descPts + imgPts + reelPts + kbPts + tagPts + freshPts;

  return {
    total,
    max: 65,
    pct: Math.round((total / 65) * 100),
    dimensions: [
      { id: 'desc',  label: 'Property description',  pts: descPts,  max: 15,
        suggestion: descWords === 0 ? 'Add a property description — 150+ words for full marks.'
          : descWords < 150 ? `Add ${150 - descWords} more words to your description for full marks.`
          : 'Full marks. ✓' },
      { id: 'img',   label: 'Photography',           pts: imgPts,   max: 20,
        suggestion: imgCount === 0 ? 'Upload at least 12 approved images for full marks.'
          : imgCount < 12 ? `Upload ${12 - imgCount} more approved image${12 - imgCount === 1 ? '' : 's'} for full marks.`
          : 'Full marks. ✓' },
      { id: 'reel',  label: 'Reels (short video)',   pts: reelPts,  max: 20,
        suggestion: reelCount === 0 ? 'Add 2 reels — e.g. arrival experience + room walkthrough.'
          : reelCount < 2 ? 'Add 1 more reel for full marks.'
          : 'Full marks. ✓' },
      { id: 'kb',    label: 'Knowledge Base entries', pts: kbPts,   max: 10,
        suggestion: kbEntryCount === 0 ? 'Add 3+ specialist notes (booking tips, room recommendations, seasonal advice).'
          : kbEntryCount < 3 ? `Add ${3 - kbEntryCount} more KB note${3 - kbEntryCount === 1 ? '' : 's'} for full marks.`
          : 'Full marks. ✓' },
      { id: 'tags',  label: 'Keywords & tags',       pts: tagPts,   max: 5,
        suggestion: totalTags < 5 ? `Add ${5 - totalTags} more tag${5 - totalTags === 1 ? '' : 's'} to improve discoverability.`
          : 'Full marks. ✓' },
      { id: 'fresh', label: 'Content freshness',     pts: freshPts, max: 5,
        suggestion: freshPts === 5 ? 'Updated recently. ✓'
          : freshPts >= 1 ? 'Refresh any content this month to bump to full marks.'
          : 'No recent updates detected. Any content change will reset this.' },
    ],
  };
}

export default function ContentCMS({ supplierId, isAdmin = false }) {
  const [supplier,      setSupplier]      = useState(null);
  const [images,        setImages]        = useState([]);   // local working copy
  const [heroType,      setHeroType]      = useState('image'); // 'image'|'video'|'reel'
  const [locked,        setLocked]        = useState(false);
  const [reels,         setReels]         = useState([]);      // saved YouTube reels
  const [showYTPopup,   setShowYTPopup]   = useState(false);
  const [editingReel,   setEditingReel]   = useState(null);    // null = new, obj = editing

  // ── Upload zone state ──────────────────────────────────────────────────────
  const [uploads,       setUploads]       = useState([]);  // [{id, name, status, pct, error, lowRes?}]
  const [uploadDrag,    setUploadDrag]    = useState(false);
  const fileInputRef = useRef(null);

  // ── Inline edit state ──────────────────────────────────────────────────────
  // Only one image row may be open at a time. Stores the local working copy.
  const [editIdx,       setEditIdx]       = useState(null);
  const [editDraft,     setEditDraft]     = useState(null);

  // ── Score panel ─────────────────────────────────────────────────────────────
  const [scoreOpen,     setScoreOpen]     = useState(true);
  const [expandedDim,   setExpandedDim]   = useState(null);
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

        // Parse reels from Supabase
        let reelRows = [];
        try {
          reelRows = Array.isArray(row.reels)
            ? row.reels
            : (row.reels ? JSON.parse(row.reels) : []);
        } catch { reelRows = []; }
        setReels(reelRows);

        // Normalise display_order
        const normalised = imgs.map((img, i) => ({ ...img, display_order: img.display_order ?? i + 1 }))
          .sort((a, b) => a.display_order - b.display_order);
        setImages(normalised);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [supplierId]);

  // ── Build slides from current state ───────────────────────────────────────
  const slides = buildSlides(supplier, images, heroType, reels);

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

  // ── Upload handlers ────────────────────────────────────────────────────────
  // Posts to /api/upload — server uses SERVICE_ROLE_KEY, writes to suppliers.images.
  // Refreshes the local images state on success so the row appears immediately.
  const uploadOne = async (file) => {
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // Pre-check: dimensions warning (warn only — never block)
    let lowRes = false;
    try {
      const dims = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => { res({ w: img.width, h: img.height }); URL.revokeObjectURL(img.src); };
        img.onerror = () => { rej(new Error('not-an-image')); URL.revokeObjectURL(img.src); };
        img.src = URL.createObjectURL(file);
      });
      if (dims.w < 1200) lowRes = true;
    } catch { /* not an image we can preview — proceed anyway */ }

    setUploads(u => [...u, { id, name: file.name, status: 'uploading', pct: 0, lowRes }]);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('supplier_id', supplierId);
      fd.append('media_type', 'images');
      fd.append('caption', file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80));
      fd.append('uploaded_by', isAdmin ? 'admin' : 'supplier');

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.text().catch(() => 'Upload failed');
        throw new Error(err || `Status ${res.status}`);
      }
      const data = await res.json();

      // The API route has already inserted the image record into suppliers.images.
      // Refetch the supplier so our local state reflects the new ordering & URL.
      const fresh = await db.getSupplier(supplierId);
      if (fresh) {
        let imgs = [];
        try {
          imgs = Array.isArray(fresh.images) ? fresh.images : (fresh.images ? JSON.parse(fresh.images) : []);
        } catch { imgs = []; }
        const normalised = imgs.map((img, i) => ({ ...img, display_order: img.display_order ?? i + 1 }));
        setImages(normalised);
      }

      setUploads(u => u.map(x => x.id === id ? { ...x, status: 'done', pct: 100 } : x));
      // Clear successful row after 4s
      setTimeout(() => setUploads(u => u.filter(x => x.id !== id)), 4000);
    } catch (e) {
      setUploads(u => u.map(x => x.id === id ? { ...x, status: 'error', error: e.message } : x));
    }
  };

  const handleFiles = async (fileList) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    // Upload in parallel but cap at 4 concurrent to avoid hammering the route
    const chunks = [];
    for (let i = 0; i < files.length; i += 4) chunks.push(files.slice(i, i + 4));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(uploadOne));
    }
  };

  const onUploadDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setUploadDrag(false);
    handleFiles(e.dataTransfer?.files);
  };

  // ── Inline edit handlers ────────────────────────────────────────────────────
  const openEdit = (idx) => {
    if (editIdx === idx) { setEditIdx(null); setEditDraft(null); return; }
    setEditIdx(idx);
    const img = images[idx] ?? {};
    setEditDraft({
      caption:   img.caption   ?? '',
      room_type: img.room_type ?? '',
      tags:      Array.isArray(img.tags) ? img.tags.join(', ') : (img.tags ?? ''),
      status:    img.status    ?? 'approved',
    });
  };

  const saveEdit = () => {
    if (editIdx === null || !editDraft) return;
    const tagList = String(editDraft.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    setImages(prev => prev.map((img, i) => i === editIdx
      ? { ...img, caption: editDraft.caption, room_type: editDraft.room_type, tags: tagList, status: editDraft.status }
      : img));
    setEditIdx(null); setEditDraft(null);
    setSaved(false);
  };

  const deleteImage = (idx) => {
    if (!window.confirm('Remove this image from the supplier? (You can re-upload it.)')) return;
    setImages(prev => prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, display_order: i + 1 })));
    setEditIdx(null); setEditDraft(null);
    setSaved(false);
  };

  // ── Compute live content score ─────────────────────────────────────────────
  const kbForThisSupplier = 0; // Could be wired to a KB count later; safe default for now
  const score = useMemo(
    () => computeContentScore(supplier, images, reels, kbForThisSupplier),
    [supplier, images, reels]
  );

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
        reels: reels,
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

              {/* ══ CONTENT SCORE PANEL — live, computed from supplier + images + reels ══ */}
              <div style={{ background: T.surface, border: `0.5px solid ${score.pct >= 80 ? T.borderGold : T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div onClick={() => setScoreOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Content score</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{score.pct >= 80 ? 'Strong — featured eligible' : score.pct >= 60 ? 'Good — keep going' : 'Needs work — see suggestions'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: score.pct >= 80 ? T.gold : score.pct >= 60 ? T.text : T.amber, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{score.total}<span style={{ fontSize: 13, color: T.textDim, fontWeight: 400 }}>/65</span></div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>{score.pct}%</div>
                    </div>
                    <div style={{ fontSize: 12, color: T.textDim }}>{scoreOpen ? '▲' : '▼'}</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: 12, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${score.pct}%`, height: '100%', background: score.pct >= 80 ? `linear-gradient(90deg, ${T.gold}, ${T.goldLight})` : score.pct >= 60 ? T.gold : T.amber, transition: 'width 0.4s ease' }} />
                </div>

                {scoreOpen && (
                  <div style={{ marginTop: 16, borderTop: `0.5px solid ${T.border}`, paddingTop: 14 }}>
                    {score.dimensions.map(dim => {
                      const isExpanded = expandedDim === dim.id;
                      const full = dim.pts === dim.max;
                      return (
                        <div key={dim.id} style={{ marginBottom: 8 }}>
                          <div onClick={() => setExpandedDim(isExpanded ? null : dim.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                              <div style={{ width: 16, fontSize: 11, color: full ? T.green : T.textDim, flexShrink: 0 }}>{full ? '✓' : '·'}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{dim.label}</div>
                              </div>
                              <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ width: `${(dim.pts / dim.max) * 100}%`, height: '100%', background: full ? T.green : T.gold, transition: 'width 0.3s' }} />
                              </div>
                              <div style={{ fontSize: 11, color: T.textMid, minWidth: 36, textAlign: 'right' }}>{dim.pts}/{dim.max}</div>
                              <div style={{ fontSize: 10, color: T.textDim, width: 12, textAlign: 'right' }}>{isExpanded ? '▲' : '▼'}</div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ marginLeft: 26, marginTop: 4, marginBottom: 8, fontSize: 11, color: T.textDim, lineHeight: 1.55, background: T.bg3, borderLeft: `2px solid ${full ? T.green : T.gold}`, padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                              {dim.suggestion}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(96,165,250,0.05)', border: '0.5px solid rgba(96,165,250,0.2)', borderRadius: 8, fontSize: 11, color: '#93c5fd', lineHeight: 1.55 }}>
                      ℹ Up to <strong>+25 more points</strong> available once room descriptions (15) and social media verification (10) are added in a future update.
                    </div>
                  </div>
                )}
              </div>

              {/* ══ UPLOAD ZONE — drag/drop or click. Posts to /api/upload. ══ */}
              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Upload images</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>Drop JPG / PNG / WEBP · {isAdmin ? 'Goes live immediately' : 'Pending admin review'}</div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim }}>Max 10MB per file · 1600px+ recommended</div>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={e => { e.preventDefault(); setUploadDrag(true); }}
                  onDragOver={e => { e.preventDefault(); setUploadDrag(true); }}
                  onDragLeave={e => { e.preventDefault(); setUploadDrag(false); }}
                  onDrop={onUploadDrop}
                  style={{
                    border: `1.5px dashed ${uploadDrag ? T.gold : T.border}`,
                    borderRadius: 12,
                    padding: '28px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: uploadDrag ? T.goldDim : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                  <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>Drag photos here or click to choose</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>Multiple files supported · uploads in parallel</div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                  style={{ display: 'none' }}
                />

                {/* Upload progress / status list */}
                {uploads.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {uploads.map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: T.bg3, border: `0.5px solid ${u.status === 'error' ? 'rgba(248,113,113,0.3)' : u.status === 'done' ? 'rgba(74,222,128,0.3)' : T.border}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 13, flexShrink: 0 }}>
                          {u.status === 'uploading' ? '↑' : u.status === 'done' ? '✓' : '⚠'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                          <div style={{ fontSize: 10, color: u.status === 'error' ? '#f87171' : u.lowRes ? T.amber : T.textDim, marginTop: 2 }}>
                            {u.status === 'uploading' && 'Uploading…'}
                            {u.status === 'done' && (u.lowRes ? '✓ Uploaded — low res, consider 1600px+ next time' : '✓ Uploaded')}
                            {u.status === 'error' && (u.error || 'Failed')}
                          </div>
                        </div>
                        {u.status === 'error' && (
                          <button onClick={() => setUploads(prev => prev.filter(x => x.id !== u.id))} style={{ background: 'transparent', border: 'none', color: T.textDim, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                        )}
                      </div>
                    ))}
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
                            {/* Edit row (inline expansion — one open at a time) */}
                            <button
                              onClick={() => openEdit(idx)}
                              title="Edit caption, room type, tags"
                              style={{ background: editIdx === idx ? T.goldDim : 'rgba(255,255,255,0.04)', border: `0.5px solid ${editIdx === idx ? T.borderGold : T.border}`, borderRadius: 7, width: 28, height: 28, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', color: editIdx === idx ? T.gold : T.textDim, fontFamily: 'inherit' }}
                            >✎</button>
                          </div>
                        </div>
                        {/* INLINE EDIT FORM (below the row) */}
                        {editIdx === idx && editDraft && (
                          <div style={{ background: T.bg3, border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '14px 14px', marginTop: -2, marginBottom: 4 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>Caption</div>
                                <input value={editDraft.caption} onChange={e => setEditDraft({ ...editDraft, caption: e.target.value.slice(0, 120) })} placeholder="e.g. Sundowner deck overlooking the river" style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>Room type (optional)</div>
                                <input value={editDraft.room_type} onChange={e => setEditDraft({ ...editDraft, room_type: e.target.value.slice(0, 50) })} placeholder="e.g. Boulders Suite, Standard Room, Pool" list={`room-types-${supplierId}`} style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                                <datalist id={`room-types-${supplierId}`}>
                                  {Array.from(new Set(images.map(i => i.room_type).filter(Boolean))).map(rt => <option key={rt} value={rt} />)}
                                </datalist>
                              </div>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>Tags (comma-separated)</div>
                              <input value={editDraft.tags} onChange={e => setEditDraft({ ...editDraft, tags: e.target.value.slice(0, 200) })} placeholder="e.g. sundowner, riverside, suite, romantic" style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 5 }}>Status</div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {['approved', 'pending', 'rejected'].map(s => (
                                  <button key={s} onClick={() => setEditDraft({ ...editDraft, status: s })} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${editDraft.status === s ? (s === 'approved' ? '#4ade80' : s === 'pending' ? T.amber : '#f87171') : T.border}`, background: editDraft.status === s ? (s === 'approved' ? 'rgba(74,222,128,0.1)' : s === 'pending' ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)') : 'transparent', color: editDraft.status === s ? (s === 'approved' ? '#4ade80' : s === 'pending' ? T.amber : '#f87171') : T.textMid, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', fontWeight: editDraft.status === s ? 700 : 400 }}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                              <button onClick={() => deleteImage(idx)} style={{ padding: '7px 14px', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: 7, color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { setEditIdx(null); setEditDraft(null); }} style={{ padding: '7px 14px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.textMid, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                                <button onClick={saveEdit} style={{ padding: '7px 16px', background: `linear-gradient(135deg, ${T.gold}, ${T.goldLight})`, border: 'none', borderRadius: 7, color: '#0a0a0a', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save changes</button>
                              </div>
                            </div>
                          </div>
                        )}
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── YouTube reel editor ── */}
              {showYTPopup && (
                <YouTubePopup
                  existing={editingReel}
                  onClose={() => { setShowYTPopup(false); setEditingReel(null); }}
                  onSave={reel => {
                    if (editingReel) {
                      setReels(prev => prev.map(r => r === editingReel ? reel : r));
                    } else {
                      setReels(prev => [...prev, reel]);
                    }
                    setShowYTPopup(false);
                    setEditingReel(null);
                    setSaved(false); // prompt user to save
                  }}
                />
              )}

              <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>YouTube reels</div>
                  <button
                    onClick={() => { setEditingReel(null); setShowYTPopup(true); }}
                    style={{ padding: '6px 14px', background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', borderRadius: 8, color: '#0a0a0a', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    + Add reel
                  </button>
                </div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.55 }}>
                  Paste any YouTube URL, trim to a 5–15 second clip, set playback speed, and set it as the hero tile. Saved to your supplier record.
                </div>

                {reels.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: T.textDim, fontSize: 12 }}>
                    No reels yet. Tap <strong style={{ color: T.text }}>+ Add reel</strong> to embed a YouTube clip.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reels.map((reel, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 10 }}>
                        {/* Thumbnail */}
                        <div style={{ width: 80, height: 50, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#111' }}>
                          {reel.thumbnail
                            ? <img src={reel.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>▶</div>
                          }
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {reel.caption || reel.video_id}
                          </div>
                          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                            {Math.round(reel.start)}s → {Math.round(reel.end)}s · {reel.speed}× speed · {Math.round(reel.end - reel.start)}s clip
                          </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => { setEditingReel(reel); setShowYTPopup(true); }}
                            style={{ padding: '4px 10px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 6, color: T.gold, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                          <button onClick={() => setReels(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ padding: '4px 10px', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
