'use client';
/**
 * app/admin/cinematic/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the single video that plays on the Journey Loading Screen —
 * the 13-second cinematic shown after "Validate & Pay".
 *
 * Region key in cinematic_videos: 'journey-loading'
 *
 * ALSO UPDATE in JourneyLoadingScreen.tsx — change the Supabase fetch
 * from looking for `${primaryRegion}-journey` to also fall back to
 * 'journey-loading'. Simplest patch in that file:
 *
 *   const { data } = await sb
 *     .from('cinematic_videos')
 *     .select('region, url')
 *     .in('region', [`${primaryRegion}-journey`, 'journey-loading']);
 *   const videoRow = data?.find(r => r.region === `${primaryRegion}-journey`)
 *                 ?? data?.find(r => r.region === 'journey-loading');
 *   setVideoUrl(videoRow?.url ?? null);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Region key ────────────────────────────────────────────────────────────────
const REGION_ID = 'journey-loading';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          '#07080f',
  bg2:         '#0d0e1a',
  surface:     '#12142a',
  surface2:    '#1a1c35',
  gold:        '#d4af37',
  goldDim:     'rgba(212,175,55,0.10)',
  goldMid:     'rgba(212,175,55,0.28)',
  borderGold:  'rgba(212,175,55,0.30)',
  text:        '#f5f0e8',
  textMid:     'rgba(245,240,232,0.55)',
  textDim:     'rgba(245,240,232,0.30)',
  border:      'rgba(255,255,255,0.07)',
  green:       '#4ade80',
  greenDim:    'rgba(74,222,128,0.10)',
  red:         '#f87171',
  redDim:      'rgba(248,113,113,0.10)',
  amber:       '#fbbf24',
  amberDim:    'rgba(251,191,36,0.10)',
};

// ── Supabase ──────────────────────────────────────────────────────────────────
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ── Helper: pill badge ────────────────────────────────────────────────────────
function Pill({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           5,
      padding:       '3px 10px',
      borderRadius:  99,
      background:    bg,
      color,
      fontSize:      10,
      fontWeight:    600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
    }}>
      {children}
    </span>
  );
}

// ── Spec row ──────────────────────────────────────────────────────────────────
function SpecRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div style={{
      display:       'flex',
      justifyContent:'space-between',
      alignItems:    'center',
      padding:       '10px 0',
      borderBottom:  `0.5px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 12, color: T.textDim, letterSpacing: '0.04em' }}>{label}</span>
      <span style={{
        fontSize:   12,
        color:      good === undefined ? T.textMid : good ? T.green : T.red,
        fontWeight: 500,
      }}>{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CinematicAdminPage() {
  const [videoUrl,      setVideoUrl]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [uploadStatus,  setUploadStatus]  = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadProgress,setUploadProgress]= useState(0);
  const [error,         setError]         = useState('');
  const [slow,          setSlow]          = useState(false);
  const [removing,      setRemoving]      = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Load existing video ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await sb
          .from('cinematic_videos')
          .select('url')
          .eq('region', REGION_ID)
          .maybeSingle();
        if (data?.url) setVideoUrl(data.url);
      } catch { /* no row — leave null */ }
      setLoading(false);
    };
    load();
  }, []);

  // ── Speed toggle ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = slow ? 0.5 : 1.0;
  }, [slow, videoUrl]);

  // ── Upload handler ───────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    const valid = ['video/mp4', 'video/quicktime', 'video/mov'];
    if (!valid.includes(file.type)) {
      setError('MP4 or MOV files only'); return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('Max file size is 500 MB'); return;
    }

    setUploadStatus('uploading');
    setUploadProgress(0);
    setError('');

    try {
      const ts  = Date.now();
      const ext = file.name.split('.').pop() ?? 'mp4';
      const key = `cinematic/${REGION_ID}/${ts}.${ext}`;

      // Step 1 — get R2 presigned URL
      const presignRes = await fetch(`/api/r2-presign?key=${encodeURIComponent(key)}`);
      if (!presignRes.ok) throw new Error('Could not get upload URL — check R2 config');
      const { uploadUrl, publicUrl } = await presignRes.json() as { uploadUrl: string; publicUrl: string };

      // Step 2 — upload directly to R2 (XHR for progress tracking)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setUploadProgress(95);

      // Step 3 — upsert to Supabase
      const { error: sbErr } = await sb
        .from('cinematic_videos')
        .upsert({ region: REGION_ID, url: publicUrl }, { onConflict: 'region' });
      if (sbErr) throw new Error(sbErr.message);

      setUploadProgress(100);
      setVideoUrl(publicUrl);
      setUploadStatus('done');
      setTimeout(() => { setUploadStatus('idle'); setUploadProgress(0); }, 3_500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setUploadStatus('error');
    }
  }, []);

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Remove handler ───────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setRemoving(true);
    await sb.from('cinematic_videos').delete().eq('region', REGION_ID);
    setVideoUrl(null);
    setRemoving(false);
    setConfirmRemove(false);
    setUploadStatus('idle');
  };

  // ── File input ref click ─────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:  '100vh',
      background: T.bg,
      padding:    '52px 48px 80px',
      fontFamily: '"DM Sans", "Inter", sans-serif',
    }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 52 }}>
        {/* Eyebrow */}
        <div style={{
          fontSize:      11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color:         T.gold,
          marginBottom:  16,
          fontWeight:    500,
        }}>
          ✦ &nbsp;Admin · Cinematic Media
        </div>

        {/* Main title */}
        <h1 style={{
          fontFamily:  '"Cormorant Garamond", "Cormorant", Georgia, serif',
          fontSize:    52,
          fontWeight:  300,
          color:       T.text,
          margin:      0,
          lineHeight:  1.05,
          letterSpacing: '-0.01em',
        }}>
          You're going on Safari
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize:   14,
          color:      T.textMid,
          lineHeight: 1.7,
          maxWidth:   560,
          marginTop:  16,
          marginBottom: 0,
        }}>
          This video plays full-screen for 13 seconds after a traveller clicks
          "Validate &amp; Pay" — while their itinerary is being confirmed.
          Upload one cinematic clip. The component plays it at 0.75× speed
          automatically, so normal footage looks cinematic without extra editing.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{
        display:   'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap:       36,
        alignItems: 'start',
      }}>
        {/* ── Left: video card ── */}
        <div>
          {loading ? (
            <div style={{
              height:       360,
              background:   T.surface,
              borderRadius: 14,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              color:        T.textDim,
              fontSize:     13,
            }}>
              Loading…
            </div>
          ) : videoUrl ? (
            /* ── Preview state ── */
            <div>
              {/* Video preview */}
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
                <video
                  ref={videoRef}
                  key={videoUrl}
                  src={videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  onCanPlay={() => { if (videoRef.current) videoRef.current.playbackRate = slow ? 0.5 : 1.0; }}
                  style={{
                    width:     '100%',
                    display:   'block',
                    maxHeight: 420,
                    objectFit: 'cover',
                  }}
                />
                {/* Speed badge overlay */}
                <div style={{
                  position:   'absolute',
                  top:        12,
                  right:      12,
                  background: 'rgba(8,8,24,0.75)',
                  backdropFilter: 'blur(8px)',
                  border:     `0.5px solid ${T.border}`,
                  borderRadius: 8,
                  padding:    '5px 10px',
                  fontSize:   11,
                  color:      T.textMid,
                }}>
                  {slow ? '½×' : '¾×'} preview
                </div>

                {/* Live badge */}
                <div style={{
                  position:   'absolute',
                  top:        12,
                  left:       12,
                }}>
                  <Pill color={T.green} bg={T.greenDim}>● Live</Pill>
                </div>
              </div>

              {/* Controls row */}
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' as const }}>
                {/* Replace */}
                <label style={{
                  display:       'inline-flex',
                  alignItems:    'center',
                  gap:           7,
                  padding:       '9px 18px',
                  background:    T.goldDim,
                  border:        `0.5px solid ${T.borderGold}`,
                  borderRadius:  8,
                  color:         T.gold,
                  fontSize:      12,
                  fontWeight:    600,
                  cursor:        uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                  opacity:       uploadStatus === 'uploading' ? 0.6 : 1,
                  letterSpacing: '0.04em',
                  transition:    'all 0.15s',
                }}>
                  ↑ Replace video
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/mov"
                    style={{ display: 'none' }}
                    disabled={uploadStatus === 'uploading'}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                  />
                </label>

                {/* Speed toggle */}
                <button
                  onClick={() => setSlow((s) => !s)}
                  style={{
                    display:    'inline-flex',
                    alignItems: 'center',
                    gap:        7,
                    padding:    '9px 18px',
                    background: slow ? T.goldDim : 'rgba(255,255,255,0.04)',
                    border:     `0.5px solid ${slow ? T.borderGold : T.border}`,
                    borderRadius: 8,
                    color:      slow ? T.gold : T.textMid,
                    fontSize:   12,
                    fontWeight: 500,
                    cursor:     'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {slow ? '← 1× Normal' : '½× Slow preview'}
                </button>

                {/* Remove */}
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  style={{
                    display:    'inline-flex',
                    alignItems: 'center',
                    gap:        7,
                    padding:    '9px 18px',
                    background: confirmRemove ? T.redDim : 'rgba(255,255,255,0.03)',
                    border:     `0.5px solid ${confirmRemove ? 'rgba(248,113,113,0.4)' : T.border}`,
                    borderRadius: 8,
                    color:      confirmRemove ? T.red : T.textDim,
                    fontSize:   12,
                    fontWeight: 500,
                    cursor:     removing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    marginLeft: 'auto',
                  }}
                >
                  {removing ? 'Removing…' : confirmRemove ? '⚠ Confirm remove?' : 'Remove'}
                </button>
              </div>

              {/* Upload progress bar */}
              {uploadStatus === 'uploading' && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    height:       3,
                    background:   'rgba(255,255,255,0.07)',
                    borderRadius: 2,
                    overflow:     'hidden',
                  }}>
                    <div style={{
                      height:     '100%',
                      width:      `${uploadProgress}%`,
                      background: `linear-gradient(90deg, ${T.gold}88, ${T.gold})`,
                      borderRadius: 2,
                      transition: 'width 0.2s ease',
                    }} />
                  </div>
                  <div style={{ marginTop: 7, fontSize: 11, color: T.amber }}>
                    ⏳ Uploading to R2… {uploadProgress}%
                  </div>
                </div>
              )}

              {/* Status messages */}
              {uploadStatus === 'done' && (
                <div style={{ marginTop: 10, fontSize: 12, color: T.green }}>
                  ✓ New video is live — the loading screen will show it immediately.
                </div>
              )}
              {uploadStatus === 'error' && error && (
                <div style={{ marginTop: 10, fontSize: 12, color: T.red, lineHeight: 1.6 }}>
                  ⚠ {error}
                </div>
              )}

              {/* URL (small) */}
              <div style={{
                marginTop:     12,
                fontSize:      10,
                color:         'rgba(245,240,232,0.18)',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                whiteSpace:    'nowrap' as const,
              }}>
                {videoUrl}
              </div>
            </div>
          ) : (
            /* ── Empty / upload state ── */
            <div>
              <label
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  justifyContent:'center',
                  gap:           16,
                  height:        340,
                  background:    T.surface,
                  border:        `1.5px dashed ${T.goldMid}`,
                  borderRadius:  14,
                  cursor:        uploadStatus === 'uploading' ? 'not-allowed' : 'pointer',
                  transition:    'border-color 0.2s, background 0.2s',
                }}
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <div style={{ fontSize: 32 }}>⏳</div>
                    <div style={{ fontSize: 14, color: T.textMid }}>Uploading to R2…</div>
                    {/* Progress bar */}
                    <div style={{ width: 240 }}>
                      <div style={{
                        height:   3,
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height:   '100%',
                          width:    `${uploadProgress}%`,
                          background: `linear-gradient(90deg, ${T.gold}88, ${T.gold})`,
                          borderRadius: 2,
                          transition: 'width 0.2s ease',
                        }} />
                      </div>
                      <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: T.amber }}>
                        {uploadProgress}%
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      width:        64,
                      height:       64,
                      borderRadius: '50%',
                      background:   T.goldDim,
                      border:       `0.5px solid ${T.borderGold}`,
                      display:      'flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                      fontSize:     26,
                    }}>
                      🎬
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontFamily:  '"Cormorant Garamond", Georgia, serif',
                        fontSize:    20,
                        color:       T.text,
                        marginBottom: 6,
                      }}>
                        Drop your video here
                      </div>
                      <div style={{ fontSize: 12, color: T.textDim }}>
                        or click to browse · MP4 or MOV · up to 500 MB
                      </div>
                    </div>
                    <div style={{
                      padding:      '8px 18px',
                      background:   T.goldDim,
                      border:       `0.5px solid ${T.borderGold}`,
                      borderRadius: 8,
                      fontSize:     12,
                      color:        T.gold,
                      fontWeight:   600,
                      letterSpacing:'0.04em',
                    }}>
                      Upload video
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/mov"
                  style={{ display: 'none' }}
                  disabled={uploadStatus === 'uploading'}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
              </label>

              {/* Error message */}
              {error && (
                <div style={{ marginTop: 12, fontSize: 12, color: T.red, lineHeight: 1.6 }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: spec panel ── */}
        <div style={{
          background:   T.surface,
          border:       `0.5px solid ${T.border}`,
          borderRadius: 14,
          padding:      '28px 24px',
        }}>
          <div style={{
            fontSize:      11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase' as const,
            color:         T.gold,
            marginBottom:  20,
            fontWeight:    500,
          }}>
            ✦ &nbsp;Video spec
          </div>

          <SpecRow label="Format"        value="MP4 or MOV"          />
          <SpecRow label="Ideal length"  value="10 – 25 seconds"      />
          <SpecRow label="Resolution"    value="1080p or 4K"          />
          <SpecRow label="Aspect ratio"  value="16:9 landscape"       />
          <SpecRow label="Audio"         value="Not required (muted)"  />
          <SpecRow label="Playback speed"value="Auto 0.75× on screen" />
          <SpecRow label="Max file size" value="500 MB"               />
          <SpecRow label="Text overlays" value="None — they'll clash"  good={false} />
          <SpecRow label="Hard cuts"     value="Avoid — slow works"    good={false} />

          {/* Tip block */}
          <div style={{
            marginTop:  22,
            padding:    '14px 16px',
            background: T.goldDim,
            border:     `0.5px solid ${T.borderGold}`,
            borderRadius: 9,
            fontSize:   12,
            color:      T.textMid,
            lineHeight: 1.65,
          }}>
            <strong style={{ color: T.gold, display: 'block', marginBottom: 6 }}>
              What works
            </strong>
            Slow drone over savanna at golden hour. Elephant herd at a waterhole, mist rising. Mokoro gliding through reeds. Fire and stars. Close-up of leopard in a tree.
            <br /><br />
            <strong style={{ color: T.gold }}>What doesn't</strong>
            <br />
            Fast cuts, music videos, anything with a logo, anything already used on the landing page.
          </div>

          {/* Where it uploads to */}
          <div style={{
            marginTop:   20,
            paddingTop:  18,
            borderTop:   `0.5px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
              Storage path
            </div>
            <div style={{
              fontSize:   10,
              color:      T.textDim,
              fontFamily: '"Fira Code", "Courier New", monospace',
              lineHeight: 1.6,
              wordBreak:  'break-all' as const,
            }}>
              R2 → cinematic/journey-loading/{'{timestamp}'}.mp4
              <br /><br />
              Supabase → cinematic_videos<br />
              region: "journey-loading"
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: context note ── */}
      <div style={{
        marginTop:    52,
        padding:      '24px 28px',
        background:   T.surface,
        border:       `0.5px solid ${T.border}`,
        borderRadius: 12,
        display:      'flex',
        gap:          20,
        alignItems:   'flex-start',
      }}>
        <div style={{
          fontSize:     20,
          flexShrink:   0,
          marginTop:    2,
        }}>
          🎬
        </div>
        <div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 5 }}>
            When does this play?
          </div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, maxWidth: 620 }}>
            After the traveller clicks <strong style={{ color: T.text }}>Validate &amp; Pay</strong> on the
            builder — before the checkout form loads. It runs for 13 seconds
            while the platform validates their itinerary, prices all pillars, and
            prepares the booking record. The video loops for the full duration.
            If no video is uploaded, the screen runs on a dark background with
            the lodge timeline and specialist notes only — nothing breaks.
          </div>
        </div>
      </div>
    </div>
  );
}
