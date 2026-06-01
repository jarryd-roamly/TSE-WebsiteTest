'use client';

// CinematicVideoAdmin.tsx
// Deploy to: app/admin/cinematic/page.tsx
//
// Uploads MP4 files directly to Cloudflare R2
// Saves region→url mapping to Supabase table: cinematic_videos
// SafariCinematicResearch.jsx reads from this table at runtime
//
// Supabase table (run once):
// CREATE TABLE cinematic_videos (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   region text NOT NULL UNIQUE,
//   url text NOT NULL,
//   label text,
//   updated_at timestamptz DEFAULT now()
// );

import { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const R2_ACCOUNT_ID  = '0e1c19cd5fe02f593ae2071caa30bc49';
const R2_ACCESS_KEY  = '91c1255971f560cfbb69ee9362dbec6a';
const R2_SECRET_KEY  = '9a2828d5a0e0fbac300e77a4bbb97a431566e7d08d595fb161981d2be130399f';
const R2_BUCKET      = 'safari-edition-media';
const R2_PUBLIC_BASE = 'https://pub-e9a9b8d329454195b19ec8971297583a.r2.dev';
const R2_ENDPOINT    = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const REGIONS = [
  { id: 'kruger-sabi-sand', label: 'Sabi Sand',      country: 'South Africa', icon: '🐆', description: 'Leopard territory · Private reserves' },
  { id: 'okavango-delta',   label: 'Okavango Delta', country: 'Botswana',     icon: '🐘', description: 'Aerial waterways · Elephant herds' },
  { id: 'chobe-vic-falls',  label: 'Victoria Falls',  country: 'Zimbabwe',    icon: '💧', description: 'The smoke that thunders' },
  { id: 'cape-town',        label: 'Cape Town',       country: 'South Africa', icon: '🏔', description: 'Table Mountain · City panorama' },
  { id: 'madikwe',          label: 'Madikwe',         country: 'South Africa', icon: '🦏', description: 'Koppie · Elephant · Malaria-free' },
];

// ── AWS Signature V4 for browser
async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function hmac(key: ArrayBuffer | string, msg: string): Promise<ArrayBuffer> {
  const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const ck = await crypto.subtle.importKey('raw', k, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(msg));
}

async function uploadToR2(file: File, key: string, onProgress: (p: number) => void): Promise<string> {
  const buffer = await file.arrayBuffer();
  const now    = new Date();
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

  const signedKeys  = Object.keys(headers).sort();
  const canonHdrs   = signedKeys.map(k => `${k}:${headers[k]}\n`).join('');
  const signedHdrs  = signedKeys.join(';');
  const encodedKey  = key.split('/').map(encodeURIComponent).join('/');

  const canonReq = ['PUT', `/${R2_BUCKET}/${encodedKey}`, '', canonHdrs, signedHdrs, bodyHash].join('\n');
  const scope    = `${dateStamp}/auto/s3/aws4_request`;
  const sts      = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(new TextEncoder().encode(canonReq).buffer)].join('\n');

  const kDate    = await hmac(`AWS4${R2_SECRET_KEY}`, dateStamp);
  const kRegion  = await hmac(kDate, 'auto');
  const kService = await hmac(kRegion, 's3');
  const kSign    = await hmac(kService, 'aws4_request');
  const sigHex   = Array.from(new Uint8Array(await hmac(kSign, sts))).map(b=>b.toString(16).padStart(2,'0')).join('');

  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope}, SignedHeaders=${signedHdrs}, Signature=${sigHex}`;

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

  onProgress(90);
  return `${R2_PUBLIC_BASE}/${key}`;
}

type RegionState = {
  file:     File | null;
  url:      string;
  status:   'idle' | 'uploading' | 'done' | 'error';
  progress: number;
  error:    string;
  existing: string;
};

export default function CinematicVideoAdmin() {
  const [regions, setRegions] = useState<Record<string, RegionState>>(
    Object.fromEntries(REGIONS.map(r => [r.id, { file:null, url:'', status:'idle', progress:0, error:'', existing:'' }]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const update = (id: string, patch: Partial<RegionState>) =>
    setRegions(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleFile = (id: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { update(id, { error:'Must be a video file (MP4)' }); return; }
    if (file.size > 150 * 1024 * 1024)  { update(id, { error:'Max file size is 150MB' }); return; }
    update(id, { file, error:'', status:'idle', url:'' });
  };

  const handleUpload = async (regionId: string) => {
    const state = regions[regionId];
    if (!state.file) return;
    update(regionId, { status:'uploading', progress:10, error:'' });

    try {
      const key = `cinematic/${regionId}.mp4`;
      const url = await uploadToR2(state.file, key, p => update(regionId, { progress: p }));

      // Save to Supabase
      const { error } = await supabase
        .from('cinematic_videos')
        .upsert({ region: regionId, url, label: REGIONS.find(r=>r.id===regionId)?.label }, { onConflict: 'region' });

      if (error) throw new Error(error.message);

      update(regionId, { status:'done', progress:100, url, existing: url });
    } catch (e: any) {
      update(regionId, { status:'error', error: e.message, progress:0 });
    }
  };

  return (
    <div style={{
      minHeight:'100vh', background:'#0a0800',
      fontFamily:"'Jost',sans-serif", padding:'48px 40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=Jost:wght@200;300;400;500&display=swap');
        *{box-sizing:border-box;}
        .cv-card{
          background:#111008; border:1px solid rgba(200,169,110,0.12);
          border-radius:14px; padding:24px 28px;
          display:grid; grid-template-columns:1fr auto;
          gap:20px; align-items:start;
          transition:border-color 0.2s;
          margin-bottom:16px;
        }
        .cv-card:hover{border-color:rgba(200,169,110,0.25);}
        .cv-card.done{border-color:rgba(74,222,128,0.25);}
        .cv-card.uploading{border-color:rgba(200,169,110,0.4);}
        .cv-card.error{border-color:rgba(248,113,113,0.35);}
        .cv-drop{
          border:1.5px dashed rgba(200,169,110,0.2);
          border-radius:8px; padding:18px 20px;
          text-align:center; cursor:pointer;
          transition:all 0.2s; margin-top:12px;
          background:rgba(200,169,110,0.02);
        }
        .cv-drop:hover{border-color:rgba(200,169,110,0.5);background:rgba(200,169,110,0.05);}
        .cv-drop.has-file{border-color:rgba(200,169,110,0.45);background:rgba(200,169,110,0.06);}
        .cv-btn{
          display:inline-flex;align-items:center;justify-content:center;gap:8px;
          padding:10px 22px;border:1px solid rgba(200,169,110,0.8);border-radius:6px;
          color:rgba(200,169,110,0.9);background:transparent;cursor:pointer;
          font-family:'Jost',sans-serif;font-size:10px;font-weight:400;
          letter-spacing:0.2em;text-transform:uppercase;
          transition:all 0.2s;white-space:nowrap;
        }
        .cv-btn:hover{background:rgba(200,169,110,0.1);}
        .cv-btn:disabled{opacity:0.35;cursor:not-allowed;}
        .cv-btn.primary{background:rgba(200,169,110,0.9);color:#0a0800;border-color:transparent;}
        .cv-btn.primary:hover{background:rgba(200,169,110,1);}
        .cv-prog{height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin-top:10px;overflow:hidden;}
        .cv-prog-fill{height:100%;background:rgba(200,169,110,0.8);border-radius:1px;transition:width 0.3s ease;}
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:40 }}>
        <div style={{ width:16,height:16,border:'1.5px solid rgba(200,169,110,0.8)',transform:'rotate(45deg)',position:'relative',flexShrink:0 }}>
          <div style={{ position:'absolute',inset:3,background:'rgba(200,169,110,0.8)' }}/>
        </div>
        <div>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif",fontWeight:300,fontSize:28,color:'#fff',margin:0 }}>
            Cinematic <span style={{ color:'rgba(200,169,110,0.9)',fontStyle:'italic' }}>Video Manager</span>
          </h1>
          <p style={{ margin:'4px 0 0',fontSize:10,letterSpacing:'0.35em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)' }}>
            Upload one MP4 per region · Max 150MB · Served from Cloudflare R2
          </p>
        </div>
      </div>

      <p style={{ fontSize:12,color:'rgba(255,255,255,0.35)',lineHeight:1.7,marginBottom:36,maxWidth:600,fontWeight:300 }}>
        These videos play on the cinematic loading screen between the Socratic flow and the itinerary builder.
        Each clip should be <strong style={{color:'rgba(200,169,110,0.7)',fontWeight:400}}>8–12 seconds</strong>, landscape, no audio needed. 
        Upload the best 8-second window of a region-specific video — trim before uploading.
      </p>

      {REGIONS.map(region => {
        const state = regions[region.id];
        const cardClass = `cv-card ${state.status !== 'idle' ? state.status : state.existing ? 'done' : ''}`;

        return (
          <div key={region.id} className={cardClass}>
            <div>
              {/* Region header */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
                <span style={{ fontSize:22 }}>{region.icon}</span>
                <div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif",fontWeight:300,fontSize:22,color:'#fff',lineHeight:1 }}>
                    {region.label}
                  </div>
                  <div style={{ fontSize:10,letterSpacing:'0.3em',textTransform:'uppercase',color:'rgba(200,169,110,0.7)',marginTop:2 }}>
                    {region.country}
                  </div>
                </div>
                {(state.status === 'done' || state.existing) && (
                  <div style={{ marginLeft:'auto',fontSize:10,color:'#4ade80',letterSpacing:'0.15em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:5 }}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:'#4ade80'}}/>
                    Uploaded
                  </div>
                )}
              </div>
              <p style={{ fontSize:11,color:'rgba(255,255,255,0.3)',margin:'0 0 0 34px',fontStyle:'italic' }}>
                {region.description}
              </p>

              {/* Current URL if exists */}
              {state.existing && (
                <div style={{ margin:'10px 0 0 34px',fontSize:10,color:'rgba(255,255,255,0.25)',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'90%' }}>
                  {state.existing}
                </div>
              )}

              {/* Drop zone */}
              <div
                className={`cv-drop ${state.file ? 'has-file' : ''}`}
                style={{ marginLeft:34 }}
                onClick={() => fileRefs.current[region.id]?.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); handleFile(region.id, e.dataTransfer.files[0]||null); }}
              >
                <input
                  ref={el => { fileRefs.current[region.id] = el; }}
                  type="file" accept="video/mp4,video/*"
                  style={{ display:'none' }}
                  onChange={e => handleFile(region.id, e.target.files?.[0]||null)}
                />
                {state.file ? (
                  <div>
                    <div style={{ fontSize:12,color:'rgba(200,169,110,0.9)',fontWeight:400 }}>
                      {state.file.name}
                    </div>
                    <div style={{ fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:3 }}>
                      {(state.file.size/1024/1024).toFixed(1)}MB · click to change
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:11,color:'rgba(255,255,255,0.35)' }}>
                      Drop MP4 here or <span style={{color:'rgba(200,169,110,0.7)'}}>click to browse</span>
                    </div>
                    <div style={{ fontSize:10,color:'rgba(255,255,255,0.2)',marginTop:4 }}>
                      8–12 seconds · Max 150MB
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {state.status === 'uploading' && (
                <div className="cv-prog" style={{marginLeft:34}}>
                  <div className="cv-prog-fill" style={{width:`${state.progress}%`}}/>
                </div>
              )}

              {/* Error */}
              {state.error && (
                <div style={{ marginLeft:34,marginTop:8,fontSize:11,color:'#f87171' }}>
                  {state.error}
                </div>
              )}

              {/* Success URL */}
              {state.status === 'done' && state.url && (
                <div style={{ marginLeft:34,marginTop:8,fontSize:10,color:'#4ade80' }}>
                  ✓ Live at: <span style={{fontFamily:'monospace',color:'rgba(255,255,255,0.4)'}}>{state.url}</span>
                </div>
              )}
            </div>

            {/* Upload button */}
            <button
              className={`cv-btn ${state.file ? 'primary' : ''}`}
              disabled={!state.file || state.status === 'uploading'}
              onClick={() => handleUpload(region.id)}
            >
              {state.status === 'uploading'
                ? `${state.progress}%`
                : state.status === 'done'
                  ? 'Replace'
                  : 'Upload'}
            </button>
          </div>
        );
      })}

      <div style={{ marginTop:32,padding:'20px 24px',background:'rgba(200,169,110,0.04)',border:'1px solid rgba(200,169,110,0.1)',borderRadius:10 }}>
        <div style={{ fontSize:10,letterSpacing:'0.3em',textTransform:'uppercase',color:'rgba(200,169,110,0.6)',marginBottom:8 }}>
          After uploading
        </div>
        <p style={{ fontSize:11,color:'rgba(255,255,255,0.3)',lineHeight:1.8,margin:0,fontWeight:300 }}>
          Videos are served from Cloudflare R2 at full quality with global CDN. 
          The cinematic screen reads from the <code style={{color:'rgba(200,169,110,0.7)'}}>cinematic_videos</code> Supabase table at runtime — 
          no code changes needed after upload. Updates are live immediately.
        </p>
      </div>
    </div>
  );
}
