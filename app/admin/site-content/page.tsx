'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — Site Content CMS
// /admin/site-content
//
// Edits per-Edition content: brand, hero, loading reels, trust cards, nav, footer.
// Backed by Supabase table `site_content` and storage bucket `site-media`.
// All sections save independently — a mistake in one doesn't lose work in another.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo } from 'react';

// ── Supabase client (browser-side, anon key) ─────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function sbFetch(path: string, init?: RequestInit) {
  return fetch(`${SB_URL}${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers ?? {}),
    },
  });
}

async function sbUpload(bucket: string, path: string, file: File) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  return `${SB_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ── Design tokens (locked to match page.tsx) ─────────────────────────────────
const T = {
  bg:         '#0a0a0a',
  surface:    '#141414',
  bg3:        '#1e1e1e',
  text:       '#f5f0e8',
  textMid:    'rgba(245,240,232,0.7)',
  textDim:    'rgba(245,240,232,0.4)',
  border:     'rgba(255,255,255,0.1)',
  borderGold: 'rgba(212,175,55,0.3)',
  gold:       '#d4af37',
  goldLight:  '#f0c040',
  goldDim:    'rgba(212,175,55,0.1)',
  green:      '#4ade80',
  amber:      '#fbbf24',
  red:        '#f87171',
  fontSerif:  "'Cormorant Garamond', serif",
  fontSans:   "'DM Sans', sans-serif",
};

// ── Types ────────────────────────────────────────────────────────────────────
type Brand = {
  logoUrl:     string | null;
  tagline:     string;
  displayName: string;
};

type Hero = {
  type:           'image' | 'reel';
  url:            string | null;
  overlayOpacity: number;
  heading:        string;
  headingItalic:  string;
  subheading:     string;
};

type LoadingReel = {
  id:       string;
  region:   string;   // 'any' | 'kruger-sabi-sand' | 'okavango-delta' | etc
  url:      string | null;
  caption:  string;
  duration: number;   // seconds
};

type TrustCard = { id: string; icon: string; title: string; subtitle: string };

type NavLabels = { home: string; curated: string; brief: string };

type Footer = { copyright: string; support: string };

type SiteContent = {
  edition_id:    string;
  brand:         Brand;
  hero:          Hero;
  loading_reels: LoadingReel[];
  trust_cards:   TrustCard[];
  nav_labels:    NavLabels;
  footer:        Footer;
};

const REGION_OPTIONS = [
  { value: 'any',                 label: 'Any region (default)' },
  { value: 'kruger-sabi-sand',    label: 'Kruger / Sabi Sand' },
  { value: 'okavango-delta',      label: 'Okavango Delta' },
  { value: 'cape-town',           label: 'Cape Town' },
  { value: 'madikwe',             label: 'Madikwe' },
  { value: 'chobe-vic-falls',     label: 'Chobe / Victoria Falls' },
  { value: 'masai-mara',          label: 'Masai Mara' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN GATE — same code as page.tsx
// ═══════════════════════════════════════════════════════════════════════════════
function LoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const attempt = () => {
    if (code.trim().toLowerCase() === 'safari2026') {
      localStorage.setItem('tse_admin_access', 'safari2026');
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: T.fontSans, color: T.text }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 24, color: T.gold, fontFamily: T.fontSerif, fontWeight: 700, marginBottom: 8 }}>✦ Site Content CMS</div>
        <div style={{ fontSize: 12, color: T.textDim, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Admin Access Required</div>
      </div>
      <div style={{ width: '100%', maxWidth: 340, animation: shaking ? 'shake 0.4s ease' : 'none' }}>
        <input
          type="password"
          value={code}
          onChange={e => { setCode(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Enter access code"
          autoFocus
          style={{ width: '100%', padding: '14px 18px', background: T.bg3, border: `1.5px solid ${error ? T.red : T.borderGold}`, borderRadius: 12, color: T.text, fontSize: 15, outline: 'none', fontFamily: 'inherit', textAlign: 'center', letterSpacing: '0.1em', marginBottom: 12, boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12, color: T.red, textAlign: 'center', marginBottom: 10 }}>Incorrect code</div>}
        <button onClick={attempt} style={{ width: '100%', padding: 14, background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, border: 'none', borderRadius: 12, color: '#0a0a0a', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Enter →</button>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOAD CONTROL — drag/drop + size guardrail
// ═══════════════════════════════════════════════════════════════════════════════
function MediaUploader({ value, onChange, accept, maxMB, kind, hint }: {
  value:    string | null;
  onChange: (url: string | null) => void;
  accept:   string;
  maxMB:    number;
  kind:     'image' | 'video';
  hint?:    string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxMB) {
      setError(`File too large (${sizeMB.toFixed(1)}MB). Max ${maxMB}MB. Compress with HandBrake or similar before uploading.`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await sbUpload('site-media', path, file);
      onChange(url);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    }
    setUploading(false);
  };

  const onFile = (f: File | null) => { if (f) upload(f); };

  const dropProps = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); },
    onDrop:      (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files?.[0] ?? null); },
  };

  return (
    <div>
      <div
        {...dropProps}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragOver ? T.gold : value ? T.borderGold : T.border}`,
          borderRadius: 10,
          padding: value ? 8 : '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? T.goldDim : 'rgba(255,255,255,0.02)',
          transition: 'all 0.15s',
        }}
      >
        {value ? (
          <div style={{ position: 'relative' }}>
            {kind === 'image'
              ? <img src={value} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }} />
              : <video src={value} muted autoPlay loop playsInline style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6, background: '#000' }} />
            }
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }} style={{ flex: 1, padding: '7px 0', background: T.bg3, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Replace</button>
              <button onClick={e => { e.stopPropagation(); onChange(null); }} style={{ flex: 1, padding: '7px 0', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', color: T.red, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{kind === 'image' ? '🖼' : '🎬'}</div>
            <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>{uploading ? 'Uploading…' : 'Drag a file here or click to upload'}</div>
            <div style={{ fontSize: 11, color: T.textDim }}>Max {maxMB}MB · {accept.replace(/image\/|video\//g, '').toUpperCase()}</div>
            {hint && <div style={{ fontSize: 10, color: T.gold, marginTop: 6 }}>{hint}</div>}
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={e => onFile(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
      {error && <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 11, color: T.red }}>⚠ {error}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION WRAPPER — collapsible, with independent save state
// ═══════════════════════════════════════════════════════════════════════════════
function Section({ title, subtitle, icon, dirty, saving, onSave, children, defaultOpen = false }: {
  title:       string;
  subtitle:    string;
  icon:        string;
  dirty:       boolean;
  saving:      boolean;
  onSave:      () => void;
  children:    React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${dirty ? T.borderGold : T.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20 }}>{icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dirty && <div style={{ fontSize: 10, color: T.amber, background: 'rgba(251,191,36,0.07)', border: '0.5px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>● UNSAVED</div>}
          <div style={{ fontSize: 12, color: T.textDim }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: `0.5px solid ${T.border}` }}>
          <div style={{ paddingTop: 16 }}>{children}</div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onSave}
              disabled={!dirty || saving}
              style={{
                padding: '9px 20px',
                background: dirty && !saving ? `linear-gradient(135deg,${T.gold},${T.goldLight})` : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: 9,
                color: dirty && !saving ? '#0a0a0a' : T.textDim,
                fontSize: 12,
                fontWeight: 700,
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : dirty ? 'Save changes' : '✓ Saved'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SiteContentAdmin() {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('tse_admin_access') === 'safari2026' || localStorage.getItem('tse_access') === 'safari2026';
  });

  const [editionId, setEditionId] = useState('safari');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Server snapshot (what's saved)
  const [server, setServer] = useState<SiteContent | null>(null);
  // Local working copies — one per section
  const [brand, setBrand]               = useState<Brand | null>(null);
  const [hero, setHero]                 = useState<Hero | null>(null);
  const [reels, setReels]               = useState<LoadingReel[] | null>(null);
  const [cards, setCards]               = useState<TrustCard[] | null>(null);
  const [navLabels, setNavLabels]       = useState<NavLabels | null>(null);
  const [footer, setFooter]             = useState<Footer | null>(null);

  const [saving, setSaving]             = useState<string | null>(null);
  const [previewSequence, setPreviewSequence] = useState(false);

  // Load row from Supabase
  useEffect(() => {
    if (!unlocked) return;
    setLoading(true); setLoadError(null);
    sbFetch(`/rest/v1/site_content?edition_id=eq.${editionId}&select=*`)
      .then(r => r.json())
      .then(rows => {
        const row = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!row) {
          setLoadError(`No site_content row found for edition_id="${editionId}". Run the SQL migration first.`);
          setLoading(false);
          return;
        }
        const sc: SiteContent = {
          edition_id:    row.edition_id,
          brand:         row.brand ?? {},
          hero:          row.hero ?? {},
          loading_reels: row.loading_reels ?? [],
          trust_cards:   row.trust_cards ?? [],
          nav_labels:    row.nav_labels ?? {},
          footer:        row.footer ?? {},
        };
        setServer(sc);
        setBrand(sc.brand);
        setHero(sc.hero);
        setReels(sc.loading_reels);
        setCards(sc.trust_cards);
        setNavLabels(sc.nav_labels);
        setFooter(sc.footer);
        setLoading(false);
      })
      .catch(e => { setLoadError(e?.message ?? 'Load failed'); setLoading(false); });
  }, [editionId, unlocked]);

  // Dirty checks
  const brandDirty = server && brand     && JSON.stringify(brand)     !== JSON.stringify(server.brand);
  const heroDirty  = server && hero      && JSON.stringify(hero)      !== JSON.stringify(server.hero);
  const reelsDirty = server && reels     && JSON.stringify(reels)     !== JSON.stringify(server.loading_reels);
  const cardsDirty = server && cards     && JSON.stringify(cards)     !== JSON.stringify(server.trust_cards);
  const navDirty   = server && navLabels && JSON.stringify(navLabels) !== JSON.stringify(server.nav_labels);
  const footDirty  = server && footer    && JSON.stringify(footer)    !== JSON.stringify(server.footer);

  // Save one section
  const saveSection = async (key: string, value: any) => {
    if (!server) return;
    setSaving(key);
    try {
      const res = await sbFetch(`/rest/v1/site_content?edition_id=eq.${editionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      const updated = await res.json();
      const row = Array.isArray(updated) && updated.length ? updated[0] : null;
      if (row) {
        setServer({
          edition_id:    row.edition_id,
          brand:         row.brand ?? {},
          hero:          row.hero ?? {},
          loading_reels: row.loading_reels ?? [],
          trust_cards:   row.trust_cards ?? [],
          nav_labels:    row.nav_labels ?? {},
          footer:        row.footer ?? {},
        });
      }
    } catch (e: any) {
      alert(`Save failed: ${e?.message ?? e}`);
    }
    setSaving(null);
  };

  if (!unlocked) return <LoginGate onUnlock={() => setUnlocked(true)} />;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.fontSans, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: T.textDim }}>Loading site content…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.fontSans, padding: 40 }}>
        <div style={{ maxWidth: 600, margin: '40px auto', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.red, marginBottom: 8 }}>⚠ Could not load</div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 14 }}>{loadError}</div>
          <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.7 }}>
            <strong>To fix:</strong> Open Supabase → SQL Editor → paste and run <code style={{ background: T.bg3, padding: '2px 6px', borderRadius: 4 }}>site_content_migration.sql</code> from your downloads.
          </div>
          <a href="/admin" style={{ display: 'inline-block', marginTop: 14, padding: '8px 14px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.textMid, fontSize: 12, textDecoration: 'none' }}>← Back to admin</a>
        </div>
      </div>
    );
  }

  if (!brand || !hero || !reels || !cards || !navLabels || !footer) return null;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.fontSans, paddingBottom: 60 }}>

      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(16px)', borderBottom: `0.5px solid ${T.border}`, padding: '0 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', height: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/admin" style={{ color: T.textDim, fontSize: 12, textDecoration: 'none', padding: '6px 12px', borderRadius: 7, border: `0.5px solid ${T.border}` }}>← Admin</a>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, fontFamily: T.fontSerif }}>✦ Site Content</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>Edit per-Edition branding, hero, reels & copy</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select value={editionId} onChange={e => setEditionId(e.target.value)} style={{ background: T.bg3, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 8, padding: '6px 12px', fontSize: 12, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="safari">The Safari Edition</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* ─── BRAND ──────────────────────────────────────────────────────── */}
        <Section title="Brand" subtitle="Logo, display name, tagline" icon="✦" dirty={!!brandDirty} saving={saving === 'brand'} onSave={() => saveSection('brand', brand)} defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
            <div>
              <Label text="LOGO" hint="SVG preferred. PNG with transparent background also works." />
              <MediaUploader value={brand.logoUrl} onChange={url => setBrand({ ...brand, logoUrl: url })} accept="image/svg+xml,image/png" maxMB={2} kind="image" hint="Keep under 200KB for fast loading" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Label text="DISPLAY NAME" hint="Shows in the navigation bar" />
                <TextInput value={brand.displayName} onChange={v => setBrand({ ...brand, displayName: v })} placeholder="The Safari Edition" />
              </div>
              <div>
                <Label text="TAGLINE" hint="Shows under the edition name in dropdowns" />
                <TextInput value={brand.tagline} onChange={v => setBrand({ ...brand, tagline: v })} placeholder="Sub-Saharan Africa · Curated" maxLen={80} />
              </div>
            </div>
          </div>
        </Section>

        {/* ─── HERO ───────────────────────────────────────────────────────── */}
        <Section title="Hero — Landing page" subtitle="Image or reel, overlay opacity, headline copy" icon="🎬" dirty={!!heroDirty} saving={saving === 'hero'} onSave={() => saveSection('hero', hero)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['image', 'reel'] as const).map(type => (
              <button key={type} onClick={() => setHero({ ...hero, type })} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: `1.5px solid ${hero.type === type ? T.gold : T.border}`, background: hero.type === type ? T.goldDim : 'transparent', color: hero.type === type ? T.gold : T.textMid, fontSize: 12, fontWeight: hero.type === type ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {type === 'image' ? '🖼 Image' : '🎬 Reel (MP4)'}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label text={hero.type === 'image' ? 'HERO IMAGE' : 'HERO REEL'} hint={hero.type === 'image' ? 'Recommended 1400×900px or larger' : 'Recommended 1280×720, H.264, under 5MB, silent or low audio. Compress with HandBrake first.'} />
            <MediaUploader value={hero.url} onChange={url => setHero({ ...hero, url })} accept={hero.type === 'image' ? 'image/png,image/jpeg,image/webp' : 'video/mp4,video/webm,video/quicktime'} maxMB={hero.type === 'image' ? 5 : 8} kind={hero.type === 'image' ? 'image' : 'video'} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label text="OVERLAY OPACITY" hint="Darkens the bottom of the hero so text stays readable" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input type="range" min={0} max={100} value={hero.overlayOpacity} onChange={e => setHero({ ...hero, overlayOpacity: +e.target.value })} style={{ flex: 1 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, minWidth: 40, textAlign: 'right' }}>{hero.overlayOpacity}%</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <Label text="HEADLINE LINE 1" />
              <TextInput value={hero.heading} onChange={v => setHero({ ...hero, heading: v })} placeholder="Africa's finest wilderness," />
            </div>
            <div>
              <Label text="HEADLINE LINE 2 (italic, gold)" />
              <TextInput value={hero.headingItalic} onChange={v => setHero({ ...hero, headingItalic: v })} placeholder="curated for you." />
            </div>
          </div>
          <div>
            <Label text="SUBHEADING" />
            <TextInput value={hero.subheading} onChange={v => setHero({ ...hero, subheading: v })} placeholder="Handpicked lodges, negotiated rates…" />
          </div>
        </Section>

        {/* ─── LOADING REELS ──────────────────────────────────────────────── */}
        <Section title="Loading reels — Journey building screen" subtitle={`${reels.length} reels · plays in sequence while AI builds the itinerary`} icon="🎞" dirty={!!reelsDirty} saving={saving === 'loading_reels'} onSave={() => saveSection('loading_reels', reels)}>

          <div style={{ background: 'rgba(212,175,55,0.05)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: T.textMid, lineHeight: 1.65 }}>
            <strong style={{ color: T.gold }}>How this works:</strong> When a traveller's AI itinerary is being built, these reels play in sequence with their captions overlaid. Each reel auto-plays for its set duration (minimum 2 seconds). Region-tagged reels are prioritised when a traveller has selected matching regions. "Any" reels are the fallback playlist.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button onClick={() => setPreviewSequence(true)} style={{ padding: '8px 16px', background: 'rgba(96,165,250,0.1)', border: '0.5px solid rgba(96,165,250,0.3)', borderRadius: 9, color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>▶ Preview sequence</button>
            <button onClick={() => setReels([...reels, { id: `r${Date.now()}`, region: 'any', url: null, caption: 'New step caption…', duration: 3 }])} style={{ padding: '8px 16px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 9, color: T.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add reel slot</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reels.map((reel, idx) => (
              <ReelRow
                key={reel.id}
                reel={reel}
                idx={idx}
                total={reels.length}
                onChange={updated => setReels(reels.map(r => r.id === reel.id ? updated : r))}
                onMove={dir => {
                  const newIdx = idx + dir;
                  if (newIdx < 0 || newIdx >= reels.length) return;
                  const next = [...reels];
                  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
                  setReels(next);
                }}
                onRemove={() => setReels(reels.filter(r => r.id !== reel.id))}
              />
            ))}
          </div>

          {previewSequence && (
            <SequencePreview reels={reels} onClose={() => setPreviewSequence(false)} />
          )}
        </Section>

        {/* ─── TRUST CARDS ───────────────────────────────────────────────── */}
        <Section title="Trust cards" subtitle="The four cards on the landing page" icon="🛡" dirty={!!cardsDirty} saving={saving === 'trust_cards'} onSave={() => saveSection('trust_cards', cards)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cards.map((card, idx) => (
              <div key={card.id} style={{ background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => { if (idx > 0) { const next = [...cards]; [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]]; setCards(next); } }} disabled={idx === 0} style={{ width: 24, height: 22, background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 4, color: idx === 0 ? T.textDim : T.text, fontSize: 10, cursor: idx === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>▲</button>
                    <button onClick={() => { if (idx < cards.length - 1) { const next = [...cards]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setCards(next); } }} disabled={idx === cards.length - 1} style={{ width: 24, height: 22, background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 4, color: idx === cards.length - 1 ? T.textDim : T.text, fontSize: 10, cursor: idx === cards.length - 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>▼</button>
                  </div>
                  <input value={card.icon} onChange={e => setCards(cards.map(c => c.id === card.id ? { ...c, icon: e.target.value } : c))} placeholder="✦" style={{ width: 50, height: 46, background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 8, fontSize: 22, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input value={card.title} onChange={e => setCards(cards.map(c => c.id === card.id ? { ...c, title: e.target.value } : c))} placeholder="Title" style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: '7px 10px', fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    <input value={card.subtitle} onChange={e => setCards(cards.map(c => c.id === card.id ? { ...c, subtitle: e.target.value } : c))} placeholder="Subtitle" style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.textMid, borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={() => setCards(cards.filter(c => c.id !== card.id))} style={{ width: 28, height: 28, background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', color: T.red, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setCards([...cards, { id: `t${Date.now()}`, icon: '✦', title: 'New card', subtitle: 'Card subtitle' }])} style={{ marginTop: 12, padding: '8px 14px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 9, color: T.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add card</button>
        </Section>

        {/* ─── NAV LABELS ────────────────────────────────────────────────── */}
        <Section title="Navigation labels" subtitle="Text only — icons and order are locked" icon="📑" dirty={!!navDirty} saving={saving === 'nav_labels'} onSave={() => saveSection('nav_labels', navLabels)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <Label text="HOME LABEL" hint="Shown as tooltip on the home icon" />
              <TextInput value={navLabels.home} onChange={v => setNavLabels({ ...navLabels, home: v })} placeholder="Home" maxLen={20} />
            </div>
            <div>
              <Label text="CURATED LABEL" />
              <TextInput value={navLabels.curated} onChange={v => setNavLabels({ ...navLabels, curated: v })} placeholder="Curated" maxLen={20} />
            </div>
            <div>
              <Label text="BRIEF CTA LABEL" />
              <TextInput value={navLabels.brief} onChange={v => setNavLabels({ ...navLabels, brief: v })} placeholder="Send Your Brief" maxLen={30} />
            </div>
          </div>
        </Section>

        {/* ─── FOOTER ────────────────────────────────────────────────────── */}
        <Section title="Footer microcopy" subtitle="Edition-specific footer text" icon="📝" dirty={!!footDirty} saving={saving === 'footer'} onSave={() => saveSection('footer', footer)}>
          <div style={{ marginBottom: 14 }}>
            <Label text="COPYRIGHT LINE" />
            <TextInput value={footer.copyright} onChange={v => setFooter({ ...footer, copyright: v })} placeholder="© 2026 The Travel Catalogue" />
          </div>
          <div>
            <Label text="SUPPORT EMAIL" />
            <TextInput value={footer.support} onChange={v => setFooter({ ...footer, support: v })} placeholder="journeys@thesafariedition.com" />
          </div>
        </Section>

        <div style={{ marginTop: 24, fontSize: 11, color: T.textDim, textAlign: 'center' }}>
          Changes are live on the public site within ~30 seconds of saving.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REEL ROW — one row in the loading reels list
// ═══════════════════════════════════════════════════════════════════════════════
function ReelRow({ reel, idx, total, onChange, onMove, onRemove }: {
  reel:     LoadingReel;
  idx:      number;
  total:    number;
  onChange: (r: LoadingReel) => void;
  onMove:   (dir: number) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Reorder + position */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 4 }}>
          <button onClick={() => onMove(-1)} disabled={idx === 0} style={{ width: 26, height: 22, background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 4, color: idx === 0 ? T.textDim : T.text, fontSize: 10, cursor: idx === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}>▲</button>
          <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, fontFamily: T.fontSerif }}>{idx + 1}</div>
          <button onClick={() => onMove(1)} disabled={idx === total - 1} style={{ width: 26, height: 22, background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 4, color: idx === total - 1 ? T.textDim : T.text, fontSize: 10, cursor: idx === total - 1 ? 'default' : 'pointer', fontFamily: 'inherit' }}>▼</button>
        </div>

        {/* Video upload */}
        <div style={{ width: 140, flexShrink: 0 }}>
          <MediaUploader value={reel.url} onChange={url => onChange({ ...reel, url })} accept="video/mp4,video/webm,video/quicktime" maxMB={5} kind="video" hint="720p, ~3MB" />
        </div>

        {/* Caption + region + duration */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <Label text="CAPTION (shown over the reel)" />
            <TextInput value={reel.caption} onChange={v => onChange({ ...reel, caption: v })} placeholder="e.g. Reviewing seasonal conditions…" maxLen={80} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <div>
              <Label text="REGION" hint="Plays for travellers selecting this region" />
              <select value={reel.region} onChange={e => onChange({ ...reel, region: e.target.value })} style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
                {REGION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <Label text="MIN DURATION" hint="Seconds" />
              <input type="number" min={2} max={10} value={reel.duration} onChange={e => onChange({ ...reel, duration: Math.max(2, Math.min(10, +e.target.value || 3)) })} style={{ width: '100%', background: T.surface, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 7, padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        <button onClick={onRemove} style={{ width: 28, height: 28, background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', color: T.red, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCE PREVIEW — full-screen player that walks the reels in order
// ═══════════════════════════════════════════════════════════════════════════════
function SequencePreview({ reels, onClose }: { reels: LoadingReel[]; onClose: () => void }) {
  const playable = reels.filter(r => !!r.url);
  const [idx, setIdx] = useState(0);
  const current = playable[idx];

  useEffect(() => {
    if (!current) return;
    const ms = Math.max(2, current.duration) * 1000;
    const t = setTimeout(() => {
      if (idx < playable.length - 1) setIdx(i => i + 1);
      else onClose();
    }, ms);
    return () => clearTimeout(t);
  }, [idx, current, playable.length, onClose]);

  if (!playable.length) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '28px 32px', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.amber, marginBottom: 8 }}>No reels to preview</div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>Upload at least one MP4 to a reel slot, then try again.</div>
          <button onClick={onClose} style={{ marginTop: 16, padding: '8px 16px', background: T.bg3, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '50%', width: 36, height: 36, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
      </div>

      {/* Reel */}
      <video key={current.url ?? ''} src={current.url ?? ''} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Caption overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '60px 40px 60px', background: 'linear-gradient(to top,rgba(0,0,0,0.8) 0%,transparent 100%)', textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', fontFamily: T.fontSerif, letterSpacing: '0.02em', maxWidth: 600, margin: '0 auto', lineHeight: 1.5 }}>{current.caption}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 18 }}>
          {playable.map((_, i) => <div key={i} style={{ width: i === idx ? 22 : 6, height: 4, borderRadius: 2, background: i === idx ? T.gold : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />)}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 10, letterSpacing: '0.1em' }}>PREVIEW · {idx + 1} of {playable.length}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED INPUTS
// ═══════════════════════════════════════════════════════════════════════════════
function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: '0.1em' }}>{text}</div>
      {hint && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, maxLen }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLen?: number }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(maxLen ? e.target.value.slice(0, maxLen) : e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', background: T.bg3, border: `0.5px solid ${T.border}`, color: T.text, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
      {maxLen && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: T.textDim, pointerEvents: 'none' }}>{value.length}/{maxLen}</div>}
    </div>
  );
}
