'use client';
/**
 * JourneyLoadingScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Cinematic pre-checkout transition screen.
 * Appears between "Validate & Pay" → checkout.
 *
 * Changes from previous version:
 *  • Alt video support: fetches both `{region}-journey` AND `{region}-journey-alt`
 *    from cinematic_videos. Randomly picks one per load. Falls back gracefully.
 *  • Duration extended: 7 000 ms → 13 000 ms
 *  • Slower pacing: lodge reveals stagger every ~2.2 s, progress bar 13 s sweep
 *  • Fade transitions: 1 200 ms instead of 600 ms
 *  • Video crossfade: if both primary and alt are present, the unchosen one
 *    is pre-loaded silently so future loads are instant.
 *
 * Props (unchanged — no breaking changes):
 *   itinerary       – current Itinerary object
 *   cityStays       – array of city stay objects
 *   hotelsByMargin  – lodges ranked by margin
 *   checkinDate     – string 'YYYY-MM-DD'
 *   nights          – total nights
 *   grandTotal      – number
 *   fmt             – currency formatter (n: number) => string
 *   edition         – edition config object (name, theme etc.)
 *   selectedRegions – string[] e.g. ['kruger-sabi-sand', 'okavango-delta']
 *   onComplete      – () => void  called after TOTAL_DURATION
 *
 * R2 upload location:
 *   Admin → /admin/cinematic → "Journey Loader" section
 *   Primary:  region slug + '-journey'       e.g. kruger-sabi-sand-journey
 *   Alt:      region slug + '-journey-alt'   e.g. kruger-sabi-sand-journey-alt
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── Timing constants (ms) ─────────────────────────────────────────────────────
const TOTAL_DURATION      = 13_000;   // total screen duration  ← was 7 000
const FADE_IN_DURATION    = 1_200;    // initial bg fade-in     ← was 600
const FADE_OUT_START      = 11_200;   // when to begin exit     ← was 5 800
const LODGE_STAGGER_MS    = 2_200;    // between each lodge card ← was 1 400
const LODGE_FIRST_DELAY   = 1_800;    // before first lodge appears
const NOTES_START_DELAY   = 2_600;    // when specialist copy begins streaming
const NOTES_CHAR_SPEED    = 38;       // ms per character        ← was 22 (slower stream)

// ── Design tokens (match main app) ───────────────────────────────────────────
const T = {
  bg:         '#080818',
  gold:       '#d4af37',
  goldDim:    'rgba(212,175,55,0.12)',
  goldMid:    'rgba(212,175,55,0.35)',
  text:       '#f5f0e8',
  textMid:    'rgba(245,240,232,0.55)',
  textDim:    'rgba(245,240,232,0.28)',
  overlay:    'rgba(8,8,24,0.72)',
  overlayHeavy: 'rgba(8,8,24,0.88)',
};

// ── Specialist copy pool ──────────────────────────────────────────────────────
// One line per lodge-reveal step. If fewer lodges, only first N are shown.
const SPECIALIST_LINES = [
  'Reviewing seasonal conditions and wildlife calendars for your dates…',
  'Cross-referencing room availability with our contracted rate cards…',
  'Optimising transfers between each property for minimal travel time…',
  'Applying specialist notes from our Knowledge Base to your itinerary…',
  'Calculating your total package margin and confirming pricing…',
  'Your Journey Specialist will be assigned within the hour.',
];

// ── Supabase client (reads cinematic_videos table) ────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CityStay {
  city:       string;
  regionSlug: string;
  nights:     number;
  hotel?:     { name: string; image?: string };
}

interface JourneyLoadingProps {
  itinerary?:      { id?: string; title?: string };
  cityStays?:      CityStay[];
  hotelsByMargin?: Array<{ name: string; image?: string; region?: string }>;
  checkinDate?:    string;
  nights?:         number;
  grandTotal?:     number;
  fmt?:            (n: number) => string;
  edition?:        { name?: string; accentColor?: string };
  selectedRegions?: string[];
  onComplete:      () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function JourneyLoadingScreen({
  cityStays = [],
  hotelsByMargin = [],
  checkinDate,
  nights = 0,
  grandTotal = 0,
  fmt = (n) => `R ${n.toLocaleString()}`,
  edition,
  selectedRegions = [],
  onComplete,
}: JourneyLoadingProps) {
  const gold = edition?.accentColor ?? T.gold;

  // ── Video state ──────────────────────────────────────────────────────────
  const [videoUrl,    setVideoUrl]    = useState<string | null>(null);
  const [videoReady,  setVideoReady]  = useState(false);
  const [altPreload,  setAltPreload]  = useState<string | null>(null); // silent preload of the other video
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Animation state ──────────────────────────────────────────────────────
  const [bgOpacity,    setBgOpacity]    = useState(0);
  const [exitOpacity,  setExitOpacity]  = useState(1);
  const [progress,     setProgress]     = useState(0);
  const [visibleLodges, setVisibleLodges] = useState(0);
  const [specialistText, setSpecialistText] = useState('');
  const [specialistLine,  setSpecialistLine]  = useState(0);
  const [textVisible,  setTextVisible]  = useState(false);

  // ── Build lodge display list ─────────────────────────────────────────────
  const lodges = useMemo(() => {
    if (cityStays.length > 0) {
      return cityStays.slice(0, 5).map((cs) => ({
        name:   cs.hotel?.name  ?? cs.city,
        nights: cs.nights,
        image:  cs.hotel?.image ?? null,
        region: cs.city,
      }));
    }
    return hotelsByMargin.slice(0, 5).map((h) => ({
      name:   h.name,
      nights: 3,
      image:  h.image ?? null,
      region: h.region ?? '',
    }));
  }, [cityStays, hotelsByMargin]);

  // ── Derive primary region for video lookup ───────────────────────────────
  const primaryRegion = useMemo(() => {
    if (selectedRegions.length > 0) return selectedRegions[0];
    if (cityStays.length > 0) return cityStays[0]?.regionSlug ?? '';
    return '';
  }, [selectedRegions, cityStays]);

  // ── Fetch video (primary + alt, pick randomly) ───────────────────────────
  useEffect(() => {
    if (!primaryRegion) { setVideoReady(true); return; }
    const run = async () => {
      const sb = getSupabase();
      if (!sb) { setVideoReady(true); return; }

      const primaryKey = `${primaryRegion}-journey`;
      const altKey     = `${primaryRegion}-journey-alt`;

      const { data } = await sb
        .from('cinematic_videos')
        .select('region, url')
        .in('region', [primaryKey, altKey]);

      const primaryRow = data?.find((r) => r.region === primaryKey);
      const altRow     = data?.find((r) => r.region === altKey);

      const primaryUrl = primaryRow?.url ?? null;
      const altUrl     = altRow?.url     ?? null;

      // Random pick — if only one exists, use that one
      const both = [primaryUrl, altUrl].filter(Boolean) as string[];
      if (both.length === 0) { setVideoReady(true); return; }

      const pick = both.length === 2
        ? both[Math.floor(Math.random() * 2)]
        : both[0];

      setVideoUrl(pick);

      // Silently preload the other one so next visit is instant
      const other = both.find((u) => u !== pick) ?? null;
      setAltPreload(other);

      setVideoReady(true);
    };
    run();
  }, [primaryRegion]);

  // ── Start animations once video is ready (or after 400 ms timeout) ───────
  useEffect(() => {
    if (!videoReady) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Fade in background
    timers.push(setTimeout(() => setBgOpacity(1), 80));

    // Progress bar sweep (smooth — updates every 100 ms)
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(progressInterval); return 100; }
        return p + (100 / (TOTAL_DURATION / 100));
      });
    }, 100);

    // Lodge reveals (staggered)
    lodges.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => setVisibleLodges((v) => Math.max(v, i + 1)),
          LODGE_FIRST_DELAY + i * LODGE_STAGGER_MS,
        ),
      );
    });

    // Specialist text streaming
    timers.push(
      setTimeout(() => setTextVisible(true), NOTES_START_DELAY),
    );

    // Fade out and complete
    timers.push(setTimeout(() => setExitOpacity(0), FADE_OUT_START));
    timers.push(setTimeout(() => onComplete(), TOTAL_DURATION));

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(progressInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoReady]);

  // ── Specialist text streaming ─────────────────────────────────────────────
  useEffect(() => {
    if (!textVisible) return;
    const target = SPECIALIST_LINES[specialistLine] ?? '';
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= target.length) {
        clearInterval(interval);
        // Pause, then advance to next line
        setTimeout(() => {
          setSpecialistText('');
          setSpecialistLine((l) => Math.min(l + 1, SPECIALIST_LINES.length - 1));
        }, 1_600);
        return;
      }
      setSpecialistText(target.slice(0, ++idx));
    }, NOTES_CHAR_SPEED);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textVisible, specialistLine]);

  // ── Departure date formatting ─────────────────────────────────────────────
  const departureLabel = useMemo(() => {
    if (!checkinDate) return null;
    try {
      const d = new Date(checkinDate);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return null; }
  }, [checkinDate]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     9999,
        background: T.bg,
        opacity:    exitOpacity,
        transition: `opacity ${FADE_IN_DURATION}ms ease`,
        display:    'flex',
        flexDirection: 'column',
        overflow:   'hidden',
      }}
    >
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
          onCanPlay={() => {
            if (videoRef.current) videoRef.current.playbackRate = 0.75; // subtle slow-mo
          }}
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            opacity:    bgOpacity * 0.45,
            transition: `opacity ${FADE_IN_DURATION}ms ease`,
            filter:     'saturate(0.7) brightness(0.55)',
          }}
        />
      )}

      {/* Silent preload of alt video */}
      {altPreload && (
        <video
          key={`preload-${altPreload}`}
          src={altPreload}
          muted
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

      {/* ── Gradient overlays ── */}
      <div style={{
        position:   'absolute',
        inset:      0,
        background: `linear-gradient(135deg, ${T.overlayHeavy} 0%, rgba(8,8,24,0.5) 60%, ${T.overlay} 100%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position:   'absolute',
        bottom:     0,
        left:       0,
        right:      0,
        height:     '40%',
        background: `linear-gradient(to top, ${T.bg} 0%, transparent 100%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Wordmark / edition name ── */}
      <div style={{
        position:   'absolute',
        top:        28,
        left:       36,
        opacity:    bgOpacity,
        transition: `opacity ${FADE_IN_DURATION}ms ease`,
      }}>
        <div style={{
          fontFamily:    '"Cormorant Garamond", "Cormorant", Georgia, serif',
          fontSize:      13,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color:         gold,
          fontWeight:    400,
        }}>
          ✦ {edition?.name ?? 'The Safari Edition'}
        </div>
      </div>

      {/* ── Main content: two-column ── */}
      <div style={{
        position:       'relative',
        flex:           1,
        display:        'flex',
        alignItems:     'center',
        padding:        '0 40px',
        gap:            48,
        opacity:        bgOpacity,
        transition:     `opacity ${FADE_IN_DURATION}ms ease`,
      }}>
        {/* Left column: lodge timeline */}
        <div style={{ flex: '0 0 auto', width: 320, minWidth: 0 }}>
          <div style={{
            fontFamily:    '"Cormorant Garamond", Georgia, serif',
            fontSize:      11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color:         T.textDim,
            marginBottom:  24,
          }}>
            Your Journey
          </div>

          {lodges.map((lodge, i) => {
            const visible = i < visibleLodges;
            return (
              <div
                key={i}
                style={{
                  display:    'flex',
                  alignItems: 'flex-start',
                  gap:        14,
                  marginBottom: 20,
                  opacity:    visible ? 1 : 0,
                  transform:  visible ? 'translateX(0)' : 'translateX(-16px)',
                  transition: 'opacity 900ms ease, transform 900ms ease',
                }}
              >
                {/* Timeline dot + line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                  <div style={{
                    width:        8,
                    height:       8,
                    borderRadius: '50%',
                    background:   gold,
                    flexShrink:   0,
                    boxShadow:    `0 0 8px ${gold}88`,
                  }} />
                  {i < lodges.length - 1 && (
                    <div style={{
                      width:      1,
                      flex:       1,
                      minHeight:  28,
                      background: `linear-gradient(to bottom, ${gold}44, transparent)`,
                      marginTop:  4,
                    }} />
                  )}
                </div>

                {/* Lodge info */}
                <div style={{ minWidth: 0, paddingBottom: 4 }}>
                  <div style={{
                    fontFamily:    '"Cormorant Garamond", Georgia, serif',
                    fontSize:      16,
                    color:         T.text,
                    fontWeight:    500,
                    lineHeight:    1.2,
                    whiteSpace:    'nowrap',
                    overflow:      'hidden',
                    textOverflow:  'ellipsis',
                    maxWidth:      260,
                  }}>
                    {lodge.name}
                  </div>
                  <div style={{
                    fontSize:   11,
                    color:      T.textDim,
                    marginTop:  3,
                    letterSpacing: '0.04em',
                  }}>
                    {lodge.nights} night{lodge.nights !== 1 ? 's' : ''}
                    {lodge.region ? ` · ${lodge.region}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{
          width:      1,
          alignSelf:  'stretch',
          background: `linear-gradient(to bottom, transparent, ${gold}33, transparent)`,
          flexShrink: 0,
        }} />

        {/* Right column: summary + specialist notes */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Journey summary row */}
          <div style={{
            display:       'flex',
            gap:           32,
            marginBottom:  36,
            paddingBottom: 28,
            borderBottom:  `0.5px solid rgba(212,175,55,0.18)`,
          }}>
            {[
              { label: 'Total Nights', value: `${nights}` },
              { label: 'Departure',    value: departureLabel ?? '—' },
              { label: 'Investment',   value: grandTotal ? fmt(grandTotal) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{
                  fontSize:      10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         T.textDim,
                  marginBottom:  5,
                }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                  fontSize:   22,
                  color:      T.text,
                  fontWeight: 400,
                  lineHeight: 1,
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Specialist streaming note */}
          <div style={{
            opacity:    textVisible ? 1 : 0,
            transition: 'opacity 800ms ease',
          }}>
            <div style={{
              fontSize:      10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color:         gold,
              marginBottom:  12,
              fontWeight:    500,
            }}>
              ✦ &nbsp;Journey Specialist
            </div>
            <div style={{
              fontFamily:  '"Cormorant Garamond", Georgia, serif',
              fontSize:    20,
              color:       T.textMid,
              lineHeight:  1.65,
              minHeight:   64,
              fontStyle:   'italic',
            }}>
              {specialistText}
              {/* Blinking cursor */}
              <span style={{
                display:         'inline-block',
                width:           1.5,
                height:          '0.85em',
                background:      gold,
                marginLeft:      3,
                verticalAlign:   'middle',
                animation:       'jlsBlink 0.9s step-end infinite',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: progress bar ── */}
      <div style={{
        position:   'relative',
        padding:    '0 40px 36px',
        opacity:    bgOpacity,
        transition: `opacity ${FADE_IN_DURATION}ms ease`,
      }}>
        {/* Label */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          marginBottom:   10,
        }}>
          <div style={{
            fontSize:      10,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color:         T.textDim,
          }}>
            Confirming your itinerary
          </div>
          <div style={{
            fontSize:  11,
            color:     T.textDim,
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: 'italic',
          }}>
            {Math.round(progress)}%
          </div>
        </div>

        {/* Track */}
        <div style={{
          height:       2,
          background:   'rgba(245,240,232,0.08)',
          borderRadius: 2,
          overflow:     'hidden',
        }}>
          <div style={{
            height:       '100%',
            width:        `${progress}%`,
            background:   `linear-gradient(90deg, ${gold}88, ${gold})`,
            borderRadius: 2,
            transition:   'width 100ms linear',
            boxShadow:    `0 0 8px ${gold}66`,
          }} />
        </div>
      </div>

      {/* ── Blink keyframe ── */}
      <style>{`
        @keyframes jlsBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
