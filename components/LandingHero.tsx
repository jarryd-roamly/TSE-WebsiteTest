'use client';

// ─────────────────────────────────────────────────────────────────────────────
// LandingHero.tsx — The Safari Edition
// Cinematic landing hero with:
//   · Looping R2 video (falls back to Unsplash if no video in Supabase)
//   · Brand wordmark with SVG diamond mark
//   · Staggered text reveal animation
//   · Grain texture + scanline overlay (matches SafariCinematicResearch aesthetic)
//   · Three entry CTAs
//   · Standard website nav links (About, How It Works, Contact)
//   · Footer with trust signals + legal links
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { T } from '@/app/lib/theme';

// Supabase row shape: { region: 'hero', url: 'https://r2.../hero.mp4' }
// Upload via Admin → Videos → Hero Video
const HERO_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1800&q=85';

// ─── Trust signals ────────────────────────────────────────────────────────────
const TRUST = [
  { icon: '✦', label: 'Contracted rates',  sub: '15–27% below direct booking' },
  { icon: '🛡', label: 'Verified lodges',   sub: 'Every property personally vetted' },
  { icon: '📞', label: 'Journey Specialists', sub: 'Real people. Available now.' },
  { icon: '🔄', label: 'Flexible terms',    sub: 'Best cancellation in the market' },
];

// ─── Stat counters (animate on mount) ────────────────────────────────────────
const STATS = [
  { value: 90,  suffix: '+', label: 'Curated properties' },
  { value: 27,  suffix: '%', label: 'Average saving vs direct' },
  { value: 9,   suffix: 'min', label: 'Average booking time' },
  { value: 4.9, suffix: '★', label: 'Guest satisfaction' },
];

interface LandingHeroProps {
  onPlanJourney:      () => void;
  onCuratedJourneys:  () => void;
  onSendBrief:        () => void;
}

export default function LandingHero({
  onPlanJourney,
  onCuratedJourneys,
  onSendBrief,
}: LandingHeroProps) {
  const [heroVideoUrl, setHeroVideoUrl] = useState<string | null>(null);
  const [videoLoaded,  setVideoLoaded]  = useState(false);
  const [revealed,     setRevealed]     = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load hero video from Supabase cinematic_videos table
  useEffect(() => {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/cinematic_videos?region=eq.hero&select=url&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then(r => r.json())
      .then((rows: any[]) => { if (rows?.[0]?.url) setHeroVideoUrl(rows[0].url); })
      .catch(() => {});
  }, []);

  // Stagger reveal after a brief delay
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap');

        /* ── Reset & root ── */
        .lh-root { font-family: 'Jost', sans-serif; background: #080800; color: #f5f0e8; }

        /* ── NAV ── */
        .lh-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          height: 68px; display: flex; align-items: center;
          padding: 0 clamp(20px, 5vw, 64px);
          background: linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%);
          backdrop-filter: blur(0px);
          transition: background 0.4s ease, backdrop-filter 0.4s ease;
        }
        .lh-nav.scrolled {
          background: rgba(8,8,0,0.94);
          backdrop-filter: blur(20px);
          border-bottom: 0.5px solid rgba(200,169,110,0.12);
        }
        .lh-nav-inner {
          width: 100%; max-width: 1280px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lh-wordmark {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .lh-diamond-wrap { position: relative; width: 28px; height: 28px; flex-shrink: 0; }
        .lh-diamond-outer {
          position: absolute; inset: 0;
          border: 1.5px solid rgba(200,169,110,0.7);
          transform: rotate(45deg);
        }
        .lh-diamond-inner {
          position: absolute; inset: 8px;
          background: rgba(200,169,110,0.85);
          transform: rotate(45deg);
        }
        .lh-wm-text { display: flex; flex-direction: column; line-height: 1; }
        .lh-wm-top {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 16px; letter-spacing: 0.12em;
          color: #f5f0e8;
        }
        .lh-wm-sub {
          font-weight: 200; font-size: 8px; letter-spacing: 0.42em;
          text-transform: uppercase; color: rgba(200,169,110,0.75);
          margin-top: 2px;
        }
        .lh-nav-links {
          display: flex; align-items: center; gap: 28px;
          list-style: none; margin: 0; padding: 0;
        }
        .lh-nav-links a {
          font-weight: 300; font-size: 12px; letter-spacing: 0.16em;
          text-transform: uppercase; color: rgba(255,255,255,0.55);
          text-decoration: none; transition: color 0.2s;
        }
        .lh-nav-links a:hover { color: rgba(200,169,110,0.9); }
        .lh-nav-cta {
          font-weight: 500; font-size: 11px; letter-spacing: 0.16em;
          text-transform: uppercase; color: rgba(200,169,110,0.9);
          background: rgba(200,169,110,0.1); border: 1px solid rgba(200,169,110,0.35);
          padding: 8px 18px; border-radius: 2px; cursor: pointer;
          font-family: 'Jost', sans-serif; text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .lh-nav-cta:hover { background: rgba(200,169,110,0.18); border-color: rgba(200,169,110,0.6); }

        /* ── HERO ── */
        .lh-hero {
          position: relative; height: 100svh; min-height: 640px;
          overflow: hidden; display: flex; align-items: flex-end;
        }
        .lh-video-layer { position: absolute; inset: 0; overflow: hidden; }
        .lh-video-layer video, .lh-video-layer img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center 35%;
        }
        /* Grain */
        .lh-grain {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          opacity: 0.028;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 160px;
          animation: lhGrain 0.6s steps(1) infinite;
        }
        @keyframes lhGrain {
          0%{background-position:0 0}25%{background-position:-18px 9px}
          50%{background-position:9px -14px}75%{background-position:-9px 18px}
          100%{background-position:5px -5px}
        }
        /* Gradient overlays */
        .lh-ov-top {
          position: absolute; inset: 0; z-index: 3;
          background: linear-gradient(to bottom,
            rgba(0,0,0,0.55) 0%,
            rgba(0,0,0,0.05) 30%,
            rgba(0,0,0,0.05) 55%,
            rgba(0,0,0,0.85) 100%);
        }
        .lh-ov-left {
          position: absolute; inset: 0; z-index: 3;
          background: linear-gradient(to right, rgba(0,0,0,0.35) 0%, transparent 50%);
        }
        /* Vignette */
        .lh-vignette {
          position: absolute; inset: 0; z-index: 4;
          background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.42) 100%);
        }
        /* Scanline */
        .lh-scan {
          position: absolute; left: 0; right: 0; height: 1px; z-index: 5;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(200,169,110,0.3), transparent);
          animation: lhScan 8s ease-in-out infinite;
        }
        @keyframes lhScan {
          0%{top:0;opacity:0}5%{opacity:0.4}95%{opacity:0.08}100%{top:100%;opacity:0}
        }
        /* Corner marks */
        .lh-corner {
          position: absolute; width: 20px; height: 20px; z-index: 6; opacity: 0.35;
        }
        .lh-corner::before,.lh-corner::after{content:'';position:absolute;background:rgba(200,169,110,0.7);}
        .lh-corner.tl{top:24px;left:24px}.lh-corner.tl::before{top:0;left:0;width:20px;height:1px}.lh-corner.tl::after{top:0;left:0;width:1px;height:20px}
        .lh-corner.tr{top:24px;right:24px}.lh-corner.tr::before{top:0;right:0;width:20px;height:1px}.lh-corner.tr::after{top:0;right:0;width:1px;height:20px}
        .lh-corner.bl{bottom:24px;left:24px}.lh-corner.bl::before{bottom:0;left:0;width:20px;height:1px}.lh-corner.bl::after{bottom:0;left:0;width:1px;height:20px}
        .lh-corner.br{bottom:24px;right:24px}.lh-corner.br::before{bottom:0;right:0;width:20px;height:1px}.lh-corner.br::after{bottom:0;right:0;width:1px;height:20px}

        /* ── HERO CONTENT ── */
        .lh-content {
          position: relative; z-index: 10;
          width: 100%; max-width: 1280px; margin: 0 auto;
          padding: 0 clamp(20px, 5vw, 64px) clamp(48px, 7vh, 88px);
        }
        /* Reveal animations */
        .lh-r { opacity: 0; transform: translateY(22px); }
        .lh-r.show { animation: lhReveal 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes lhReveal { to { opacity: 1; transform: translateY(0); } }
        .lh-r1.show { animation-delay: 0.05s; }
        .lh-r2.show { animation-delay: 0.22s; }
        .lh-r3.show { animation-delay: 0.38s; }
        .lh-r4.show { animation-delay: 0.55s; }
        .lh-r5.show { animation-delay: 0.72s; }

        .lh-eyebrow {
          font-weight: 200; font-size: 10px; letter-spacing: 0.52em;
          text-transform: uppercase; color: rgba(200,169,110,0.8);
          margin-bottom: 16px; display: flex; align-items: center; gap: 12px;
        }
        .lh-eyebrow-line { width: 32px; height: 1px; background: rgba(200,169,110,0.5); }
        .lh-headline {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          font-size: clamp(40px, 6.5vw, 82px);
          line-height: 0.95; letter-spacing: -0.01em;
          color: #f5f0e8; margin-bottom: 6px;
        }
        .lh-headline em {
          font-style: italic; color: rgba(200,169,110,0.92);
        }
        .lh-headline-2 {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300;
          font-size: clamp(40px, 6.5vw, 82px);
          line-height: 0.95; letter-spacing: -0.01em;
          color: rgba(255,255,255,0.72); margin-bottom: 28px;
        }
        .lh-sub {
          font-weight: 300; font-size: clamp(14px, 1.6vw, 17px);
          color: rgba(245,240,232,0.52); line-height: 1.7;
          max-width: 440px; margin-bottom: 40px; letter-spacing: 0.02em;
        }
        .lh-cta-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
        .lh-cta-primary {
          display: flex; flex-direction: column; gap: 3px;
          padding: 16px 28px;
          background: linear-gradient(135deg, #c8a020, #f0c840);
          border: none; border-radius: 2px;
          color: #080800; cursor: pointer; font-family: 'Jost', sans-serif;
          text-align: left; min-width: 200px;
          transition: opacity 0.2s, transform 0.2s;
        }
        .lh-cta-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .lh-cta-primary .cta-title {
          font-weight: 500; font-size: 14px; letter-spacing: 0.06em;
        }
        .lh-cta-primary .cta-sub {
          font-weight: 300; font-size: 10px; letter-spacing: 0.1em;
          text-transform: uppercase; opacity: 0.65;
        }
        .lh-cta-ghost {
          display: flex; flex-direction: column; gap: 3px;
          padding: 15px 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 2px;
          color: rgba(245,240,232,0.75); cursor: pointer; font-family: 'Jost', sans-serif;
          text-align: left;
          transition: border-color 0.2s, background 0.2s;
        }
        .lh-cta-ghost:hover {
          border-color: rgba(200,169,110,0.4);
          background: rgba(200,169,110,0.06);
          color: rgba(200,169,110,0.9);
        }
        .lh-cta-ghost .cta-title { font-weight: 400; font-size: 13px; letter-spacing: 0.04em; }
        .lh-cta-ghost .cta-sub {
          font-weight: 200; font-size: 10px; letter-spacing: 0.1em;
          text-transform: uppercase; opacity: 0.5;
        }
        /* Scroll cue */
        .lh-scroll-cue {
          position: absolute; bottom: 28px; right: clamp(20px, 5vw, 64px);
          z-index: 10; display: flex; flex-direction: column;
          align-items: center; gap: 8px;
          opacity: 0.4;
          animation: lhReveal 1s ease forwards 1.4s, lhBob 2.4s ease-in-out 2s infinite;
        }
        @keyframes lhBob {
          0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)}
        }
        .lh-scroll-line {
          width: 1px; height: 42px;
          background: linear-gradient(to bottom, rgba(200,169,110,0.8), transparent);
        }
        .lh-scroll-label {
          font-weight: 200; font-size: 8px; letter-spacing: 0.4em;
          text-transform: uppercase; color: rgba(200,169,110,0.7);
          writing-mode: vertical-rl;
        }

        /* ── TRUST BAR ── */
        .lh-trust-bar {
          background: rgba(8,8,0,0.97); border-bottom: 0.5px solid rgba(200,169,110,0.1);
          padding: 24px clamp(20px, 5vw, 64px);
        }
        .lh-trust-inner {
          max-width: 1280px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
        }
        .lh-trust-item { display: flex; align-items: flex-start; gap: 14px; }
        .lh-trust-icon { font-size: 18px; flex-shrink: 0; margin-top: 2px; }
        .lh-trust-label {
          font-weight: 400; font-size: 13px; color: rgba(245,240,232,0.8);
          margin-bottom: 2px;
        }
        .lh-trust-sub {
          font-weight: 200; font-size: 11px; color: rgba(245,240,232,0.35);
          letter-spacing: 0.04em;
        }

        /* ── STATS BAND ── */
        .lh-stats {
          padding: 48px clamp(20px, 5vw, 64px);
          background: #080800;
          border-bottom: 0.5px solid rgba(255,255,255,0.05);
        }
        .lh-stats-inner {
          max-width: 1280px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px;
        }
        .lh-stat-item { text-align: center; }
        .lh-stat-num {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: clamp(36px, 4vw, 52px);
          color: rgba(200,169,110,0.9); line-height: 1;
          margin-bottom: 6px;
        }
        .lh-stat-label {
          font-weight: 200; font-size: 11px; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(245,240,232,0.3);
        }

        /* ── FOOTER ── */
        .lh-footer {
          background: #040400; border-top: 0.5px solid rgba(255,255,255,0.06);
          padding: 48px clamp(20px, 5vw, 64px) 32px;
        }
        .lh-footer-inner {
          max-width: 1280px; margin: 0 auto;
        }
        .lh-footer-top {
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px;
          margin-bottom: 48px;
        }
        .lh-footer-brand .lh-wm-top { font-size: 18px; margin-bottom: 4px; display: block; }
        .lh-footer-brand p {
          font-weight: 200; font-size: 12px; color: rgba(245,240,232,0.3);
          line-height: 1.7; margin-top: 12px; max-width: 280px; letter-spacing: 0.04em;
        }
        .lh-footer-col h4 {
          font-weight: 300; font-size: 10px; letter-spacing: 0.36em;
          text-transform: uppercase; color: rgba(200,169,110,0.7);
          margin-bottom: 16px;
        }
        .lh-footer-col ul { list-style: none; margin: 0; padding: 0; }
        .lh-footer-col li { margin-bottom: 10px; }
        .lh-footer-col a {
          font-weight: 200; font-size: 12px; letter-spacing: 0.06em;
          color: rgba(245,240,232,0.4); text-decoration: none;
          transition: color 0.2s;
        }
        .lh-footer-col a:hover { color: rgba(200,169,110,0.8); }
        .lh-footer-bottom {
          border-top: 0.5px solid rgba(255,255,255,0.05);
          padding-top: 24px; display: flex;
          justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 12px;
        }
        .lh-footer-legal {
          font-weight: 200; font-size: 10px; letter-spacing: 0.12em;
          color: rgba(245,240,232,0.2);
        }
        .lh-footer-legal a {
          color: rgba(245,240,232,0.3); text-decoration: none;
        }
        .lh-footer-legal a:hover { color: rgba(200,169,110,0.7); }
        .lh-asata {
          display: flex; align-items: center; gap: 8px;
          font-weight: 200; font-size: 10px; letter-spacing: 0.16em;
          text-transform: uppercase; color: rgba(245,240,232,0.25);
        }
        .lh-asata-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(200,169,110,0.6);
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .lh-nav-links { display: none; }
          .lh-trust-inner { grid-template-columns: 1fr 1fr; }
          .lh-stats-inner { grid-template-columns: 1fr 1fr; }
          .lh-footer-top { grid-template-columns: 1fr 1fr; gap: 32px; }
        }
        @media (max-width: 560px) {
          .lh-trust-inner { grid-template-columns: 1fr; }
          .lh-stats-inner { grid-template-columns: 1fr 1fr; }
          .lh-footer-top { grid-template-columns: 1fr; }
          .lh-cta-row { flex-direction: column; }
          .lh-cta-primary, .lh-cta-ghost { width: 100%; }
        }
      `}</style>

      <div className="lh-root">

        {/* ── NAV ── */}
        <NavBar onPlanJourney={onPlanJourney} />

        {/* ── HERO ── */}
        <section className="lh-hero">
          <div className="lh-video-layer">
            {heroVideoUrl ? (
              <video
                ref={videoRef}
                src={heroVideoUrl}
                autoPlay muted loop playsInline
                onCanPlayThrough={() => setVideoLoaded(true)}
                style={{ opacity: videoLoaded ? 1 : 0, transition: 'opacity 1.6s ease' }}
              />
            ) : null}
            {/* Fallback image — always present, video sits on top */}
            <img
              src={HERO_FALLBACK_IMAGE}
              alt="Luxury African safari"
              style={{ opacity: heroVideoUrl && videoLoaded ? 0 : 1, transition: 'opacity 1.6s ease' }}
            />
            <div className="lh-ov-top" />
            <div className="lh-ov-left" />
            <div className="lh-vignette" />
            <div className="lh-grain" />
            <div className="lh-scan" />
          </div>

          {/* Corner marks */}
          <div className="lh-corner tl" /><div className="lh-corner tr" />
          <div className="lh-corner bl" /><div className="lh-corner br" />

          {/* Content */}
          <div className="lh-content">
            <div className={`lh-r lh-r1 ${revealed ? 'show' : ''}`}>
              <div className="lh-eyebrow">
                <div className="lh-eyebrow-line" />
                Sub-Saharan Africa · Curated
              </div>
            </div>
            <div className={`lh-r lh-r2 ${revealed ? 'show' : ''}`}>
              <div className="lh-headline">Africa's finest</div>
            </div>
            <div className={`lh-r lh-r3 ${revealed ? 'show' : ''}`}>
              <div className="lh-headline-2">wilderness, <em>curated.</em></div>
            </div>
            <div className={`lh-r lh-r4 ${revealed ? 'show' : ''}`}>
              <p className="lh-sub">
                Handpicked lodges. Contracted rates 15–27% below direct.
                Expert sequencing. One specialist. Your journey, built in minutes.
              </p>
            </div>
            <div className={`lh-r lh-r5 ${revealed ? 'show' : ''}`}>
              <div className="lh-cta-row">
                <button className="lh-cta-primary" onClick={onPlanJourney}>
                  <span className="cta-title">✦ Plan My Journey</span>
                  <span className="cta-sub">Itinerary in under 30 seconds</span>
                </button>
                <button className="lh-cta-ghost" onClick={onCuratedJourneys}>
                  <span className="cta-title">Curated Journeys</span>
                  <span className="cta-sub">Ready to book — from price</span>
                </button>
                <button className="lh-cta-ghost" onClick={onSendBrief}>
                  <span className="cta-title">Send Your Brief</span>
                  <span className="cta-sub">We handle everything</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="lh-scroll-cue" style={{ opacity: 0 }}>
            <span className="lh-scroll-label">Scroll</span>
            <div className="lh-scroll-line" />
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <div className="lh-trust-bar">
          <div className="lh-trust-inner">
            {TRUST.map(t => (
              <div key={t.label} className="lh-trust-item">
                <span className="lh-trust-icon">{t.icon}</span>
                <div>
                  <div className="lh-trust-label">{t.label}</div>
                  <div className="lh-trust-sub">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="lh-stats">
          <div className="lh-stats-inner">
            {STATS.map(s => (
              <div key={s.label} className="lh-stat-item">
                <div className="lh-stat-num">
                  <AnimatedNumber value={s.value} />{s.suffix}
                </div>
                <div className="lh-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="lh-footer">
          <div className="lh-footer-inner">
            <div className="lh-footer-top">
              <div className="lh-footer-brand">
                <span className="lh-wm-top">The Safari Edition</span>
                <div className="lh-wm-sub">by The Travel Catalogue</div>
                <p>
                  Africa's finest wilderness properties, curated and contracted.
                  Specialist knowledge at software speed. Available for UK, US
                  and German travellers.
                </p>
              </div>
              <div className="lh-footer-col">
                <h4>Journey</h4>
                <ul>
                  <li><a href="#plan">Plan My Journey</a></li>
                  <li><a href="#curated">Curated Trips</a></li>
                  <li><a href="#brief">Send a Brief</a></li>
                  <li><a href="/how-it-works">How It Works</a></li>
                </ul>
              </div>
              <div className="lh-footer-col">
                <h4>Company</h4>
                <ul>
                  <li><a href="/about">About Us</a></li>
                  <li><a href="/specialists">Our Specialists</a></li>
                  <li><a href="/suppliers">Our Partners</a></li>
                  <li><a href="/contact">Contact</a></li>
                </ul>
              </div>
              <div className="lh-footer-col">
                <h4>Legal</h4>
                <ul>
                  <li><a href="/terms">Terms & Conditions</a></li>
                  <li><a href="/privacy">Privacy Policy</a></li>
                  <li><a href="/cancellation">Cancellation Policy</a></li>
                  <li><a href="/complaints">Complaints</a></li>
                </ul>
              </div>
            </div>
            <div className="lh-footer-bottom">
              <div className="lh-footer-legal">
                © {new Date().getFullYear()} The Safari Edition · A Travel Catalogue Edition ·{' '}
                <a href="/terms">T&Cs</a> · <a href="/privacy">Privacy</a>
              </div>
              <div className="lh-asata">
                <div className="lh-asata-dot" />
                ASATA Member
                <div className="lh-asata-dot" />
                SATSA Member
                <div className="lh-asata-dot" />
                POPIA Compliant
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavBar({ onPlanJourney }: { onPlanJourney: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav className={`lh-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="lh-nav-inner">
        <a href="/" className="lh-wordmark">
          <div className="lh-diamond-wrap">
            <div className="lh-diamond-outer" />
            <div className="lh-diamond-inner" />
          </div>
          <div className="lh-wm-text">
            <span className="lh-wm-top">The Safari Edition</span>
            <span className="lh-wm-sub">Sub-Saharan Africa · Curated</span>
          </div>
        </a>
        <ul className="lh-nav-links">
          <li><a href="/how-it-works">How It Works</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
        <button className="lh-nav-cta" onClick={onPlanJourney}>
          Plan My Journey
        </button>
      </div>
    </nav>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const isFloat = !Number.isInteger(value);
        const duration = 1400;
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = isFloat
            ? Math.round(eased * value * 10) / 10
            : Math.round(eased * value);
          setDisplay(current);
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);
  return <span ref={ref}>{display}</span>;
}
