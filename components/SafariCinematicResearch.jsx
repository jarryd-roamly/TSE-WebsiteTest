'use client';

// ═══════════════════════════════════════════════════════════════════════════
// SafariCinematicResearch.jsx
// Replaces the inspire-research screen in page.tsx
//
// HOW TO USE IN page.tsx:
//   1. Import:  import SafariCinematicResearch from '@/components/SafariCinematicResearch'
//   2. Replace the entire {screen==='inspire-research' && (...)} block with:
//
//      {screen === 'inspire-research' && (
//        <SafariCinematicResearch
//          answers={{
//            experience: adults > 1 ? 'returning' : 'first',
//            regions: selectedRegions,          // array of region ids
//            nights,
//            travellers: adults === 1 ? 'solo' : adults === 2 ? 'couple' : `group of ${adults}`,
//            budget: fmt(budget),
//          }}
//          aiReady={itinerary !== null}         // set to true when Claude call resolves
//          onComplete={() => setScreen('builder')}
//        />
//      )}
//
//   3. In runSocraticPlanner / runBriefPlanner, don't call setScreen('builder')
//      directly — set itinerary as normal. The aiReady prop drives the transition.
//      The cinematic plays for a MINIMUM of 16s regardless; if Claude resolves first,
//      it waits. If Claude takes longer than 16s, it waits for Claude.
//
// REGION → CLIP MAPPING:
//   Reads from REGION_CLIPS below. Add/remove regions freely.
//   In production swap the hardcoded video IDs for a Supabase fetch.
//
// AUTOPLAY NOTE:
//   No gate screen. Autoplay fires immediately on mount.
//   This works because the user just clicked "Price & Book" — that interaction
//   satisfies the browser autoplay policy for the current page session.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Region → YouTube clip mapping ───────────────────────────────────────────
// Each region has 2 clips. Format matches your CMS: {video_id, start, end, speed}
// speed is saved but not applied in iframe embeds (requires YT JS API / Stream).
const REGION_CLIPS = {
  'kruger':        [
    { video_id: 'mmLrPy5LdLI', start: 18,  end: 28,  accent: '#C8A96E', name: 'Sabi Sand',       country: 'South Africa', tagline: 'Where leopards walk at noon',          stat: '12 min',    statLabel: 'avg leopard sighting' },
    { video_id: 'OoE3KQycM1U', start: 42,  end: 52,  accent: '#C8A96E', name: 'Sabi Sand',       country: 'South Africa', tagline: 'Where leopards walk at noon',          stat: '12 min',    statLabel: 'avg leopard sighting' },
  ],
  'kruger-sabi-sand': [
    { video_id: 'mmLrPy5LdLI', start: 18,  end: 28,  accent: '#C8A96E', name: 'Sabi Sand',       country: 'South Africa', tagline: 'Where leopards walk at noon',          stat: '12 min',    statLabel: 'avg leopard sighting' },
    { video_id: 'OoE3KQycM1U', start: 42,  end: 52,  accent: '#C8A96E', name: 'Sabi Sand',       country: 'South Africa', tagline: 'Where leopards walk at noon',          stat: '12 min',    statLabel: 'avg leopard sighting' },
  ],
  'okavango':      [
    { video_id: '9rz91N8kmKw', start: 30,  end: 40,  accent: '#7EB8A0', name: 'Okavango Delta',  country: 'Botswana',     tagline: 'A river that flows into the sky',      stat: '11,000 km²', statLabel: 'of pristine wilderness' },
    { video_id: 'eN4qWLmP0fU', start: 55,  end: 65,  accent: '#7EB8A0', name: 'Okavango Delta',  country: 'Botswana',     tagline: 'A river that flows into the sky',      stat: '11,000 km²', statLabel: 'of pristine wilderness' },
  ],
  'okavango-delta': [
    { video_id: '9rz91N8kmKw', start: 30,  end: 40,  accent: '#7EB8A0', name: 'Okavango Delta',  country: 'Botswana',     tagline: 'A river that flows into the sky',      stat: '11,000 km²', statLabel: 'of pristine wilderness' },
    { video_id: 'eN4qWLmP0fU', start: 55,  end: 65,  accent: '#7EB8A0', name: 'Okavango Delta',  country: 'Botswana',     tagline: 'A river that flows into the sky',      stat: '11,000 km²', statLabel: 'of pristine wilderness' },
  ],
  'masai-mara':    [
    { video_id: 'nYTjVzWr_HI', start: 25,  end: 35,  accent: '#D4874A', name: 'Masai Mara',      country: 'Kenya',        tagline: 'The greatest show on earth',           stat: '1.5M',      statLabel: 'wildebeest in migration' },
    { video_id: 'nYTjVzWr_HI', start: 120, end: 130, accent: '#D4874A', name: 'Masai Mara',      country: 'Kenya',        tagline: 'The greatest show on earth',           stat: '1.5M',      statLabel: 'wildebeest in migration' },
  ],
  'chobe-vic-falls': [
    { video_id: 'aQeXOZcluss', start: 12,  end: 22,  accent: '#8FC4D4', name: 'Victoria Falls',  country: 'Zimbabwe',     tagline: 'The smoke that thunders',              stat: '108m',      statLabel: 'of pure vertical power' },
    { video_id: 'Bz5TuUsXPpw', start: 28,  end: 38,  accent: '#8FC4D4', name: 'Victoria Falls',  country: 'Zimbabwe',     tagline: 'The smoke that thunders',              stat: '108m',      statLabel: 'of pure vertical power' },
  ],
  'cape-town':     [
    { video_id: 'T0PvQ4ilQW8', start: 8,   end: 18,  accent: '#B8C4A0', name: 'Cape Town',       country: 'South Africa', tagline: 'Where two oceans meet the mountain',   stat: 'Top 3',     statLabel: 'most beautiful cities' },
    { video_id: 'T0PvQ4ilQW8', start: 25,  end: 35,  accent: '#B8C4A0', name: 'Cape Town',       country: 'South Africa', tagline: 'Where two oceans meet the mountain',   stat: 'Top 3',     statLabel: 'most beautiful cities' },
  ],
  'madikwe':       [
    { video_id: 'PwidugulKtU', start: 5,   end: 15,  accent: '#C8A96E', name: 'Madikwe',         country: 'South Africa', tagline: 'Big Five. Malaria-free. Unforgettable', stat: '75,000',   statLabel: 'hectares of wilderness' },
    { video_id: 'PwidugulKtU', start: 38,  end: 48,  accent: '#C8A96E', name: 'Madikwe',         country: 'South Africa', tagline: 'Big Five. Malaria-free. Unforgettable', stat: '75,000',   statLabel: 'hectares of wilderness' },
  ],
};

// Fallback for 'inspire-me' or unknown slugs
const FALLBACK_CLIPS = REGION_CLIPS['kruger-sabi-sand'];

// ─── Thought sequences ────────────────────────────────────────────────────────
const THOUGHTS_RETURNING = [
  'Reading your travel history…',
  'You\'ve been before — ready for something deeper.',
  'Scanning availability across 23 properties…',
  'Checking seasonal wildlife calendars…',
  'The Sabi Sand leopard population is unusually active right now.',
  'Cross-referencing your budget against contracted net rates…',
  'Identifying date arbitrage — shifting 3 days saves R18,400.',
  'Loading Knowledge Base: 127 specialist notes injected…',
  'Matching lodge character to your preferences…',
  'Detecting arrival gap — suggesting half-day river activity…',
  'Building your personalised itinerary…',
  'Almost there. This one is worth the wait.',
];

const THOUGHTS_FIRST = [
  'First trip to Africa — we\'ll make it unforgettable.',
  'Scanning Southern Africa for the perfect introduction…',
  'Cross-checking Big Five density across 14 private reserves…',
  'The Sabi Sand has three leopard cubs active right now.',
  'Comparing lodge options against your budget…',
  'Checking flight connections from London Heathrow…',
  'Loading Knowledge Base: 127 specialist notes…',
  'Assembling your itinerary…',
  'Running final pricing against contracted net rates…',
  'Your itinerary is almost ready.',
];

// ─── YouTube embed URL builder ────────────────────────────────────────────────
function ytSrc(clip) {
  return (
    `https://www.youtube.com/embed/${clip.video_id}` +
    `?start=${clip.start}&end=${clip.end}` +
    `&autoplay=1&mute=1&controls=0&loop=1` +
    `&playlist=${clip.video_id}` +
    `&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3` +
    `&disablekb=1&fs=0&color=white`
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SafariCinematicResearch({ answers = {}, aiReady = false, onComplete }) {
  const {
    experience = 'returning',
    regions    = [],
    nights     = 7,
    travellers = 'couple',
    budget     = '',
  } = answers;

  // ── Build clip sequence from selected regions (max 2 regions × 1 clip each = ~16s)
  const clips = (() => {
    const validRegions = (regions || []).filter(r => r !== 'inspire-me' && REGION_CLIPS[r]);
    const chosen = validRegions.length > 0 ? validRegions.slice(0, 2) : ['kruger-sabi-sand', 'okavango-delta'];
    const result = [];
    chosen.forEach(slug => {
      const regionClips = REGION_CLIPS[slug] || FALLBACK_CLIPS;
      result.push(regionClips[0]); // one clip per region for the short version
    });
    // If only one region selected, add second clip from same region for visual richness
    if (result.length === 1) {
      const slug = validRegions[0] || 'kruger-sabi-sand';
      result.push((REGION_CLIPS[slug] || FALLBACK_CLIPS)[1]);
    }
    return result;
  })();

  const CLIP_DURATION  = 8000;  // ms per clip
  const MIN_TOTAL      = clips.length * CLIP_DURATION; // ~16s

  const thoughts = experience === 'first' ? THOUGHTS_FIRST : THOUGHTS_RETURNING;

  // ── State
  const [phase,           setPhase]           = useState('cinematic'); // cinematic | thinking | reveal
  const [clipIdx,         setClipIdx]         = useState(0);
  const [activeFrame,     setActiveFrame]     = useState('A');
  const [displayedThoughts, setDisplayedThoughts] = useState([]);
  const [revealProgress,  setRevealProgress]  = useState(0);
  const [cinematicDone,   setCinematicDone]   = useState(false);
  const [titleVisible,    setTitleVisible]    = useState(true);

  const ifrARef     = useRef(null);
  const ifrBRef     = useRef(null);
  const thoughtsRef = useRef(null);
  const timers      = useRef([]);
  const aiReadyRef  = useRef(aiReady);

  // Track aiReady in a ref so async callbacks see latest value
  useEffect(() => { aiReadyRef.current = aiReady; }, [aiReady]);

  const addTimer = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timers.current.push(id);
    return id;
  }, []);

  // ── Cleanup on unmount
  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // ── Load clip into frame
  const loadClip = useCallback((clipIndex, frame) => {
    const clip = clips[clipIndex];
    if (!clip) return;
    const ifr = frame === 'A' ? ifrARef.current : ifrBRef.current;
    if (ifr) ifr.src = ytSrc(clip);
  }, [clips]);

  // ── Cross-fade to next clip
  const crossFadeTo = useCallback((clipIndex) => {
    const incoming = activeFrame === 'A' ? 'B' : 'A';
    loadClip(clipIndex, incoming);

    addTimer(() => {
      setActiveFrame(incoming);
      setClipIdx(clipIndex);
    }, 400);
  }, [activeFrame, loadClip, addTimer]);

  // ── Start thinking phase
  const startThinking = useCallback(() => {
    setPhase('thinking');
    let i = 0;

    const addThought = () => {
      if (i >= thoughts.length) {
        // All thoughts displayed — now wait for AI if not ready
        const checkAndReveal = () => {
          if (aiReadyRef.current) {
            setPhase('reveal');
          } else {
            addTimer(checkAndReveal, 300);
          }
        };
        addTimer(checkAndReveal, 800);
        return;
      }
      setDisplayedThoughts(prev => [...prev, thoughts[i]]);
      if (thoughtsRef.current) {
        thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
      }
      i++;
      addTimer(addThought, 950 + Math.random() * 200);
    };

    addTimer(addThought, 300);
  }, [thoughts, addTimer]);

  // ── Cinematic sequence: 2 clips × 8s, then thinking
  useEffect(() => {
    // Load first clip immediately on mount — autoplay fires because user just clicked
    loadClip(0, 'A');

    // Show title for first 3s then fade
    addTimer(() => setTitleVisible(false), 3000);

    // Crossfade to clip 2 after 8s
    if (clips.length > 1) {
      addTimer(() => {
        setTitleVisible(true); // show new region title
        crossFadeTo(1);
        addTimer(() => setTitleVisible(false), 3000);
      }, CLIP_DURATION);
    }

    // After all clips, transition to thinking
    addTimer(() => {
      setCinematicDone(true);
      startThinking();
    }, MIN_TOTAL);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  // ── Reveal phase: progress bar, then call onComplete
  useEffect(() => {
    if (phase !== 'reveal') return;
    let p = 0;
    const tick = setInterval(() => {
      p += 2.2;
      setRevealProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(tick);
        addTimer(() => onComplete?.(), 500);
      }
    }, 28);
    return () => clearInterval(tick);
  }, [phase, onComplete, addTimer]);

  // ── If AI resolves during cinematic, wait for cinematic to finish before transitioning
  useEffect(() => {
    if (aiReady && phase === 'cinematic' && cinematicDone) {
      setPhase('thinking');
    }
  }, [aiReady, phase, cinematicDone]);

  const currentClip = clips[clipIdx] || clips[0];
  const thoughtProgress = Math.round((displayedThoughts.length / thoughts.length) * 100);

  const pills = [
    `${nights} nights`,
    travellers,
    ...(budget ? [budget] : []),
    ...((regions || []).filter(r => r !== 'inspire-me').slice(0, 2).map(r =>
      r.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    )),
  ].filter(Boolean);

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400&display=swap');

        .scr-root {
          position: fixed; inset: 0; overflow: hidden;
          background: #0a0800; z-index: 80;
          font-family: 'Jost', sans-serif;
        }

        /* ── GRAIN */
        .scr-grain {
          position: absolute; inset: 0; z-index: 60;
          pointer-events: none; opacity: 0.033;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 160px 160px;
          animation: scrGrain 0.5s steps(1) infinite;
        }
        @keyframes scrGrain {
          0%   { background-position: 0 0; }
          25%  { background-position: -18px 9px; }
          50%  { background-position: 9px -14px; }
          75%  { background-position: -9px 18px; }
          100% { background-position: 5px -5px; }
        }

        /* ── SCANLINE */
        .scr-scanline {
          position: absolute; left: 0; right: 0; height: 1px; z-index: 61;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(200,169,110,.5), transparent);
          animation: scrScan 5s ease-in-out infinite;
        }
        @keyframes scrScan {
          0%   { top: 0;    opacity: 0; }
          5%   { opacity: 0.5; }
          95%  { opacity: 0.1; }
          100% { top: 100%; opacity: 0; }
        }

        /* ── CORNERS */
        .scr-c { position: absolute; width: 22px; height: 22px; z-index: 62; opacity: 0.4; }
        .scr-c::before, .scr-c::after { content: ''; position: absolute; background: rgba(200,169,110,0.6); }
        .scr-c.tl { top: 20px; left: 20px; }
        .scr-c.tl::before { top:0;left:0;width:22px;height:1px; }
        .scr-c.tl::after  { top:0;left:0;width:1px;height:22px; }
        .scr-c.tr { top: 20px; right: 20px; }
        .scr-c.tr::before { top:0;right:0;width:22px;height:1px; }
        .scr-c.tr::after  { top:0;right:0;width:1px;height:22px; }
        .scr-c.bl { bottom: 20px; left: 20px; }
        .scr-c.bl::before { bottom:0;left:0;width:22px;height:1px; }
        .scr-c.bl::after  { bottom:0;left:0;width:1px;height:22px; }
        .scr-c.br { bottom: 20px; right: 20px; }
        .scr-c.br::before { bottom:0;right:0;width:22px;height:1px; }
        .scr-c.br::after  { bottom:0;right:0;width:1px;height:22px; }

        /* ── VIDEO FRAMES */
        .scr-vid-layer { position: absolute; inset: 0; }
        .scr-vid-frame {
          position: absolute; inset: 0;
          opacity: 0; transition: opacity 1.4s ease;
        }
        .scr-vid-frame.show { opacity: 1; }
        .scr-vid-frame iframe {
          position: absolute;
          top: -10%; left: -10%; width: 120%; height: 120%;
          border: none; pointer-events: none;
        }

        /* ── VIDEO OVERLAYS */
        .scr-ov {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom,
            rgba(0,0,0,.5) 0%, rgba(0,0,0,.0) 40%,
            rgba(0,0,0,.0) 55%, rgba(0,0,0,.75) 100%);
        }
        .scr-vg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,.5) 100%);
        }

        /* ── TOP BAR */
        .scr-topbar {
          position: absolute; top: 0; left: 0; right: 0; z-index: 10;
          display: flex; justify-content: space-between; align-items: center;
          padding: 32px 48px;
          opacity: 0; animation: scrFadeUp 0.9s ease forwards 0.2s;
        }
        .scr-brand { display: flex; align-items: center; gap: 10px; }
        .scr-diamond {
          width: 14px; height: 14px;
          border: 1.5px solid rgba(200,169,110,0.8); transform: rotate(45deg);
          position: relative;
        }
        .scr-diamond::after {
          content: ''; position: absolute; inset: 3px; background: rgba(200,169,110,0.8);
        }
        .scr-brand-name {
          font-weight: 200; font-size: 10px; letter-spacing: 0.36em;
          text-transform: uppercase; color: rgba(255,255,255,.6);
        }

        /* ── CENTRE LABEL (cinematic phase) */
        .scr-centre {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          text-align: center; z-index: 10;
          transition: opacity 0.8s ease;
        }
        .scr-centre-ey {
          font-weight: 200; font-size: 9.5px; letter-spacing: 0.55em;
          text-transform: uppercase; color: rgba(200,169,110,0.8);
          margin-bottom: 12px;
        }
        .scr-centre-ht {
          font-family: 'Cormorant Garamond', serif; font-weight: 300;
          font-size: clamp(22px, 3.5vw, 40px);
          color: rgba(255,255,255,.88); font-style: italic; line-height: 1.25;
        }
        .scr-waveform {
          display: flex; align-items: center; gap: 3px;
          margin-top: 20px; justify-content: center;
        }
        .scr-wb {
          width: 2px; background: rgba(200,169,110,.7); border-radius: 1px; opacity: 0.6;
          animation: scrWave var(--dur, 1s) ease-in-out infinite;
          animation-delay: var(--dly, 0s);
        }
        @keyframes scrWave {
          0%,100% { height: 3px; opacity: 0.2; }
          50%     { height: var(--pk, 18px); opacity: 0.85; }
        }

        /* ── REGION FOOTER */
        .scr-footer {
          position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
          padding: 40px 48px;
          display: flex; justify-content: space-between; align-items: flex-end;
          transition: opacity 0.6s ease;
        }
        .scr-country {
          font-weight: 200; font-size: 10px; letter-spacing: 0.44em;
          text-transform: uppercase; color: rgba(200,169,110,0.8);
          margin-bottom: 8px;
          opacity: 0; transform: translateY(14px);
          animation: scrFadeUp 0.8s ease forwards 0.3s;
        }
        .scr-name {
          font-family: 'Cormorant Garamond', serif; font-weight: 300;
          font-size: clamp(38px, 6.5vw, 76px);
          color: #fff; line-height: 0.9; letter-spacing: -0.01em;
          margin-bottom: 12px;
          opacity: 0; transform: translateY(22px);
          animation: scrFadeUp 1s ease forwards 0.5s;
        }
        .scr-tagline {
          font-family: 'Cormorant Garamond', serif; font-style: italic;
          font-weight: 300; font-size: clamp(14px, 1.9vw, 22px);
          color: rgba(255,255,255,.7); margin-bottom: 14px;
          opacity: 0; transform: translateY(10px);
          animation: scrFadeUp 0.9s ease forwards 0.7s;
        }
        .scr-sub {
          font-weight: 200; font-size: 10.5px; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,.33);
          opacity: 0; animation: scrFadeUp 0.8s ease forwards 0.9s;
        }
        .scr-stat {
          text-align: right;
          opacity: 0; transform: translateY(14px);
          animation: scrFadeUp 0.8s ease forwards 1.1s;
        }
        .scr-stat-n {
          font-family: 'Cormorant Garamond', serif; font-weight: 300;
          font-size: clamp(28px, 4vw, 52px); color: rgba(200,169,110,0.9); line-height: 1;
        }
        .scr-stat-l {
          font-weight: 200; font-size: 10px; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(255,255,255,.3); margin-top: 4px;
        }

        /* ── THINKING OVERLAY */
        .scr-thinking {
          position: absolute; inset: 0; z-index: 20;
          background: rgba(10,8,0,.97); backdrop-filter: blur(12px);
          display: flex;
          opacity: 0; pointer-events: none;
          transition: opacity 0.8s ease;
        }
        .scr-thinking.visible { opacity: 1; pointer-events: all; }

        .scr-tleft { flex: 1; position: relative; overflow: hidden; }
        .scr-tleft-bg {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; opacity: 0.22; filter: saturate(0.55);
          animation: scrPan 22s ease-in-out infinite alternate;
        }
        @keyframes scrPan {
          from { transform: scale(1.04) translate(0,0); }
          to   { transform: scale(1.10) translate(-2%,-1.5%); }
        }
        .scr-tleft-c {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; justify-content: center;
          padding: 68px 60px;
        }
        .scr-tey {
          font-weight: 200; font-size: 10px; letter-spacing: 0.5em;
          text-transform: uppercase; color: rgba(200,169,110,0.8);
          margin-bottom: 18px;
          opacity: 0; animation: scrFadeUp 0.8s ease forwards 0.4s;
        }
        .scr-thinking.visible .scr-tey { animation-play-state: running; }
        .scr-tht {
          font-family: 'Cormorant Garamond', serif; font-weight: 300;
          font-size: clamp(32px, 4.8vw, 62px); color: #fff; line-height: 1.05;
          margin-bottom: 6px;
          opacity: 0; animation: scrFadeUp 0.9s ease forwards 0.55s;
        }
        .scr-tht em { color: rgba(200,169,110,0.9); font-style: italic; }
        .scr-tsb {
          font-family: 'Cormorant Garamond', serif; font-style: italic;
          font-weight: 300; font-size: clamp(15px, 1.8vw, 21px);
          color: rgba(255,255,255,.38); margin-bottom: 40px;
          opacity: 0; animation: scrFadeUp 0.8s ease forwards 0.7s;
        }
        .scr-pills {
          display: flex; flex-wrap: wrap; gap: 9px;
          opacity: 0; animation: scrFadeUp 0.8s ease forwards 0.85s;
        }
        .scr-pill {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 13px;
          border: 1px solid rgba(200,169,110,.25);
          font-weight: 200; font-size: 10px;
          letter-spacing: 0.17em; text-transform: uppercase;
          color: rgba(255,255,255,.5);
          background: rgba(200,169,110,.04);
        }
        .scr-pdot { width: 5px; height: 5px; border-radius: 50%; background: rgba(200,169,110,0.8); flex-shrink: 0; }

        /* ── THOUGHT STREAM */
        .scr-tright {
          width: 390px; flex-shrink: 0;
          border-left: 1px solid rgba(255,255,255,.05);
          display: flex; flex-direction: column;
          padding: 56px 36px;
        }
        .scr-shdr {
          font-weight: 200; font-size: 10px; letter-spacing: 0.4em;
          text-transform: uppercase; color: rgba(255,255,255,.17);
          margin-bottom: 24px; flex-shrink: 0;
        }
        .scr-sstream {
          flex: 1; overflow: hidden; position: relative;
          mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%);
        }
        .scr-sinner {
          padding: 24px 0; display: flex; flex-direction: column;
          overflow-y: auto; max-height: 100%; scrollbar-width: none;
        }
        .scr-sinner::-webkit-scrollbar { display: none; }
        .scr-titem {
          display: flex; align-items: flex-start; gap: 11px;
          padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.03);
          opacity: 0; transform: translateY(8px);
          animation: scrThoughtIn 0.45s ease forwards;
        }
        @keyframes scrThoughtIn { to { opacity: 1; transform: translateY(0); } }
        .scr-titem.lat { border-bottom-color: rgba(200,169,110,.1); }
        .scr-tico { width: 15px; height: 15px; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; }
        .scr-ddot { width: 5px; height: 5px; border-radius: 50%; background: rgba(200,169,110,.35); }
        .scr-adot {
          width: 8px; height: 8px; border-radius: 50%; background: rgba(200,169,110,0.9);
          box-shadow: 0 0 10px rgba(200,169,110,0.8);
          animation: scrPulse 1s ease-in-out infinite;
        }
        @keyframes scrPulse { 0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.55} }
        .scr-ttxt {
          font-weight: 300; font-size: 12.5px; line-height: 1.55;
          color: rgba(255,255,255,.32); letter-spacing: 0.01em;
        }
        .scr-titem.lat .scr-ttxt { color: rgba(255,255,255,.86); font-weight: 400; }

        /* ── PROGRESS */
        .scr-sfooter { flex-shrink: 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,.05); }
        .scr-ptrack { height: 1px; background: rgba(255,255,255,.07); position: relative; overflow: visible; }
        .scr-pfill {
          height: 1px; background: linear-gradient(90deg, rgba(200,169,110,0.9), rgba(200,169,110,0.5));
          transition: width 0.5s ease; position: relative;
        }
        .scr-pfill::after {
          content: ''; position: absolute; right: -1px; top: -3px;
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(200,169,110,0.9);
          box-shadow: 0 0 10px rgba(200,169,110,0.8), 0 0 20px rgba(200,169,110,.3);
        }
        .scr-pmeta {
          display: flex; justify-content: space-between; margin-top: 10px;
          font-weight: 200; font-size: 10px; letter-spacing: 0.22em;
          text-transform: uppercase; color: rgba(255,255,255,.17);
        }
        .scr-ppct { color: rgba(200,169,110,0.8); font-weight: 300; }

        /* ── REVEAL */
        .scr-reveal {
          position: absolute; inset: 0; z-index: 30;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: #0a0800;
          opacity: 0; pointer-events: none;
          transition: opacity 0.6s ease;
        }
        .scr-reveal.visible { opacity: 1; pointer-events: all; }

        .scr-dring { position: relative; width: 86px; height: 86px; margin-bottom: 40px; }
        .scr-do {
          position: absolute; inset: 0;
          border: 1px solid rgba(200,169,110,.28);
          transform: rotate(45deg);
          animation: scrSpin 7s linear infinite;
        }
        .scr-dm {
          position: absolute; inset: 14px;
          border: 1px solid rgba(200,169,110,0.8);
          transform: rotate(45deg);
          animation: scrSpin 4.5s linear infinite reverse;
        }
        .scr-dc {
          position: absolute; inset: 30px;
          background: rgba(200,169,110,0.9);
          transform: rotate(45deg);
          animation: scrGlow 2s ease-in-out infinite;
        }
        @keyframes scrSpin { to { transform: rotate(calc(45deg + 360deg)); } }
        @keyframes scrGlow {
          0%,100% { box-shadow: 0 0 0 rgba(200,169,110,0); }
          50%      { box-shadow: 0 0 28px rgba(200,169,110,.55), 0 0 55px rgba(200,169,110,.18); }
        }

        .scr-rtitle {
          font-family: 'Cormorant Garamond', serif; font-weight: 300;
          font-size: clamp(24px, 3.8vw, 44px); color: #fff;
          text-align: center; margin-bottom: 10px;
        }
        .scr-rsub {
          font-weight: 200; font-size: 10px; letter-spacing: 0.44em;
          text-transform: uppercase; color: rgba(200,169,110,0.8);
          text-align: center; margin-bottom: 44px;
        }
        .scr-rbar-t { width: 260px; height: 1px; background: rgba(255,255,255,.08); overflow: visible; position: relative; }
        .scr-rbar-f {
          height: 1px; background: linear-gradient(90deg, rgba(200,169,110,0.9), #fff);
          transition: width 0.04s linear;
          box-shadow: 0 0 8px rgba(200,169,110,0.8);
        }

        /* ── UTILITIES */
        @keyframes scrFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── MOBILE */
        @media (max-width: 700px) {
          .scr-topbar, .scr-footer { padding: 24px; }
          .scr-thinking { flex-direction: column; }
          .scr-tright { width: 100%; border-left: none; border-top: 1px solid rgba(255,255,255,.05); padding: 24px; }
          .scr-tleft-c { padding: 36px 24px 24px; justify-content: flex-end; }
          .scr-stat { display: none; }
          .scr-name { font-size: 42px; }
        }
      `}</style>

      <div className="scr-root">
        {/* Ambient */}
        <div className="scr-grain" />
        <div className="scr-scanline" />
        <div className="scr-c tl" />
        <div className="scr-c tr" />
        <div className="scr-c bl" />
        <div className="scr-c br" />

        {/* ── PHASE 1: CINEMATIC */}
        <>
          {/* Video frames — A/B crossfade */}
          <div className="scr-vid-layer">
            <div className={`scr-vid-frame ${activeFrame === 'A' ? 'show' : ''}`}>
              <iframe
                ref={ifrARef}
                allow="autoplay; encrypted-media"
                allowFullScreen={false}
                title="region-A"
              />
              <div style={{ position:'absolute', inset:0, zIndex:2, background:'transparent', pointerEvents:'all' }} />
            </div>
            <div className={`scr-vid-frame ${activeFrame === 'B' ? 'show' : ''}`}>
              <iframe
                ref={ifrBRef}
                allow="autoplay; encrypted-media"
                allowFullScreen={false}
                title="region-B"
              />
              <div style={{ position:'absolute', inset:0, zIndex:2, background:'transparent', pointerEvents:'all' }} />
            </div>
          </div>

          <div className="scr-ov" />
          <div className="scr-vg" />

          {/* Top bar */}
          {phase === 'cinematic' && (
            <div className="scr-topbar">
              <div className="scr-brand">
                <div className="scr-diamond" />
                <span className="scr-brand-name">The Safari Edition</span>
              </div>
            </div>
          )}

          {/* Centre label */}
          {phase === 'cinematic' && (
            <div className="scr-centre" style={{ opacity: titleVisible ? 1 : 0 }}>
              <div className="scr-centre-ey">Crafting your journey</div>
              <div className="scr-centre-ht">Discovering<br />your Africa</div>
              <div className="scr-waveform">
                {[11,19,15,27,13,25,17,29,12,23].map((p, i) => (
                  <div
                    key={i}
                    className="scr-wb"
                    style={{
                      '--dur': `${0.7 + (i % 4) * 0.14}s`,
                      '--dly': `${i * 0.054}s`,
                      '--pk':  `${p}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Region footer */}
          {phase === 'cinematic' && currentClip && (
            <div
              className="scr-footer"
              style={{ opacity: titleVisible ? 1 : 0, transition: 'opacity 0.7s ease' }}
            >
              <div>
                <div className="scr-country">{currentClip.country}</div>
                <div className="scr-name">{currentClip.name}</div>
                <div className="scr-tagline">{currentClip.tagline}</div>
              </div>
              <div className="scr-stat">
                <div className="scr-stat-n">{currentClip.stat}</div>
                <div className="scr-stat-l">{currentClip.statLabel}</div>
              </div>
            </div>
          )}
        </>

        {/* ── PHASE 2: THINKING */}
        <div className={`scr-thinking ${phase === 'thinking' || phase === 'reveal' ? 'visible' : ''}`}>
          <div className="scr-tleft">
            <img
              className="scr-tleft-bg"
              src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80"
              alt=""
            />
            <div className="scr-tleft-c">
              <div className="scr-tey">Building your itinerary</div>
              <div className="scr-tht">Your <em>Africa</em><br />awaits</div>
              <div className="scr-tsb">Handpicked. Not from a catalogue.</div>
              <div className="scr-pills">
                {pills.map((p, i) => (
                  <div key={i} className="scr-pill">
                    <div className="scr-pdot" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="scr-tright">
            <div className="scr-shdr">Intelligence at work</div>
            <div className="scr-sstream">
              <div className="scr-sinner" ref={thoughtsRef}>
                {displayedThoughts.map((t, i) => {
                  const isLatest = i === displayedThoughts.length - 1;
                  return (
                    <div key={i} className={`scr-titem ${isLatest ? 'lat' : ''}`}>
                      <div className="scr-tico">
                        {isLatest
                          ? <div className="scr-adot" />
                          : <div className="scr-ddot" />
                        }
                      </div>
                      <div className="scr-ttxt">{t}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="scr-sfooter">
              <div className="scr-ptrack">
                <div className="scr-pfill" style={{ width: `${thoughtProgress}%` }} />
              </div>
              <div className="scr-pmeta">
                <span>Itinerary in progress</span>
                <span className="scr-ppct">{thoughtProgress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PHASE 3: REVEAL */}
        <div className={`scr-reveal ${phase === 'reveal' ? 'visible' : ''}`}>
          <div className="scr-dring">
            <div className="scr-do" />
            <div className="scr-dm" />
            <div className="scr-dc" />
          </div>
          <div className="scr-rtitle">Your journey is ready</div>
          <div className="scr-rsub">
            {nights} nights · {clips.map(c => c?.name).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
          </div>
          <div className="scr-rbar-t">
            <div className="scr-rbar-f" style={{ width: `${revealProgress}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}
