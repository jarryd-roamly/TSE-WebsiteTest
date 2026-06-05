'use client';
// app/admin/region-video/page.tsx
// Fixed: two-button speed toggle (1× | ½×), consistent speed application
// Added: Save button for manual URL entry
// Fixed: Cinematic Planner now reads -journey slugs (separate from Plan My Journey)

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const T = {
  bg:'#0a0a0a', surface:'#141414', surface2:'#1a1a1a',
  gold:'#d4af37', goldLight:'#f0c040', goldDim:'rgba(212,175,55,0.12)',
  borderGold:'rgba(212,175,55,0.28)', border:'rgba(255,255,255,0.07)',
  text:'#f5f0e8', textMid:'rgba(245,240,232,0.58)', textDim:'rgba(245,240,232,0.32)',
  green:'#4ade80', red:'#f87171', amber:'#fbbf24',
};

// ── R2 credentials ────────────────────────────────────────────────────────────
const R2_ACCOUNT_ID  = '0e1c19cd5fe02f593ae2071caa30bc49';
const R2_ACCESS_KEY  = '91c1255971f560cfbb69ee9362dbec6a';
const R2_SECRET_KEY  = '9a2828d5a0e0fbac300e77a4bbb97a431566e7d08d595fb161981d2be130399f';
const R2_BUCKET      = 'safari-edition-media';
const R2_PUBLIC_BASE = 'https://pub-e9a9b8d329454195b19ec8971297583a.r2.dev';
const R2_ENDPOINT    = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ── AWS Signature V4 ──────────────────────────────────────────────────────────
async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function hmac(key: ArrayBuffer | string, msg: string): Promise<ArrayBuffer> {
  const k  = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const ck = await crypto.subtle.importKey('raw', k, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(msg));
}
async function uploadToR2(file: File, key: string): Promise<string> {
  const buffer    = await file.arrayBuffer();
  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g,'').slice(0,15) + 'Z';
  const dateStamp = amzDate.slice(0,8);
  const host      = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const bodyHash  = await sha256(buffer);
  const headers: Record<string,string> = {
    'host': host, 'x-amz-date': amzDate,
    'x-amz-content-sha256': bodyHash, 'content-type': 'video/mp4',
    'cache-control': 'public, max-age=31536000',
  };
  const signedKeys = Object.keys(headers).sort();
  const canonHdrs  = signedKeys.map(k => `${k}:${headers[k]}\n`).join('');
  const signedHdrs = signedKeys.join(';');
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const canonReq   = ['PUT', `/${R2_BUCKET}/${encodedKey}`, '', canonHdrs, signedHdrs, bodyHash].join('\n');
  const scope      = `${dateStamp}/auto/s3/aws4_request`;
  const sts        = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(new TextEncoder().encode(canonReq).buffer)].join('\n');
  const kDate    = await hmac(`AWS4${R2_SECRET_KEY}`, dateStamp);
  const kRegion  = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  const kSign    = await hmac(kService, 'aws4_request');
  const sigHex   = Array.from(new Uint8Array(await hmac(kSign, sts))).map(b => b.toString(16).padStart(2,'0')).join('');
  const auth     = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope}, SignedHeaders=${signedHdrs}, Signature=${sigHex}`;
  const res = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${encodedKey}`, {
    method: 'PUT',
    headers: { 'x-amz-date': amzDate, 'x-amz-content-sha256': bodyHash, 'content-type': 'video/mp4', 'cache-control': 'public, max-age=31536000', 'Authorization': auth },
    body: buffer,
  });
  if (!res.ok) { const txt = await res.text(); throw new Error(`R2: ${res.status} — ${txt.slice(0,160)}`); }
  return `${R2_PUBLIC_BASE}/${key}`;
}

// ── Region config ─────────────────────────────────────────────────────────────
const REGIONS = [
  { slug: 'kruger-sabi-sand', label: 'Kruger / Sabi Sand',    country: 'South Africa', accent: '#C8A96E', tagline: 'Where leopards walk at noon'          },
  { slug: 'okavango-delta',   label: 'Okavango Delta',         country: 'Botswana',     accent: '#7EB8A0', tagline: 'A river that flows into the sky'       },
  { slug: 'chobe-vic-falls',  label: 'Chobe / Victoria Falls', country: 'Zimbabwe',     accent: '#8FC4D4', tagline: 'The smoke that thunders'               },
  { slug: 'cape-town',        label: 'Cape Town',              country: 'South Africa', accent: '#B8C4A0', tagline: 'Where two oceans meet the mountain'    },
  { slug: 'madikwe',          label: 'Madikwe',                country: 'South Africa', accent: '#C8A96E', tagline: 'Big Five. Malaria-free. Unforgettable' },
];
const toJourneySlug = (slug: string) => `${slug}-journey`;

// ── Save URL to DB ─────────────────────────────────────────────────────────────
async function saveUrlToDB(region: string, url: string): Promise<void> {
  const res  = await fetch('/api/region-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region, url }),
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { throw new Error(text.slice(0,120) || `Error ${res.status}`); }
  if (!res.ok) throw new Error(data.error || 'Save failed');
}

// ── VideoCard ─────────────────────────────────────────────────────────────────
function VideoCard({ slug, label, country, accent, tagline, videoUrl, status, err, onUpload, onRemove, onSaveUrl }: {
  slug: string; label: string; country: string; accent: string; tagline: string;
  videoUrl: string; status: string; err: string;
  onUpload:  (slug: string, file: File)   => void;
  onRemove:  (slug: string)               => void;
  onSaveUrl: (slug: string, url: string)  => void;
}) {
  // Speed — 1 = normal, 0.5 = half
  const [rate,     setRate]     = useState(1);
  const [urlInput, setUrlInput] = useState(videoUrl);
  const [saveMsg,  setSaveMsg]  = useState('');
  const vidRef = useRef<HTMLVideoElement>(null);

  // Keep urlInput in sync when videoUrl changes (after upload/save)
  useEffect(() => { setUrlInput(videoUrl); }, [videoUrl]);

  // Apply speed — called on every relevant video event and on button click
  const applyRate = (r: number) => {
    if (vidRef.current) {
      vidRef.current.playbackRate = r;
    }
  };

  const handleSetRate = (r: number) => {
    setRate(r);
    applyRate(r);
    // Retry after short delay — some browsers need the video to be playing first
    setTimeout(() => applyRate(r), 150);
    setTimeout(() => applyRate(r), 500);
  };

  const handleVideoEvent = () => applyRate(rate);

  const handleSaveUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || trimmed === videoUrl) return;
    try {
      await onSaveUrl(slug, trimmed);
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    }
  };

  return (
    <div style={{ background: T.surface2, border: `0.5px solid ${videoUrl ? 'rgba(212,175,55,0.2)' : T.border}`, borderRadius: 12, overflow: 'hidden' }}>

      {/* Thumbnail */}
      <div style={{ height: 175, position: 'relative', background: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {videoUrl ? (
          <video
            ref={vidRef}
            key={videoUrl}
            src={videoUrl}
            autoPlay muted loop playsInline
            onCanPlay={handleVideoEvent}
            onPlay={handleVideoEvent}
            onLoadedData={handleVideoEvent}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: T.textDim }}>
            <div style={{ fontSize: 26, marginBottom: 5 }}>🎬</div>
            <div style={{ fontSize: 11 }}>No video yet</div>
          </div>
        )}

        {/* Gradient + labels */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
          <div style={{ fontSize: 8, color: accent, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 3 }}>{country}</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 300, color: 'rgba(245,240,232,0.95)' }}>{label}</div>
          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.38)', marginTop: 2, fontStyle: 'italic' }}>{tagline}</div>
        </div>

        {/* Live badge */}
        {videoUrl && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <span style={{ background: 'rgba(74,222,128,0.12)', border: '0.5px solid rgba(74,222,128,0.3)', color: T.green, borderRadius: 20, padding: '2px 8px', fontSize: 9 }}>● Live</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 13px' }}>

        {/* Row 1: Upload + Speed buttons + Remove */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 10 }}>

          {/* Upload */}
          <label style={{ background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, color: '#0a0a0a', borderRadius: 7, padding: '7px 13px', fontSize: 11, fontWeight: 700, cursor: status === 'uploading' ? 'not-allowed' : 'pointer', opacity: status === 'uploading' ? 0.7 : 1, flexShrink: 0 }}>
            {status === 'uploading' ? '⏳ Uploading…' : status === 'done' ? '✓ Uploaded' : videoUrl ? 'Replace' : 'Upload MP4'}
            <input type="file" accept="video/mp4,video/quicktime,video/mov" style={{ display: 'none' }} disabled={status === 'uploading'} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(slug, f); e.target.value = ''; }} />
          </label>

          {/* Speed: two buttons side by side */}
          {videoUrl && (
            <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: `0.5px solid rgba(255,255,255,0.12)`, flexShrink: 0 }}>
              <button
                onClick={() => handleSetRate(1)}
                style={{ padding: '7px 14px', border: 'none', borderRight: `0.5px solid rgba(255,255,255,0.12)`, background: rate === 1 ? T.goldDim : 'rgba(255,255,255,0.03)', color: rate === 1 ? T.gold : T.textMid, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: rate === 1 ? 600 : 300, transition: 'all 0.15s' }}
              >1×</button>
              <button
                onClick={() => handleSetRate(0.5)}
                style={{ padding: '7px 14px', border: 'none', background: rate === 0.5 ? T.goldDim : 'rgba(255,255,255,0.03)', color: rate === 0.5 ? T.gold : T.textMid, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: rate === 0.5 ? 600 : 300, transition: 'all 0.15s' }}
              >½×</button>
            </div>
          )}

          {/* Remove */}
          {videoUrl && (
            <button onClick={() => onRemove(slug)} style={{ background: 'rgba(248,113,113,0.05)', border: '0.5px solid rgba(248,113,113,0.18)', color: T.red, borderRadius: 7, padding: '7px 12px', cursor: 'pointer', fontSize: 11 }}>
              Remove
            </button>
          )}
        </div>

        {/* Row 2: URL field + Save button */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="Paste video URL and click Save"
            style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: `0.5px solid rgba(255,255,255,0.1)`, color: T.text, borderRadius: 6, padding: '7px 10px', fontSize: 10, fontFamily: 'inherit', outline: 'none', minWidth: 0, letterSpacing: '0.02em' }}
          />
          <button
            onClick={handleSaveUrl}
            disabled={!urlInput.trim() || urlInput.trim() === videoUrl}
            style={{ background: (!urlInput.trim() || urlInput.trim() === videoUrl) ? 'rgba(255,255,255,0.03)' : T.goldDim, border: `0.5px solid ${(!urlInput.trim() || urlInput.trim() === videoUrl) ? 'rgba(255,255,255,0.08)' : T.borderGold}`, color: (!urlInput.trim() || urlInput.trim() === videoUrl) ? T.textDim : T.gold, borderRadius: 6, padding: '7px 14px', cursor: (!urlInput.trim() || urlInput.trim() === videoUrl) ? 'default' : 'pointer', fontSize: 11, fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap' as const, transition: 'all 0.15s', flexShrink: 0 }}
          >
            Save
          </button>
        </div>

        {/* Status messages */}
        {status === 'uploading' && <div style={{ marginTop: 8, fontSize: 10, color: T.amber }}>⏳ Uploading direct to R2…</div>}
        {status === 'done'      && <div style={{ marginTop: 8, fontSize: 10, color: T.green }}>✓ Uploaded and live</div>}
        {saveMsg                && <div style={{ marginTop: 6, fontSize: 10, color: saveMsg.startsWith('Error') ? T.red : T.green }}>{saveMsg}</div>}
        {err                    && <div style={{ marginTop: 6, fontSize: 10, color: T.red }}>{err}</div>}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ title, sub, color }: { title: string; sub: string; color: string }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `0.5px solid rgba(255,255,255,0.06)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 3, height: 20, background: color, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 300, color: T.text }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.7, paddingLeft: 13, maxWidth: 600 }}>{sub}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RegionMediaPage() {
  const [videos,  setVideos]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Record<string, 'idle'|'uploading'|'done'|'error'>>({});
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await sb.from('cinematic_videos').select('region,url');
      if (data) setVideos(Object.fromEntries(data.map((r: any) => [r.region, r.url])));
      setLoading(false);
    })();
  }, []);

  const handleUpload = async (slug: string, file: File) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/mov'];
    if (!validTypes.includes(file.type)) { setErrors(e => ({ ...e, [slug]: 'MP4 or MOV only' })); return; }
    if (file.size > 500 * 1024 * 1024)   { setErrors(e => ({ ...e, [slug]: 'Max 500MB' })); return; }

    setUploads(u => ({ ...u, [slug]: 'uploading' }));
    setErrors(e => ({ ...e, [slug]: '' }));

    try {
      const ts  = Date.now();
      const ext = file.name.split('.').pop() || 'mp4';
      const url = await uploadToR2(file, `cinematic/${slug}/${ts}.${ext}`);
      await saveUrlToDB(slug, url);
      setVideos(v => ({ ...v, [slug]: url }));
      setUploads(u => ({ ...u, [slug]: 'done' }));
      setTimeout(() => setUploads(u => ({ ...u, [slug]: 'idle' })), 4000);
    } catch (e: any) {
      setErrors(er => ({ ...er, [slug]: e.message }));
      setUploads(u => ({ ...u, [slug]: 'error' }));
    }
  };

  const handleSaveUrl = async (slug: string, url: string) => {
    await saveUrlToDB(slug, url);
    setVideos(v => ({ ...v, [slug]: url }));
  };

  const handleRemove = async (slug: string) => {
    if (!confirm(`Remove video for "${slug}"?`)) return;
    await fetch('/api/region-video', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region: slug }) });
    setVideos(v => { const n = { ...v }; delete n[slug]; return n; });
  };

  const cp = (slug: string) => ({
    videoUrl:   videos[slug]  || '',
    status:     uploads[slug] || 'idle',
    err:        errors[slug]  || '',
    onUpload:   handleUpload,
    onRemove:   handleRemove,
    onSaveUrl:  handleSaveUrl,
  });

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Jost',sans-serif", color: T.text }}>
      <div style={{ maxWidth: 1020, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 44 }}>
          <a href="/admin" style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.14em', textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>← Admin</a>
          <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.3em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Admin · Region Media</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 300, marginBottom: 10 }}>Region Videos</div>
          <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.7, maxWidth: 600 }}>
            Two separate video sets — upload different clips to each screen. Use <strong style={{ color: T.text, fontWeight: 400 }}>Upload MP4</strong> to upload a file, or paste an external URL into the field and click <strong style={{ color: T.text, fontWeight: 400 }}>Save</strong>.
          </div>
          <div style={{ marginTop: 14, padding: '10px 16px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 8, fontSize: 12, color: T.gold, lineHeight: 1.65 }}>
            ✦ &nbsp;Speed buttons: <strong>1×</strong> plays at normal speed · <strong>½×</strong> plays at half speed. The highlighted button shows which speed is active. Files upload directly to R2 — no size limit.
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 60, color: T.textDim }}>Loading…</div>}

        {!loading && (
          <>
            {/* SECTION 1: PLAN MY JOURNEY */}
            <div style={{ marginBottom: 60 }}>
              <SectionHead
                title="Plan My Journey — Destination Panel"
                sub="Plays in the right panel as the traveller selects a destination. Wide landscape clips work best."
                color={T.gold}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 14 }}>
                {REGIONS.map(r => (
                  <VideoCard key={r.slug} slug={r.slug} label={r.label} country={r.country} accent={r.accent} tagline={r.tagline} {...cp(r.slug)} />
                ))}
              </div>
            </div>

            {/* SECTION 2: CINEMATIC PLANNER */}
            <div>
              <SectionHead
                title="Cinematic Planner — Full Screen"
                sub="Plays full-screen while the AI builds the itinerary. Upload different clips here — the Cinematic Planner reads these first, falling back to the Destination Panel clips only if no Cinematic clip is uploaded."
                color="#60a5fa"
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(285px,1fr))', gap: 14 }}>
                {REGIONS.map(r => {
                  const js = toJourneySlug(r.slug);
                  return <VideoCard key={js} slug={js} label={r.label} country={r.country} accent="#60a5fa" tagline="Cinematic loader" {...cp(js)} />;
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
