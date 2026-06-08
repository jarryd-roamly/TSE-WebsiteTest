'use client';
/**
 * JourneyLoadingScreen.tsx — v3 (reverted + extended)
 * ─────────────────────────────────────────────────────────────────────────────
 * Reverted to show selected properties with thumbnails.
 * Duration: 10 000 ms (was 7 000; slightly extended per JD 8 Jun 2026).
 *
 * Layout:
 *   Left  — property cards with thumbnail images, name, nights (stagger in)
 *   Right — journey summary (total nights, departure date, price)
 *           + specialist streaming note
 *   Bottom — gold progress bar (10 s sweep)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Timing ────────────────────────────────────────────────────────────────────
const TOTAL_DURATION    = 10_000;   // ms total
const FADE_IN           = 900;      // ms
const FADE_OUT_START    = 8_600;    // ms before end
const LODGE_FIRST_DELAY = 800;      // ms before first card appears
const LODGE_STAGGER     = 1_600;    // ms between cards
const TEXT_START_DELAY  = 1_200;    // ms before specialist text starts
const CHAR_SPEED        = 30;       // ms per character

// ── Specialist lines pool ─────────────────────────────────────────────────────
const LINES = [
  'Reviewing seasonal conditions and wildlife calendars for your dates…',
  'Cross-referencing room availability against contracted rate cards…',
  'Optimising transfers to minimise travel time between properties…',
  'Applying specialist Knowledge Base notes to your itinerary…',
  'Finalising pricing and preparing your booking record…',
  'Your Journey Specialist will be in touch within the hour.',
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:           '#07080f',
  surface:      'rgba(255,255,255,0.045)',
  surfaceHover: 'rgba(255,255,255,0.07)',
  gold:         '#d4af37',
  goldDim:      'rgba(212,175,55,0.14)',
  goldGlow:     'rgba(212,175,55,0.55)',
  text:         '#f5f0e8',
  textMid:      'rgba(245,240,232,0.58)',
  textDim:      'rgba(245,240,232,0.30)',
  border:       'rgba(255,255,255,0.08)',
};

// ── Supabase ──────────────────────────────────────────────────────────────────
function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CityStay {
  city:        string;
  regionSlug?: string;
  nights:      number;
  hotel?: {
    name:   string;
    image?: string;
    slug?:  string;
  };
}

interface JourneyLoadingProps {
  cityStays?:       CityStay[];
  hotelsByMargin?:  Array<{ name: string; image?: string; region?: string }>;
  checkinDate?:     string;
  nights?:          number;
  grandTotal?:      number;
  fmt?:             (n: number) => string;
  edition?:         { name?: string; accentColor?: string };
  selectedRegions?: string[];
  onComplete:       () => void;
}

// ── Thumbnail component ───────────────────────────────────────────────────────
function Thumb({ src, name }: { src?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  if (!src || err) {
    return (
      <div style={{
        width:           64,
        height:          64,
        flexShrink:      0,
        borderRadius:    8,
        background:      T.goldDim,
        border:          `0.5px solid rgba(212,175,55,0.25)`,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontFamily:      '"Cormorant Garamond", Georgia, serif',
        fontSize:        18,
        color:           'rgba(212,175,55,0.7)',
        letterSpacing:   '0.04em',
        fontWeight:      300,
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      style={{
        width:       64,
        height:      64,
        flexShrink:  0,
        borderRadius: 8,
        objectFit:   'cover',
        display:     'block',
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function JourneyLoadingScreen({
  cityStays       = [],
  hotelsByMargin  = [],
  checkinDate,
  nights          = 0,
  grandTotal      = 0,
  fmt             = (n) => `R ${n.toLocaleString()}`,
  edition,
  selectedRegions = [],
  onComplete,
}: JourneyLoadingProps) {
  const gold = edition?.accentColor ?? T.gold;

  // ── Video background (optional) ──────────────────────────────────────────
  const [videoUrl,   setVideoUrl]   = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const run = async () => {
      const sb = getSb();
      if (!sb) return;
      // Try region-specific first, fall back to global journey-loading
      const primaryRegion = selectedRegions[0] ?? cityStays[0]?.regionSlug ?? '';
      const keys = [`${primaryRegion}-journey`, 'journey-loading'].filter(Boolean);
      const { data } = await sb
        .from('cinematic_videos')
        .select('region, url')
        .in('region', keys);
      const match = data?.find((r) => r.region === `${primaryRegion}-journey`)
                 ?? data?.find((r) => r.region === 'journey-loading');
      if (match?.url) setVideoUrl(match.url);
    };
    run();
  }, [selectedRegions, cityStays]);

  // ── Build lodge list ─────────────────────────────────────────────────────
  const lodges = useMemo(() => {
    if (cityStays.length > 0) {
      return cityStays.slice(0, 6).map((cs) => ({
        name:   cs.hotel?.name ?? cs.city,
        nights: cs.nights,
        image:  cs.hotel?.image ?? null,
        region: cs.city,
      }));
    }
    return hotelsByMargin.slice(0, 6).map((h) => ({
      name:   h.name,
      nights: 3,
      image:  h.image ?? null,
      region: h.region ?? '',
    }));
  }, [cityStays, hotelsByMargin]);

  // ── Animation state ──────────────────────────────────────────────────────
  const [bgOpacity,      setBgOpacity]      = useState(0);
  const [exitOpacity,    setExitOpacity]    = useState(1);
  const [progress,       setProgress]       = useState(0);
  const [visibleLodges,  setVisibleLodges]  = useState(0);
  const [specialistText, setSpecialistText] = useState('');
  const [specialistLine, setSpecialistLine] = useState(0);
  const [textVisible,    setTextVisible]    = useState(false);

  // ── Start sequence ───────────────────────────────────────────────────────
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setBgOpacity(1), 60));

    // Progress bar (update every 80 ms for smooth sweep)
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(tick); return 100; }
        return p + (100 / (TOTAL_DURATION / 80));
      });
    }, 80);

    // Lodge card reveals (staggered)
    lodges.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => setVisibleLodges((v) => Math.max(v, i + 1)),
          LODGE_FIRST_DELAY + i * LODGE_STAGGER,
        ),
      );
    });

    timers.push(setTimeout(() => setTextVisible(true), TEXT_START_DELAY));
    timers.push(setTimeout(() => setExitOpacity(0), FADE_OUT_START));
    timers.push(setTimeout(() => onComplete(), TOTAL_DURATION));

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Specialist text streaming ────────────────────────────────────────────
  useEffect(() => {
    if (!textVisible) return;
    const target = LINES[specialistLine] ?? '';
    let idx = 0;
    const iv = setInterval(() => {
      if (idx >= target.length) {
        clearInterval(iv);
        setTimeout(() => {
          setSpecialistText('');
          setSpecialistLine((l) => Math.min(l + 1, LINES.length - 1));
        }, 1_400);
        return;
      }
      setSpecialistText(target.slice(0, ++idx));
    }, CHAR_SPEED);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textVisible, specialistLine]);

  // ── Departure label ──────────────────────────────────────────────────────
  const departureLabel = useMemo(() => {
    if (!checkinDate) return null;
    try {
      return new Date(checkinDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch { return null; }
  }, [checkinDate]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position:      'fixed',
      inset:         0,
      zIndex:        9999,
      background:    T.bg,
      opacity:       exitOpacity,
      transition:    `opacity ${FADE_IN}ms ease`,
      display:       'flex',
      flexDirection: 'column',
      overflow:      'hidden',
      fontFamily:    '"DM Sans", "Inter", sans-serif',
    }}>
      {/* ── Video background ── */}
      {videoUrl && (
        <video
          ref={videoRef}
          key={videoUrl}
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => { if (videoRef.current) videoRef.current.playbackRate = 0.75; }}
          style={{
            position:  'absolute',
            inset:     0,
            width:     '100%',
            height:    '100%',
            objectFit: 'cover',
            opacity:   bgOpacity * 0.38,
            transition:`opacity ${FADE_IN}ms ease`,
            filter:    'saturate(0.6) brightness(0.5)',
          }}
        />
      )}

      {/* Dark gradient overlays */}
      <div style={{
        position:      'absolute',
        inset:         0,
        background:    'linear-gradient(135deg, rgba(7,8,15,0.85) 0%, rgba(7,8,15,0.55) 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position:      'absolute',
        bottom:        0,
        left:          0,
        right:         0,
        height:        '35%',
        background:    `linear-gradient(to top, ${T.bg} 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Wordmark ── */}
      <div style={{
        position:   'absolute',
        top:        26,
        left:       36,
        opacity:    bgOpacity,
        transition: `opacity ${FADE_IN}ms ease`,
      }}>
        <div style={{
          fontFamily:    '"Cormorant Garamond", Georgia, serif',
          fontSize:      12,
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color:         gold,
          fontWeight:    400,
        }}>
          ✦ {edition?.name ?? 'The Safari Edition'}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{
        position:   'relative',
        flex:       1,
        display:    'flex',
        alignItems: 'center',
        padding:    '72px 48px 0',
        gap:        52,
        opacity:    bgOpacity,
        transition: `opacity ${FADE_IN}ms ease`,
      }}>
        {/* ── LEFT: Property cards ── */}
        <div style={{ flex: '0 0 auto', width: 300 }}>
          <div style={{
            fontSize:      10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color:         T.textDim,
            marginBottom:  18,
          }}>
            Your properties
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lodges.map((lodge, i) => (
              <div
                key={i}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        14,
                  padding:    '10px 14px',
                  background: i < visibleLodges ? T.surface : 'transparent',
                  border:     `0.5px solid ${i < visibleLodges ? 'rgba(212,175,55,0.18)' : 'transparent'}`,
                  borderRadius: 10,
                  opacity:    i < visibleLodges ? 1 : 0,
                  transform:  i < visibleLodges ? 'translateX(0)' : 'translateX(-18px)',
                  transition: 'opacity 700ms ease, transform 700ms ease, background 400ms ease',
                }}
              >
                {/* Thumbnail */}
                <Thumb src={lodge.image} name={lodge.name} />

                {/* Info */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily:   '"Cormorant Garamond", Georgia, serif',
                    fontSize:     15,
                    color:        T.text,
                    fontWeight:   500,
                    lineHeight:   1.25,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                    maxWidth:     180,
                  }}>
                    {lodge.name}
                  </div>
                  <div style={{
                    fontSize:     11,
                    color:        T.textDim,
                    marginTop:    3,
                    letterSpacing:'0.03em',
                  }}>
                    {lodge.nights} night{lodge.nights !== 1 ? 's' : ''}
                    {lodge.region ? ` · ${lodge.region}` : ''}
                  </div>
                </div>

                {/* Gold dot when visible */}
                {i < visibleLodges && (
                  <div style={{
                    width:        6,
                    height:       6,
                    borderRadius: '50%',
                    background:   gold,
                    flexShrink:   0,
                    marginLeft:   'auto',
                    boxShadow:    `0 0 6px ${gold}88`,
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          width:      1,
          alignSelf:  'stretch',
          maxHeight:  340,
          background: `linear-gradient(to bottom, transparent, ${gold}30, transparent)`,
          flexShrink: 0,
        }} />

        {/* ── RIGHT: Summary + specialist text ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Journey summary */}
          <div style={{
            display:       'flex',
            gap:           36,
            marginBottom:  36,
            paddingBottom: 28,
            borderBottom:  `0.5px solid rgba(212,175,55,0.15)`,
          }}>
            {[
              { label: 'Total Nights', value: `${nights}` },
              { label: 'Departure',    value: departureLabel ?? '—' },
              { label: 'Investment',   value: grandTotal ? fmt(grandTotal) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{
                  fontSize:      10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color:         T.textDim,
                  marginBottom:  6,
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontSize:   24,
                  color:      T.text,
                  fontWeight: 400,
                  lineHeight: 1,
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Specialist streaming text */}
          <div style={{
            opacity:    textVisible ? 1 : 0,
            transition: 'opacity 700ms ease',
          }}>
            <div style={{
              fontSize:      10,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color:         gold,
              marginBottom:  12,
              fontWeight:    500,
            }}>
              ✦ &nbsp;Journey Specialist
            </div>
            <div style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize:   19,
              color:      T.textMid,
              lineHeight: 1.65,
              minHeight:  56,
              fontStyle:  'italic',
            }}>
              {specialistText}
              {/* Blinking cursor */}
              <span style={{
                display:       'inline-block',
                width:         1.5,
                height:        '0.82em',
                background:    gold,
                marginLeft:    3,
                verticalAlign: 'middle',
                animation:     'jls3Blink 0.9s step-end infinite',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        position:   'relative',
        padding:    '0 48px 32px',
        opacity:    bgOpacity,
        transition: `opacity ${FADE_IN}ms ease`,
      }}>
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          marginBottom:   8,
        }}>
          <div style={{
            fontSize:      10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color:         T.textDim,
          }}>
            Confirming your journey
          </div>
          <div style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize:   11,
            color:      T.textDim,
            fontStyle:  'italic',
          }}>
            {Math.min(Math.round(progress), 100)}%
          </div>
        </div>

        <div style={{
          height:       2,
          background:   'rgba(245,240,232,0.07)',
          borderRadius: 2,
          overflow:     'hidden',
        }}>
          <div style={{
            height:     '100%',
            width:      `${progress}%`,
            background: `linear-gradient(90deg, ${gold}77, ${gold})`,
            borderRadius: 2,
            transition: 'width 80ms linear',
            boxShadow:  `0 0 8px ${gold}55`,
          }} />
        </div>
      </div>

      {/* Blink keyframe */}
      <style>{`@keyframes jls3Blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
