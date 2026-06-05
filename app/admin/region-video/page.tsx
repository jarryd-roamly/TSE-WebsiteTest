'use client';
// app/admin/region-video/page.tsx
// Fixed: uploads direct to R2 (bypasses Vercel 4.5MB limit)
// Added: ½× speed toggle per video card

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const T = {
  bg:'#0a0a0a', surface:'#1a1a1a', bg3:'#181818',
  gold:'#d4af37', goldLight:'#f0c040', goldDim:'rgba(212,175,55,0.12)',
  borderGold:'rgba(212,175,55,0.28)', border:'rgba(255,255,255,0.07)',
  text:'#f5f0e8', textMid:'rgba(245,240,232,0.58)', textDim:'rgba(245,240,232,0.32)',
  green:'#4ade80', red:'#f87171', amber:'#fbbf24',
};

// ── R2 credentials (same bucket as cinematic page) ───────────────────────────
const R2_ACCOUNT_ID  = '0e1c19cd5fe02f593ae2071caa30bc49';
const R2_ACCESS_KEY  = '91c1255971f560cfbb69ee9362dbec6a';
const R2_SECRET_KEY  = '9a2828d5a0e0fbac300e77a4bbb97a431566e7d08d595fb161981d2be130399f';
const R2_BUCKET      = 'safari-edition-media';
const R2_PUBLIC_BASE = 'https://pub-e9a9b8d329454195b19ec8971297583a.r2.dev';
const R2_ENDPOINT    = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ── AWS Signature V4 helpers (browser-native crypto) ────────────────────────
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

async function uploadToR2(
  file: File,
  key: string,
  onProgress: (p: number) => void,
): Promise<string> {
  const buffer    = await file.arrayBuffer();
  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g,'').slice(0,15) + 'Z';
  const dateStamp = amzDate.slice(0,8);
  const host      = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const bodyHash  = await sha256(buffer);

  const headers: Record<string,string> = {
    'host':                  host,
    'x-amz-date':            amzDate,
    'x-amz-content-sha256':  bodyHash,
    'content-type':          'video/mp4',
    'cache-control':         'public, max-age=31536000',
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

  onProgress(30);

  const res = await fetch(`${R2_ENDPOINT}/${R2_BUCKET}/${encodedKey}`, {
    method: 'PUT',
    headers: {
      'x-amz-date':           amzDate,
      'x-amz-content-sha256': bodyHash,
      'content-type':         'video/mp4',
      'cache-control':        'public, max-age=31536000',
      'Authorization':        auth,
    },
    body: buffer,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`R2 upload failed: ${res.status} — ${txt.slice(0,200)}`);
  }

  onProgress(85);
  return `${R2_PUBLIC_BASE}/${key}`;
}

// ── Region config ─────────────────────────────────────────────────────────────
const REGIONS = [
  { slug:'kruger-sabi-sand', label:'Kruger / Sabi Sand',   country:'South Africa', accent:'#C8A96E', tagline:'Where leopards walk at noon',           stat:'12 min avg leopard sighting' },
  { slug:'okavango-delta',   label:'Okavango Delta',        country:'Botswana',     accent:'#7EB8A0', tagline:'A river that flows into the sky',        stat:'11,000 km² of wilderness'   },
  { slug:'chobe-vic-falls',  label:'Chobe / Victoria Falls',country:'Zimbabwe',     accent:'#8FC4D4', tagline:'The smoke that thunders',                stat:'108m vertical drop'         },
  { slug:'cape-town',        label:'Cape Town',             country:'South Africa', accent:'#B8C4A0', tagline:'Where two oceans meet the mountain',      stat:'Top 3 most beautiful cities'},
  { slug:'madikwe',          label:'Madikwe',               country:'South Africa', accent:'#C8A96E', tagline:'Big Five. Malaria-free. Unforgettable',   stat:'75,000 hectares'            },
];

const SYSTEM_SLOTS = [
  { slug:'hero',        label:'Landing page hero background', desc:'Full-bleed video behind the landing hero section' },
  { slug:'hero_circle', label:'Landing page circle reel',     desc:'The circular floating video on the landing hero'  },
];

// ── Individual card ───────────────────────────────────────────────────────────
function RegionCard({
  slug, label, country, accent, tagline, stat, desc,
  videoUrl, status, err,
  onUpload, onRemove,
}: {
  slug: string; label: string; country: string; accent: string;
  tagline?: string; stat?: string; desc?: string;
  videoUrl: string; status: string; err: string;
  onUpload: (slug: string, file: File) => void;
  onRemove: (slug: string) => void;
}) {
  const [slow,    setSlow]    = useState(false);
  const [preview, setPreview] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);

  // Apply playback rate whenever slow toggles
  useEffect(() => {
    if (vidRef.current) vidRef.current.playbackRate = slow ? 0.5 : 1;
  }, [slow]);

  // Also set on video load (autoPlay fires before effect)
  const handleCanPlay = () => {
    if (vidRef.current) vidRef.current.playbackRate = slow ? 0.5 : 1;
  };

  return (
    <div style={{ background:T.surface, border:`0.5px solid ${videoUrl ? 'rgba(212,175,55,0.22)' : T.border}`, borderRadius:14, overflow:'hidden' }}>

      {/* Preview strip */}
      <div style={{ height:200, position:'relative', background:'#0f0f0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {videoUrl ? (
          <video
            ref={vidRef}
            key={videoUrl}
            src={videoUrl}
            autoPlay muted loop playsInline
            onCanPlay={handleCanPlay}
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
          />
        ) : (
          <div style={{ textAlign:'center', color:T.textDim }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎬</div>
            <div style={{ fontSize:12 }}>No video uploaded yet</div>
          </div>
        )}

        {/* Overlay */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:12, left:16, right:16 }}>
          <div style={{ fontSize:9, color:accent, letterSpacing:'0.24em', textTransform:'uppercase', marginBottom:4 }}>{country}</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:300, color:'rgba(245,240,232,0.95)', lineHeight:1.2 }}>{label}</div>
          <div style={{ fontSize:11, color:'rgba(245,240,232,0.45)', marginTop:3, fontStyle:'italic' }}>{tagline || desc}</div>
        </div>

        {/* Status badges */}
        {videoUrl && !slow && (
          <div style={{ position:'absolute', top:10, right:10 }}>
            <span style={{ background:'rgba(74,222,128,0.15)', border:'0.5px solid rgba(74,222,128,0.35)', color:T.green, borderRadius:20, padding:'2px 9px', fontSize:10, fontWeight:600 }}>● Live</span>
          </div>
        )}
        {slow && videoUrl && (
          <div style={{ position:'absolute', top:10, right:10 }}>
            <span style={{ background:'rgba(212,175,55,0.15)', border:`0.5px solid ${T.borderGold}`, color:T.gold, borderRadius:20, padding:'2px 9px', fontSize:10, fontWeight:600 }}>½× Slow</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding:'14px 16px' }}>
        {stat && <div style={{ fontSize:10, color:T.textDim, marginBottom:12 }}>Used in: {stat}</div>}

        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' as const }}>

          {/* Upload / Replace */}
          <label style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, color:'#0a0a0a', borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:700, cursor: status === 'uploading' ? 'not-allowed' : 'pointer', flexShrink:0, opacity: status === 'uploading' ? 0.7 : 1 }}>
            {status === 'uploading' ? '⏳ Uploading…' : status === 'done' ? '✓ Uploaded' : videoUrl ? 'Replace video' : 'Upload MP4'}
            <input
              type="file" accept="video/mp4,video/quicktime,video/mov"
              style={{ display:'none' }}
              disabled={status === 'uploading'}
              onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(slug, f); e.target.value = ''; }}
            />
          </label>

          {/* Speed toggle */}
          {videoUrl && (
            <button
              onClick={() => setSlow(s => !s)}
              style={{ background: slow ? T.goldDim : T.bg3, border:`0.5px solid ${slow ? T.borderGold : T.border}`, color: slow ? T.gold : T.textMid, borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:12, transition:'all 0.15s' }}
              title="Toggle slow-motion preview"
            >
              {slow ? '1× Normal' : '½× Slow'}
            </button>
          )}

          {/* Remove */}
          {videoUrl && (
            <button
              onClick={() => onRemove(slug)}
              style={{ background:'rgba(248,113,113,0.06)', border:'0.5px solid rgba(248,113,113,0.2)', color:T.red, borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:12 }}
            >
              Remove
            </button>
          )}
        </div>

        {/* Status messages */}
        {status === 'uploading' && (
          <div style={{ marginTop:10, fontSize:11, color:T.amber }}>
            ⏳ Uploading directly to R2 — large files may take a moment…
          </div>
        )}
        {status === 'done' && (
          <div style={{ marginTop:10, fontSize:11, color:T.green }}>
            ✓ Video live — the Plan My Journey panel will show it immediately
          </div>
        )}
        {err && (
          <div style={{ marginTop:10, fontSize:11, color:T.red, lineHeight:1.5 }}>
            ⚠ {err}
          </div>
        )}
        {videoUrl && (
          <div style={{ marginTop:8, fontSize:10, color:'rgba(245,240,232,0.2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
            {videoUrl}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RegionMediaPage() {
  const [videos,  setVideos]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Record<string, 'idle'|'uploading'|'done'|'error'>>({});
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from('cinematic_videos').select('region,url');
    if (data) setVideos(Object.fromEntries(data.map((r:any) => [r.region, r.url])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (slug: string, file: File) => {
    const validTypes = ['video/mp4','video/quicktime','video/mov'];
    if (!validTypes.includes(file.type)) {
      setErrors(e => ({...e, [slug]: 'MP4 or MOV files only'})); return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setErrors(e => ({...e, [slug]: 'Max file size is 500MB'})); return;
    }

    setUploads(u => ({...u, [slug]:'uploading'}));
    setErrors(e => ({...e, [slug]:''}));

    try {
      // ── Step 1: Upload directly to R2 (bypasses Vercel's 4.5MB limit) ──
      const ts  = Date.now();
      const ext = file.name.split('.').pop() || 'mp4';
      const key = `cinematic/${slug}/${ts}.${ext}`;
      const url = await uploadToR2(file, key, (p) => {
        // progress available here if you want a progress bar later
      });

      // ── Step 2: Tell the API to update the database only (no file involved) ──
      const res = await fetch('/api/region-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: slug, url }),
      });

      // Safe parse — handles non-JSON error responses
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { throw new Error(text.slice(0,120) || `Server error ${res.status}`); }
      if (!res.ok) throw new Error(data.error || 'Database update failed');

      setVideos(v => ({...v, [slug]: url}));
      setUploads(u => ({...u, [slug]:'done'}));
      setTimeout(() => setUploads(u => ({...u, [slug]:'idle'})), 4000);

    } catch (e: any) {
      setErrors(er => ({...er, [slug]: e.message}));
      setUploads(u => ({...u, [slug]:'error'}));
    }
  };

  const handleRemove = async (slug: string) => {
    if (!confirm(`Remove video for ${slug}? This cannot be undone.`)) return;
    await fetch('/api/region-video', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: slug }),
    });
    setVideos(v => { const n = {...v}; delete n[slug]; return n; });
  };

  const cardProps = (slug: string) => ({
    videoUrl: videos[slug] || '',
    status:   uploads[slug] || 'idle',
    err:      errors[slug]  || '',
    onUpload: handleUpload,
    onRemove: handleRemove,
  });

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'Jost',sans-serif", color:T.text }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 20px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom:36 }}>
          <a href="/admin" style={{ fontSize:11, color:T.textDim, letterSpacing:'0.14em', textDecoration:'none', display:'inline-block', marginBottom:20 }}>← Admin</a>
          <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.3em', textTransform:'uppercase' as const, marginBottom:6 }}>Admin · Region Media</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:300, marginBottom:10 }}>Region Cinematic Videos</div>
          <div style={{ fontSize:13, color:T.textDim, lineHeight:1.7, maxWidth:560 }}>
            Upload an MP4 for each region. These play in the right panel of Plan My Journey as travellers select destinations — and in the cinematic loader while the itinerary builds.
          </div>
          <div style={{ marginTop:14, padding:'10px 16px', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, fontSize:12, color:T.gold, lineHeight:1.65 }}>
            ✦ &nbsp;Recommended: 8–20 second landscape clips. Drone, wide vistas, golden hour. Files upload directly to R2 — no size limit applies.
          </div>
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:60, color:T.textDim }}>Loading…</div>
        )}

        {!loading && (
          <>
            {/* Region videos */}
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.22em', textTransform:'uppercase' as const, marginBottom:16 }}>
              Safari Regions — Plan My Journey panel
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(400px,1fr))', gap:16, marginBottom:40 }}>
              {REGIONS.map(r => (
                <RegionCard key={r.slug} {...r} {...cardProps(r.slug)} />
              ))}
            </div>

            {/* System slots */}
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.22em', textTransform:'uppercase' as const, marginBottom:16 }}>
              System videos — Landing page
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(400px,1fr))', gap:16 }}>
              {SYSTEM_SLOTS.map(s => (
                <RegionCard
                  key={s.slug} slug={s.slug} label={s.label}
                  country="" accent={T.gold} tagline={s.desc} desc={s.desc}
                  {...cardProps(s.slug)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
