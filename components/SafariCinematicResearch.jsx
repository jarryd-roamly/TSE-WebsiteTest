'use client';

// SafariCinematicResearch.jsx — v4
// YouTube iframes with guaranteed hidden controls:
// 1. Iframe oversized 300% height, offset -100% top → centre of iframe is above viewport
//    meaning the play button (rendered at 50% iframe height) appears at -50% of container
//    Wait — that still shows. 
//
// REAL APPROACH:
// - Iframe scaled to 400% width/height, centered
// - Container overflow:hidden clips everything outside
// - The YouTube UI (top bar, bottom bar, centre button) are all within the iframe
// - We add a centre-mask div (rgba(0,0,0,0.01) — invisible but painted) 
//   sized 40% x 30% of container, centered, z-index above iframe
// - This div intercepts all pointer events AND visually covers the play button area
// - Combined with the existing gradient overlay (scr-ov) which darkens edges
// - The vignette (scr-vg) adds another dark layer
//
// JS reload timer: reloads src every 7s (before YouTube hits the natural loop point
// and shows end screen) — keeps video in playing state, never paused

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildThoughts } from '@/app/lib/buildThoughts';

// ─── Region → YouTube clip mapping ───────────────────────────────────────────
// start/end chosen for the most visually striking 8-second window
const REGION_CLIPS = {
  'kruger': [
    { vid:'mmLrPy5LdLI', start:12,  accent:'#C8A96E', name:'Sabi Sand',      country:'South Africa', tagline:'Where leopards walk at noon',          stat:'12 min',     statLabel:'avg leopard sighting' },
    { vid:'kzk3cowD9a4', start:5,   accent:'#C8A96E', name:'Sabi Sand',      country:'South Africa', tagline:'Where leopards walk at noon',          stat:'12 min',     statLabel:'avg leopard sighting' },
  ],
  'kruger-sabi-sand': [
    { vid:'mmLrPy5LdLI', start:12,  accent:'#C8A96E', name:'Sabi Sand',      country:'South Africa', tagline:'Where leopards walk at noon',          stat:'12 min',     statLabel:'avg leopard sighting' },
    { vid:'kzk3cowD9a4', start:5,   accent:'#C8A96E', name:'Sabi Sand',      country:'South Africa', tagline:'Where leopards walk at noon',          stat:'12 min',     statLabel:'avg leopard sighting' },
  ],
  'okavango': [
    { vid:'9wER8n--GWk', start:8,   accent:'#7EB8A0', name:'Okavango Delta', country:'Botswana',     tagline:'A river that flows into the sky',      stat:'11,000 km²', statLabel:'of pristine wilderness' },
    { vid:'0XpNqqBy_B0', start:10,  accent:'#7EB8A0', name:'Okavango Delta', country:'Botswana',     tagline:'A river that flows into the sky',      stat:'11,000 km²', statLabel:'of pristine wilderness' },
  ],
  'okavango-delta': [
    { vid:'9wER8n--GWk', start:8,   accent:'#7EB8A0', name:'Okavango Delta', country:'Botswana',     tagline:'A river that flows into the sky',      stat:'11,000 km²', statLabel:'of pristine wilderness' },
    { vid:'0XpNqqBy_B0', start:10,  accent:'#7EB8A0', name:'Okavango Delta', country:'Botswana',     tagline:'A river that flows into the sky',      stat:'11,000 km²', statLabel:'of pristine wilderness' },
  ],
  'chobe-vic-falls': [
    { vid:'AacYqTMFuBc', start:6,   accent:'#8FC4D4', name:'Victoria Falls', country:'Zimbabwe',     tagline:'The smoke that thunders',              stat:'108m',       statLabel:'of pure vertical power' },
    { vid:'Ju51VwS-3qY', start:15,  accent:'#8FC4D4', name:'Victoria Falls', country:'Zimbabwe',     tagline:'The smoke that thunders',              stat:'108m',       statLabel:'of pure vertical power' },
  ],
  'chobe': [
    { vid:'AacYqTMFuBc', start:6,   accent:'#8FC4D4', name:'Victoria Falls', country:'Zimbabwe',     tagline:'The smoke that thunders',              stat:'108m',       statLabel:'of pure vertical power' },
    { vid:'Ju51VwS-3qY', start:15,  accent:'#8FC4D4', name:'Victoria Falls', country:'Zimbabwe',     tagline:'The smoke that thunders',              stat:'108m',       statLabel:'of pure vertical power' },
  ],
  'cape-town': [
    { vid:'LxOUQrtilGQ', start:5,   accent:'#B8C4A0', name:'Cape Town',      country:'South Africa', tagline:'Where two oceans meet the mountain',   stat:'Top 3',      statLabel:'most beautiful cities' },
    { vid:'LfZ0LcpcZcQ', start:10,  accent:'#B8C4A0', name:'Cape Town',      country:'South Africa', tagline:'Where two oceans meet the mountain',   stat:'Top 3',      statLabel:'most beautiful cities' },
  ],
  'madikwe': [
    { vid:'OFKcXy9lWyo', start:8,   accent:'#C8A96E', name:'Madikwe',        country:'South Africa', tagline:'Big Five. Malaria-free. Unforgettable', stat:'75,000',    statLabel:'hectares of wilderness' },
    { vid:'UEJFfEskEck', start:12,  accent:'#C8A96E', name:'Madikwe',        country:'South Africa', tagline:'Big Five. Malaria-free. Unforgettable', stat:'75,000',    statLabel:'hectares of wilderness' },
  ],
  'masai-mara': [
    { vid:'mmLrPy5LdLI', start:45,  accent:'#D4874A', name:'Masai Mara',     country:'Kenya',        tagline:'The greatest show on earth',           stat:'1.5M',       statLabel:'wildebeest in migration' },
    { vid:'9wER8n--GWk', start:30,  accent:'#D4874A', name:'Masai Mara',     country:'Kenya',        tagline:'The greatest show on earth',           stat:'1.5M',       statLabel:'wildebeest in migration' },
  ],
};

const FALLBACK = REGION_CLIPS['kruger-sabi-sand'];

// Maps page.tsx region IDs → Supabase/admin slug keys
// page.tsx passes selectedRegions as IDs (e.g. 'kruger')
// Admin uploads and Supabase rows use slugs (e.g. 'kruger-sabi-sand')
const ID_TO_SLUG = {
  'kruger':    'kruger-sabi-sand',
  'okavango':  'okavango-delta',
  'cape-town': 'cape-town',
  'madikwe':   'madikwe',
  'chobe':     'chobe-vic-falls',
};

// Video served from Cloudflare R2 as direct MP4

const THOUGHTS_RETURNING = [
  "Reading your travel history…","You've been before — ready for something deeper.",
  "Scanning availability across 23 properties…","Checking seasonal wildlife calendars…",
  "The Sabi Sand leopard population is unusually active right now.",
  "Cross-referencing your budget against contracted net rates…",
  "Identifying date arbitrage — shifting 3 days saves R18,400.",
  "Loading Knowledge Base: 127 specialist notes injected…",
  "Matching lodge character to your preferences…",
  "Detecting arrival gap — suggesting half-day river activity…",
  "Building your personalised itinerary…","Almost there. This one is worth the wait.",
];
const THOUGHTS_FIRST = [
  "First trip to Africa — we'll make it unforgettable.",
  "Scanning Southern Africa for the perfect introduction…",
  "Cross-checking Big Five density across 14 private reserves…",
  "The Sabi Sand has three leopard cubs active right now.",
  "Comparing lodge options against your budget…",
  "Checking flight connections from London Heathrow…",
  "Loading Knowledge Base: 127 specialist notes…",
  "Assembling your itinerary…",
  "Running final pricing against contracted net rates…",
  "Your itinerary is almost ready.",
];

export default function SafariCinematicResearch({ answers = {}, aiReady = false, onComplete }) {
  // Load R2 video URLs from Supabase cinematic_videos table
  const [videoUrls, setVideoUrls] = useState({});
  const [videosReady, setVideosReady] = useState(false);
  useEffect(() => {
    const load = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data } = await sb.from('cinematic_videos').select('region,url');
        if (data && data.length > 0) {
          setVideoUrls(Object.fromEntries(data.map(r => [r.region, r.url])));
        }
      } catch(e) { /* ignore */ }
      // Always mark ready — even if no videos, cinematic continues (dark background)
      setVideosReady(true);
    };
    load();
  }, []);
  const { experience='returning', regions=[], nights=7, travellers='couple', budget='' } = answers;

  const clips = (() => {
    // Resolve region IDs to slugs (page.tsx passes IDs, Supabase uses slugs)
    const toSlug = id => ID_TO_SLUG[id] || id;
    const valid = (regions||[])
      .filter(r => r !== 'inspire-me')
      .map(toSlug)
      .filter(slug => REGION_CLIPS[slug]);
    const chosen = valid.length > 0 ? valid.slice(0,2) : ['kruger-sabi-sand','okavango-delta'];
    return chosen.map(slug => {
      const meta = (REGION_CLIPS[slug] || REGION_CLIPS['kruger-sabi-sand'])[0];
      const mp4  = videoUrls[slug] || null;
      return { ...meta, mp4 };
    });
  })();

  // Keep a ref to clips so callbacks always see the latest mp4 URLs
  const clipsRef = useRef(clips);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  const CLIP_DURATION = 8000;

  const MIN_TOTAL = clips.length * CLIP_DURATION;
  const thoughts = buildThoughts(answers);

  const [phase,             setPhase]             = useState('cinematic');
  const [clipIdx,           setClipIdx]           = useState(0);
  const [activeFrame,       setActiveFrame]       = useState('A');
  const [displayedThoughts, setDisplayedThoughts] = useState([]);
  const [revealProgress,    setRevealProgress]    = useState(0);
  const [titleVisible,      setTitleVisible]      = useState(true);
  const [cinematicDone,     setCinematicDone]     = useState(false);

  const ifrARef    = useRef(null);
  const ifrBRef    = useRef(null);
  const thoughtsRef= useRef(null);
  const timers     = useRef([]);

  const aiReadyRef = useRef(aiReady);

  useEffect(() => { aiReadyRef.current = aiReady; }, [aiReady]);

  const addTimer = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
  }, []);

  const loadClip = useCallback((index, frame) => {
    const clip = clipsRef.current[index];
    if (!clip?.mp4) return;
    const el = frame === 'A' ? ifrARef.current : ifrBRef.current;
    if (el && 'play' in el) {
      el.src = clip.mp4;
      el.play().catch(() => {});
    }
  }, []); // clipsRef is a ref — no dependency needed

  const crossFadeTo = useCallback((index) => {
    const incoming = activeFrame === 'A' ? 'B' : 'A';
    loadClip(index, incoming);
    addTimer(() => {
      setActiveFrame(incoming);
      setClipIdx(index);
    }, 400);
  }, [activeFrame, loadClip, addTimer, videoUrls]);

  const startThinking = useCallback(() => {
    setPhase('thinking');
    let i = 0;
    const addThought = () => {
      if (i >= thoughts.length) {
        const check = () => {
          if (aiReadyRef.current) setPhase('reveal');
          else addTimer(check, 300);
        };
        addTimer(check, 800);
        return;
      }
      setDisplayedThoughts(prev => [...prev, thoughts[i]]);
      if (thoughtsRef.current) thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
      i++;
      addTimer(addThought, 950 + Math.random()*200);
    };
    addTimer(addThought, 300);
  }, [thoughts, addTimer]);

  useEffect(() => {
    if (!videosReady) return;
    loadClip(0, 'A');
    addTimer(() => setTitleVisible(false), 3200);
    if (clips.length > 1) {
      addTimer(() => {
        setTitleVisible(true);
        crossFadeTo(1);
        addTimer(() => setTitleVisible(false), 3200);
      }, CLIP_DURATION);
    }
    addTimer(() => { setCinematicDone(true); startThinking(); }, MIN_TOTAL);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videosReady]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    let p = 0;
    const iv = setInterval(() => {
      p += 2.2; setRevealProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(iv); addTimer(() => onComplete?.(), 500); }
    }, 28);
    return () => clearInterval(iv);
  }, [phase, onComplete, addTimer]);

  useEffect(() => {
    if (aiReady && phase === 'cinematic' && cinematicDone) setPhase('thinking');
  }, [aiReady, phase, cinematicDone]);

  const currentClip     = clipsRef.current[clipIdx] || clipsRef.current[0] || clips[clipIdx] || clips[0];
  const thoughtProgress = Math.round((displayedThoughts.length / thoughts.length) * 100);
  const pills = [
    `${nights} nights`, travellers,
    ...(budget ? [budget] : []),
    ...((regions||[]).filter(r => r !== 'inspire-me').slice(0,2)
      .map(r => r.replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase()))),
  ].filter(Boolean);

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400&display=swap');
        .scr-root{position:fixed;inset:0;overflow:hidden;background:#0a0800;z-index:80;font-family:'Jost',sans-serif;}
        .scr-grain{position:absolute;inset:0;z-index:60;pointer-events:none;opacity:0.033;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:160px;animation:scrGrain .5s steps(1) infinite;}
        @keyframes scrGrain{0%{background-position:0 0}25%{background-position:-18px 9px}50%{background-position:9px -14px}75%{background-position:-9px 18px}100%{background-position:5px -5px}}
        .scr-scan{position:absolute;left:0;right:0;height:1px;z-index:61;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(200,169,110,.5),transparent);animation:scrScan 5s ease-in-out infinite;}
        @keyframes scrScan{0%{top:0;opacity:0}5%{opacity:.5}95%{opacity:.1}100%{top:100%;opacity:0}}
        .scr-c{position:absolute;width:22px;height:22px;z-index:62;opacity:.4;}
        .scr-c::before,.scr-c::after{content:'';position:absolute;background:rgba(200,169,110,.6);}
        .scr-c.tl{top:20px;left:20px}.scr-c.tl::before{top:0;left:0;width:22px;height:1px}.scr-c.tl::after{top:0;left:0;width:1px;height:22px}
        .scr-c.tr{top:20px;right:20px}.scr-c.tr::before{top:0;right:0;width:22px;height:1px}.scr-c.tr::after{top:0;right:0;width:1px;height:22px}
        .scr-c.bl{bottom:20px;left:20px}.scr-c.bl::before{bottom:0;left:0;width:22px;height:1px}.scr-c.bl::after{bottom:0;left:0;width:1px;height:22px}
        .scr-c.br{bottom:20px;right:20px}.scr-c.br::before{bottom:0;right:0;width:22px;height:1px}.scr-c.br::after{bottom:0;right:0;width:1px;height:22px}

        /* ── VIDEO LAYER: iframe oversized + centre mask */
        .scr-vid-layer{position:absolute;inset:0;overflow:hidden;}
        .scr-vid-frame{position:absolute;inset:0;opacity:0;transition:opacity 1.4s ease;}
        .scr-vid-frame.show{opacity:1;}

        /* Oversized iframe pushes YouTube chrome (logo, progress bar) outside overflow:hidden */
        .scr-vid-frame iframe{
          position:absolute;
          top:-16.67%;left:-16.67%;
          width:133.33%;height:133.33%;
          border:none;pointer-events:none;
        }

        /* Centre mask — covers exactly where YouTube renders the play/pause button */
        /* Sized 30% wide × 22% tall, centred — invisible (rgba 0.01) but painted */
        /* Sits at z-index 5, above iframe (z-index 1), below UI content (z-index 10+) */
        .scr-centre-mask{
          position:absolute;
          top:50%;left:50%;
          transform:translate(-50%,-50%);
          width:30%;height:22%;
          min-width:120px;min-height:80px;
          z-index:5;
          background:rgba(0,0,0,0.01);
          pointer-events:all;
        }

        .scr-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 38%,rgba(0,0,0,0) 52%,rgba(0,0,0,.78) 100%);z-index:3;}
        .scr-vg{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 25%,rgba(0,0,0,.55) 100%);z-index:4;}

        .scr-topbar{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:32px 48px;opacity:0;animation:scrFU .9s ease forwards .2s;}
        .scr-brand{display:flex;align-items:center;gap:10px;}
        .scr-diamond{width:14px;height:14px;border:1.5px solid rgba(200,169,110,.8);transform:rotate(45deg);position:relative;}
        .scr-diamond::after{content:'';position:absolute;inset:3px;background:rgba(200,169,110,.8);}
        .scr-bname{font-weight:200;font-size:10px;letter-spacing:.36em;text-transform:uppercase;color:rgba(255,255,255,.6);}
        .scr-centre{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:10;transition:opacity .8s ease;}
        .scr-cey{font-weight:200;font-size:9.5px;letter-spacing:.55em;text-transform:uppercase;color:rgba(200,169,110,.8);margin-bottom:12px;}
        .scr-cht{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(22px,3.5vw,40px);color:rgba(255,255,255,.88);font-style:italic;line-height:1.25;}
        .scr-wf{display:flex;align-items:center;gap:3px;margin-top:20px;justify-content:center;}
        .scr-wb{width:2px;background:rgba(200,169,110,.7);border-radius:1px;opacity:.6;animation:scrWave var(--dur,1s) ease-in-out infinite;animation-delay:var(--dly,0s);}
        @keyframes scrWave{0%,100%{height:3px;opacity:.2}50%{height:var(--pk,18px);opacity:.85}}
        .scr-footer{position:absolute;bottom:0;left:0;right:0;z-index:10;padding:40px 48px;display:flex;justify-content:space-between;align-items:flex-end;transition:opacity .6s ease;}
        .scr-country{font-weight:200;font-size:10px;letter-spacing:.44em;text-transform:uppercase;color:rgba(200,169,110,.8);margin-bottom:8px;opacity:0;transform:translateY(14px);animation:scrFU .8s ease forwards .3s;}
        .scr-name{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(38px,6.5vw,76px);color:#fff;line-height:.9;letter-spacing:-.01em;margin-bottom:12px;opacity:0;transform:translateY(22px);animation:scrFU 1s ease forwards .5s;}
        .scr-tagline{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(14px,1.9vw,22px);color:rgba(255,255,255,.7);margin-bottom:14px;opacity:0;transform:translateY(10px);animation:scrFU .9s ease forwards .7s;}
        .scr-stat{text-align:right;opacity:0;transform:translateY(14px);animation:scrFU .8s ease forwards 1.1s;}
        .scr-stat-n{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(28px,4vw,52px);color:rgba(200,169,110,.9);line-height:1;}
        .scr-stat-l{font-weight:200;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-top:4px;}

        .scr-thinking{position:absolute;inset:0;z-index:20;background:rgba(10,8,0,.97);backdrop-filter:blur(12px);display:flex;opacity:0;pointer-events:none;transition:opacity .8s ease;}
        .scr-thinking.visible{opacity:1;pointer-events:all;}
        .scr-tleft{flex:1;position:relative;overflow:hidden;}
        .scr-tleft-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.22;filter:saturate(.55);animation:scrPan 22s ease-in-out infinite alternate;}
        @keyframes scrPan{from{transform:scale(1.04) translate(0,0)}to{transform:scale(1.10) translate(-2%,-1.5%)}}
        .scr-tleft-c{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:68px 60px;}
        .scr-tey{font-weight:200;font-size:10px;letter-spacing:.5em;text-transform:uppercase;color:rgba(200,169,110,.8);margin-bottom:18px;opacity:0;animation:scrFU .8s ease forwards .4s;}
        .scr-tht{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(32px,4.8vw,62px);color:#fff;line-height:1.05;margin-bottom:6px;opacity:0;animation:scrFU .9s ease forwards .55s;}
        .scr-tht em{color:rgba(200,169,110,.9);font-style:italic;}
        .scr-tsb{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(15px,1.8vw,21px);color:rgba(255,255,255,.38);margin-bottom:40px;opacity:0;animation:scrFU .8s ease forwards .7s;}
        .scr-pills{display:flex;flex-wrap:wrap;gap:9px;opacity:0;animation:scrFU .8s ease forwards .85s;}
        .scr-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border:1px solid rgba(200,169,110,.25);font-weight:200;font-size:10px;letter-spacing:.17em;text-transform:uppercase;color:rgba(255,255,255,.5);background:rgba(200,169,110,.04);}
        .scr-pdot{width:5px;height:5px;border-radius:50%;background:rgba(200,169,110,.8);flex-shrink:0;}
        .scr-tright{width:390px;flex-shrink:0;border-left:1px solid rgba(255,255,255,.05);display:flex;flex-direction:column;padding:56px 36px;}
        .scr-shdr{font-weight:200;font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:rgba(255,255,255,.17);margin-bottom:24px;flex-shrink:0;}
        .scr-sstream{flex:1;overflow:hidden;position:relative;mask-image:linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,transparent 0%,black 12%,black 88%,transparent 100%);}
        .scr-sinner{padding:24px 0;display:flex;flex-direction:column;overflow-y:auto;max-height:100%;scrollbar-width:none;}
        .scr-sinner::-webkit-scrollbar{display:none;}
        .scr-titem{display:flex;align-items:flex-start;gap:11px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);opacity:0;transform:translateY(8px);animation:scrTIn .45s ease forwards;}
        @keyframes scrTIn{to{opacity:1;transform:translateY(0)}}
        .scr-titem.lat{border-bottom-color:rgba(200,169,110,.1);}
        .scr-tico{width:15px;height:15px;flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;}
        .scr-ddot{width:5px;height:5px;border-radius:50%;background:rgba(200,169,110,.35);}
        .scr-adot{width:8px;height:8px;border-radius:50%;background:rgba(200,169,110,.9);box-shadow:0 0 10px rgba(200,169,110,.8);animation:scrPulse 1s ease-in-out infinite;}
        @keyframes scrPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.55}}
        .scr-ttxt{font-weight:300;font-size:12.5px;line-height:1.55;color:rgba(255,255,255,.32);letter-spacing:.01em;}
        .scr-titem.lat .scr-ttxt{color:rgba(255,255,255,.86);font-weight:400;}
        .scr-sfooter{flex-shrink:0;padding-top:24px;border-top:1px solid rgba(255,255,255,.05);}
        .scr-ptrack{height:1px;background:rgba(255,255,255,.07);position:relative;overflow:visible;}
        .scr-pfill{height:1px;background:linear-gradient(90deg,rgba(200,169,110,.9),rgba(200,169,110,.5));transition:width .5s ease;position:relative;}
        .scr-pfill::after{content:'';position:absolute;right:-1px;top:-3px;width:7px;height:7px;border-radius:50%;background:rgba(200,169,110,.9);box-shadow:0 0 10px rgba(200,169,110,.8);}
        .scr-pmeta{display:flex;justify-content:space-between;margin-top:10px;font-weight:200;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.17);}
        .scr-ppct{color:rgba(200,169,110,.8);font-weight:300;}
        .scr-reveal{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0800;opacity:0;pointer-events:none;transition:opacity .6s ease;}
        .scr-reveal.visible{opacity:1;pointer-events:all;}
        .scr-dring{position:relative;width:86px;height:86px;margin-bottom:40px;}
        .scr-do{position:absolute;inset:0;border:1px solid rgba(200,169,110,.28);transform:rotate(45deg);animation:scrSpin 7s linear infinite;}
        .scr-dm{position:absolute;inset:14px;border:1px solid rgba(200,169,110,.8);transform:rotate(45deg);animation:scrSpin 4.5s linear infinite reverse;}
        .scr-dc{position:absolute;inset:30px;background:rgba(200,169,110,.9);transform:rotate(45deg);animation:scrGlow 2s ease-in-out infinite;}
        @keyframes scrSpin{to{transform:rotate(calc(45deg + 360deg))}}
        @keyframes scrGlow{0%,100%{box-shadow:0 0 0 rgba(200,169,110,0)}50%{box-shadow:0 0 28px rgba(200,169,110,.55)}}
        .scr-rtitle{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(24px,3.8vw,44px);color:#fff;text-align:center;margin-bottom:10px;}
        .scr-rsub{font-weight:200;font-size:10px;letter-spacing:.44em;text-transform:uppercase;color:rgba(200,169,110,.8);text-align:center;margin-bottom:44px;}
        .scr-rbar-t{width:260px;height:1px;background:rgba(255,255,255,.08);overflow:visible;position:relative;}
        .scr-rbar-f{height:1px;background:linear-gradient(90deg,rgba(200,169,110,.9),#fff);transition:width .04s linear;box-shadow:0 0 8px rgba(200,169,110,.8);}
        @keyframes scrFU{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:700px){
          .scr-topbar,.scr-footer{padding:24px;}
          .scr-thinking{flex-direction:column;}
          .scr-tright{width:100%;border-left:none;border-top:1px solid rgba(255,255,255,.05);padding:24px;}
          .scr-tleft-c{padding:36px 24px 24px;justify-content:flex-end;}
          .scr-stat{display:none;}
          .scr-name{font-size:42px;}
          .scr-centre-mask{width:50%;height:28%;}
        }
      `}</style>

      <div className="scr-root">
        <div className="scr-grain"/><div className="scr-scan"/>
        <div className="scr-c tl"/><div className="scr-c tr"/>
        <div className="scr-c bl"/><div className="scr-c br"/>

        {/* VIDEO LAYER — R2 MP4s via <video> tag, zero controls */}
        <div className="scr-vid-layer">
          <div className={`scr-vid-frame ${activeFrame==='A'?'show':''}`}>
            {clips[0]?.mp4
              ? <video ref={ifrARef} src={clips[0].mp4} autoPlay muted loop playsInline
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
              : <div style={{position:'absolute',inset:0,background:'#0a0800'}}/>
            }
          </div>
          <div className={`scr-vid-frame ${activeFrame==='B'?'show':''}`}>
            {clips[1]?.mp4
              ? <video ref={ifrBRef} src={clips[1]?.mp4} muted loop playsInline
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
              : <div style={{position:'absolute',inset:0,background:'#0a0800'}}/>
            }
          </div>
          <div className="scr-ov"/>
          <div className="scr-vg"/>
        </div>

        {phase === 'cinematic' && (<>
          <div className="scr-topbar">
            <div className="scr-brand">
              <div className="scr-diamond"/>
              <span className="scr-bname">The Safari Edition</span>
            </div>
          </div>
          <div className="scr-centre" style={{opacity:titleVisible?1:0}}>
            <div className="scr-cey">Crafting your journey</div>
            <div className="scr-cht">Discovering<br/>your Africa</div>
            <div className="scr-wf">
              {[11,19,15,27,13,25,17,29,12,23].map((p,i) => (
                <div key={i} className="scr-wb" style={{'--dur':`${.7+(i%4)*.14}s`,'--dly':`${i*.054}s`,'--pk':`${p}px`}}/>
              ))}
            </div>
          </div>
          {currentClip && (
            <div className="scr-footer" style={{opacity:titleVisible?1:0}}>
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
        </>)}

        {/* THINKING */}
        <div className={`scr-thinking ${phase==='thinking'||phase==='reveal'?'visible':''}`}>
          <div className="scr-tleft">
            <img className="scr-tleft-bg" src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=80" alt=""/>
            <div className="scr-tleft-c">
              <div className="scr-tey">Building your itinerary</div>
              <div className="scr-tht">Your <em>Africa</em><br/>awaits</div>
              <div className="scr-tsb">Handpicked. Not from a catalogue.</div>
              <div className="scr-pills">
                {pills.map((p,i) => <div key={i} className="scr-pill"><div className="scr-pdot"/>{p}</div>)}
              </div>
            </div>
          </div>
          <div className="scr-tright">
            <div className="scr-shdr">Intelligence at work</div>
            <div className="scr-sstream">
              <div className="scr-sinner" ref={thoughtsRef}>
                {displayedThoughts.map((t,i) => {
                  const isLatest = i === displayedThoughts.length-1;
                  return (
                    <div key={i} className={`scr-titem ${isLatest?'lat':''}`}>
                      <div className="scr-tico">{isLatest?<div className="scr-adot"/>:<div className="scr-ddot"/>}</div>
                      <div className="scr-ttxt">{t}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="scr-sfooter">
              <div className="scr-ptrack"><div className="scr-pfill" style={{width:`${thoughtProgress}%`}}/></div>
              <div className="scr-pmeta">
                <span>Itinerary in progress</span>
                <span className="scr-ppct">{thoughtProgress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* REVEAL */}
        <div className={`scr-reveal ${phase==='reveal'?'visible':''}`}>
          <div className="scr-dring"><div className="scr-do"/><div className="scr-dm"/><div className="scr-dc"/></div>
          <div className="scr-rtitle">Your journey is ready</div>
          <div className="scr-rsub">{nights} nights · {clips.map(c=>c?.name).filter((v,i,a)=>a.indexOf(v)===i).join(' · ')}</div>
          <div className="scr-rbar-t"><div className="scr-rbar-f" style={{width:`${revealProgress}%`}}/></div>
        </div>
      </div>
    </>
  );
}
