'use client';

// THE ISLAND EDITION — Landing Page
// Indian Ocean · Maldives · Seychelles · Zanzibar · Mauritius · Réunion
// Coming Soon — no working booking links. Boilerplate buttons only.
// Design: Midnight Ocean · Pearl White · Seafoam · Warm Champagne

import { useState, useEffect, useRef } from 'react';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1800&q=85';

const ISLANDS = [
  { name: 'Maldives',    tagline: 'Overwater infinity',        image: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&q=80',  icon: '◈' },
  { name: 'Seychelles',  tagline: 'Ancient granite paradise',  image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',  icon: '◈' },
  { name: 'Zanzibar',    tagline: 'Spice island, turquoise sea',image: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=800&q=80', icon: '◈' },
  { name: 'Mauritius',   tagline: 'Private estates, private reefs', image: 'https://images.unsplash.com/photo-1560269999-cef6ebd23ad7?w=800&q=80', icon: '◈' },
  { name: 'Réunion',     tagline: 'Volcanic peaks, crystal shores',  image: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=800&q=80', icon: '◈' },
];

const JOURNEYS = [
  { name: 'The Maldives Collection',      tagline: 'North Malé Atoll · Overwater villas',       nights: 7,  priceFrom: 285000,  otaPrice: 390000,  badge: 'Most requested',  badgeColor: '#22D3EE', image: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&q=80' },
  { name: 'Seychelles & Zanzibar',        tagline: 'La Digue · Praslin · Pemba Island',          nights: 10, priceFrom: 340000,  otaPrice: 465000,  badge: 'Two-island escape',badgeColor: '#A78BFA', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80' },
  { name: 'Mauritius Grand Estate',       tagline: 'West coast · Private estate · Lagoon access',nights: 8,  priceFrom: 295000,  otaPrice: 408000,  badge: 'Our favourite',    badgeColor: '#B8976E', image: 'https://images.unsplash.com/photo-1560269999-cef6ebd23ad7?w=800&q=80' },
  { name: 'Indian Ocean Grand Tour',      tagline: 'Maldives · Seychelles · Zanzibar',           nights: 14, priceFrom: 580000,  otaPrice: 790000,  badge: 'Signature',        badgeColor: '#4ECDC4', image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80' },
];

const TRUST = [
  {
    svg: `<svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M9 1.5L2 4.5V10.5C2 14.42 5.18 18.08 9 19.5C12.82 18.08 16 14.42 16 10.5V4.5L9 1.5Z" stroke="rgba(180,230,220,0.7)" stroke-width="0.9" stroke-linejoin="round"/><path d="M6 10.5L7.8 12.3L12 8.5" stroke="rgba(180,230,220,0.7)" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    label: 'Contracted rates', sub: 'Up to 24% below direct booking*'
  },
  {
    svg: `<svg width="20" height="16" viewBox="0 0 20 16" fill="none"><path d="M1 8C1 8 4 2 10 2C16 2 19 8 19 8C19 8 16 14 10 14C4 14 1 8 1 8Z" stroke="rgba(180,230,220,0.7)" stroke-width="0.9"/><circle cx="10" cy="8" r="2.5" stroke="rgba(180,230,220,0.7)" stroke-width="0.9"/><circle cx="10" cy="8" r="0.8" fill="rgba(180,230,220,0.45)"/></svg>`,
    label: 'Verified resorts', sub: 'Every property personally inspected'
  },
  {
    svg: `<svg width="16" height="21" viewBox="0 0 16 21" fill="none"><circle cx="8" cy="5.5" r="3.5" stroke="rgba(180,230,220,0.7)" stroke-width="0.9"/><path d="M1 19.5C1 15.634 4.134 12.5 8 12.5C11.866 12.5 15 15.634 15 19.5" stroke="rgba(180,230,220,0.7)" stroke-width="0.9" stroke-linecap="round"/></svg>`,
    label: 'Dedicated concierge', sub: 'Your personal island planner'
  },
  {
    svg: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2C5.58 2 2 5.58 2 10C2 14.42 5.58 18 10 18C14.42 18 18 14.42 18 10" stroke="rgba(180,230,220,0.7)" stroke-width="0.9" stroke-linecap="round"/><path d="M14 2H18V6" stroke="rgba(180,230,220,0.7)" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 2L12 8" stroke="rgba(180,230,220,0.7)" stroke-width="0.9" stroke-linecap="round"/></svg>`,
    label: 'Flexible terms', sub: 'Best cancellation in the market'
  },
];

const STATS = [
  { value: 38,  suffix: '+',   label: 'Island resorts' },
  { value: 24,  suffix: '%',   label: 'Up to 24% saving*' },
  { value: 9,   suffix: 'min', label: 'Avg. planning time' },
  { value: 5,   suffix: '★',   label: 'Ocean destinations' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$',  rate: 18.62 },
  { code: 'GBP', symbol: '£',  rate: 23.48 },
  { code: 'EUR', symbol: '€',  rate: 20.14 },
  { code: 'ZAR', symbol: 'R ', rate: 1     },
];

const OTHER_EDITIONS = [
  { id: 'safari', name: 'The Safari Edition', icon: '◆', desc: 'Sub-Saharan Africa · Active', color: '#D4AF37', available: true,  href: '/' },
  { id: 'ski',    name: 'The Ski Edition',    icon: '◇', desc: 'Alps · Aspen · Hokkaido',    color: '#A78BFA', available: false, href: null },
  { id: 'japan',  name: 'The Japan Edition',  icon: '◇', desc: 'Tokyo · Kyoto · Hokkaido',   color: '#F87171', available: false, href: null },
];

function ComingSoonToast({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(10,18,30,0.97)', border: '0.5px solid rgba(78,205,196,0.35)', borderRadius: 10, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ECDC4', flexShrink: 0 }} />
      <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 200, fontSize: 13, color: 'rgba(240,235,228,0.85)', margin: 0, letterSpacing: '0.04em' }}>
        The Island Edition is coming soon — we'll be in touch.
      </p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(240,235,228,0.4)', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', padding: 0, lineHeight: 1 }}>×</button>
    </div>
  );
}

function AnimatedNum({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; obs.disconnect();
      const isFloat = !Number.isInteger(value);
      const start = Date.now(); const dur = 1400;
      const tick = () => {
        const p = Math.min((Date.now() - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setN(isFloat ? Math.round(ease * value * 10) / 10 : Math.round(ease * value));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);
  return <span ref={ref}>{n}</span>;
}

export default function IslandEditionLanding() {
  const [toast, setToast]           = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [editionOpen, setEditionOpen] = useState(false);
  const [currency, setCurrency]     = useState(CURRENCIES[0]);
  const [revealed, setRevealed]     = useState(true);
  const fmt = (n: number) => `${currency.symbol}${Math.round(n / currency.rate).toLocaleString()}`;
  const noop = () => setToast(true);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap');

        /* ── ISLAND EDITION — TOKENS ───────────────────────────── */
        :root {
          --ie-bg:        #060F1E;
          --ie-bg2:       #07121F;
          --ie-teal:      #4ECDC4;
          --ie-teal-dim:  rgba(78,205,196,0.12);
          --ie-teal-brd:  rgba(78,205,196,0.25);
          --ie-pearl:     #FAF7F0;
          --ie-text:      rgba(240,235,228,0.90);
          --ie-textMid:   rgba(240,235,228,0.60);
          --ie-textDim:   rgba(240,235,228,0.32);
          --ie-gold:      #B8976E;
          --ie-gold-dim:  rgba(184,151,110,0.10);
          --ie-gold-brd:  rgba(184,151,110,0.28);
          --ie-border:    rgba(255,255,255,0.07);
          --ie-surface:   rgba(255,255,255,0.04);
        }

        .ie-root { font-family:'Jost',sans-serif; background:var(--ie-bg); color:var(--ie-text); }

        /* NAV */
        .ie-nav {
          position:fixed; top:0; left:0; right:0; z-index:200;
          height:64px; padding:0 clamp(16px,4vw,56px);
          display:flex; align-items:center; justify-content:space-between;
          background:linear-gradient(to bottom,rgba(6,15,30,0.85) 0%,transparent 100%);
          transition:background 0.4s, border-color 0.4s;
        }
        .ie-nav.scrolled {
          background:rgba(5,12,24,0.97); backdrop-filter:blur(20px);
          border-bottom:0.5px solid rgba(78,205,196,0.1);
        }
        .ie-wordmark { display:flex; align-items:center; gap:10px; cursor:pointer; text-decoration:none; }
        .ie-gem { position:relative; width:24px; height:24px; flex-shrink:0; }
        .ie-gem-outer { position:absolute; inset:0; border:1px solid rgba(78,205,196,0.6); transform:rotate(45deg); }
        .ie-gem-inner { position:absolute; inset:7px; background:rgba(78,205,196,0.75); transform:rotate(45deg); }
        .ie-wm-title { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:15px; color:rgba(78,205,196,0.9); letter-spacing:0.08em; display:block; }
        .ie-wm-sub   { font-weight:200; font-size:7.5px; letter-spacing:0.44em; text-transform:uppercase; color:rgba(78,205,196,0.45); display:block; margin-top:1px; }

        .ie-nav-links { display:flex; align-items:center; gap:24px; list-style:none; margin:0; padding:0; }
        .ie-nav-links a { font-weight:300; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(240,235,228,0.45); text-decoration:none; transition:color 0.2s; }
        .ie-nav-links a:hover { color:rgba(78,205,196,0.85); }

        .ie-nav-right { display:flex; align-items:center; gap:10px; }
        .ie-currency-sel {
          background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.1);
          color:rgba(240,235,228,0.55); border-radius:4px; padding:6px 10px;
          font-size:11px; outline:none; cursor:pointer; font-family:'Jost',sans-serif;
          letter-spacing:0.1em; appearance:none;
        }
        .ie-currency-sel:hover { border-color:rgba(78,205,196,0.3); color:rgba(78,205,196,0.8); }
        .ie-currency-sel option { background:#060F1E; color:#f5f0e8; }
        .ie-nav-partner { font-size:11px; letter-spacing:0.14em; color:rgba(240,235,228,0.3); text-decoration:none; padding:6px 12px; border:0.5px solid rgba(255,255,255,0.1); border-radius:4px; background:none; cursor:pointer; font-family:'Jost',sans-serif; transition:border-color 0.2s, color 0.2s; }
        .ie-nav-partner:hover { border-color:rgba(78,205,196,0.4); color:rgba(78,205,196,0.8); }
        .ie-nav-cta { font-weight:500; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--ie-bg); background:var(--ie-teal); border:none; padding:9px 18px; border-radius:2px; cursor:pointer; font-family:'Jost',sans-serif; transition:opacity 0.2s; }
        .ie-nav-cta:hover { opacity:0.88; }

        /* Edition dropdown */
        .ie-edition-btn { background:none; border:none; cursor:pointer; font-family:'Jost',sans-serif; display:flex; align-items:center; gap:5px; padding:6px 8px; }
        .ie-edition-arrow { font-size:9px; color:rgba(78,205,196,0.45); }
        .ie-edition-menu { position:absolute; top:calc(100% + 6px); left:0; min-width:240px; background:#060F1E; border:0.5px solid rgba(78,205,196,0.2); border-radius:10px; padding:8px; z-index:300; box-shadow:0 8px 40px rgba(0,0,0,0.7); }
        .ie-edition-current { padding:10px 12px; background:rgba(78,205,196,0.07); border-radius:8px; margin-bottom:6px; }
        .ie-edition-item { padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:10px; opacity:0.5; }
        .ie-edition-badge { font-size:9px; color:#a78bfa; background:rgba(167,139,250,0.1); border:0.5px solid rgba(167,139,250,0.25); border-radius:20px; padding:2px 7px; margin-left:auto; }
        .ie-edition-available { font-size:9px; color:var(--ie-teal); background:var(--ie-teal-dim); border:0.5px solid var(--ie-teal-brd); border-radius:20px; padding:2px 7px; margin-left:auto; }

        /* HERO */
        .ie-hero { position:relative; height:100svh; min-height:640px; overflow:hidden; display:flex; flex-direction:column; }
        .ie-bg { position:absolute; inset:0; overflow:hidden; }
        .ie-bg img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 40%; }
        /* Deep ocean gradient overlays */
        .ie-ov1 { position:absolute; inset:0; z-index:3; background:linear-gradient(to bottom,rgba(6,15,30,0.55) 0%,rgba(6,15,30,0) 35%,rgba(6,15,30,0.05) 60%,rgba(6,15,30,0.92) 100%); }
        .ie-ov2 { position:absolute; inset:0; z-index:3; background:linear-gradient(to right,rgba(6,15,30,0.55) 0%,transparent 60%); }
        /* Subtle teal glow at the horizon */
        .ie-teal-glow { position:absolute; bottom:0; left:0; right:0; height:40%; z-index:2; background:linear-gradient(to top,rgba(78,205,196,0.06) 0%,transparent 100%); pointer-events:none; }
        .ie-vignette { position:absolute; inset:0; z-index:4; background:radial-gradient(ellipse at center,transparent 40%,rgba(6,15,30,0.45) 100%); }
        .ie-grain { position:absolute; inset:0; z-index:5; pointer-events:none; opacity:0.02; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size:160px; }

        /* Corner marks — teal variant */
        .ie-corner { position:absolute; width:16px; height:16px; z-index:6; opacity:0.25; }
        .ie-corner::before,.ie-corner::after{content:'';position:absolute;background:rgba(78,205,196,0.7);}
        .ie-corner.tl{top:22px;left:22px}.ie-corner.tl::before{top:0;left:0;width:16px;height:1px}.ie-corner.tl::after{top:0;left:0;width:1px;height:16px}
        .ie-corner.tr{top:22px;right:22px}.ie-corner.tr::before{top:0;right:0;width:16px;height:1px}.ie-corner.tr::after{top:0;right:0;width:1px;height:16px}
        .ie-corner.bl{bottom:22px;left:22px}.ie-corner.bl::before{bottom:0;left:0;width:16px;height:1px}.ie-corner.bl::after{bottom:0;left:0;width:1px;height:16px}
        .ie-corner.br{bottom:22px;right:22px}.ie-corner.br::before{bottom:0;right:0;width:16px;height:1px}.ie-corner.br::after{bottom:0;right:0;width:1px;height:16px}

        /* Logo area */
        .ie-logo-area {
          position:relative; z-index:10; flex:0 0 auto;
          display:flex; align-items:center; justify-content:center;
          padding-top:110px;
        }
        .ie-logo-text { text-align:center; }
        .ie-logo-line { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:10px; }
        .ie-logo-div  { width:36px; height:0.5px; background:rgba(78,205,196,0.35); }
        .ie-logo-name { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(26px,4.5vw,50px); letter-spacing:0.22em; color:rgba(240,235,228,0.92); text-transform:uppercase; line-height:1; }
        .ie-logo-sub  { font-weight:200; font-size:9px; letter-spacing:0.55em; text-transform:uppercase; color:rgba(78,205,196,0.5); margin-top:6px; }

        /* Content */
        .ie-content { position:relative; z-index:10; flex:1; display:flex; align-items:flex-end; padding:0 clamp(20px,5vw,64px) clamp(40px,6vh,72px); }
        .ie-content-inner { max-width:500px; }
        .ie-r { opacity:0; transform:translateY(18px); }
        .ie-r.show { animation:ieReveal 0.9s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes ieReveal { to { opacity:1; transform:translateY(0); } }
        .ie-r1.show{animation-delay:0.08s}.ie-r2.show{animation-delay:0.2s}.ie-r3.show{animation-delay:0.34s}.ie-r4.show{animation-delay:0.5s}.ie-r5.show{animation-delay:0.66s}

        .ie-eyebrow { font-weight:200; font-size:10px; letter-spacing:0.5em; text-transform:uppercase; color:rgba(78,205,196,0.65); display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .ie-eyebrow-line { width:28px; height:1px; background:rgba(78,205,196,0.4); }
        .ie-h1 { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(36px,5.5vw,66px); line-height:0.95; color:var(--ie-pearl); margin-bottom:4px; }
        .ie-h2 { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(36px,5.5vw,66px); line-height:0.95; color:rgba(255,255,255,0.5); margin-bottom:26px; }
        .ie-h2 em { font-style:italic; color:rgba(78,205,196,0.88); }
        .ie-sub { font-weight:300; font-size:clamp(13px,1.4vw,15px); color:rgba(240,235,228,0.42); line-height:1.8; max-width:400px; margin-bottom:32px; letter-spacing:0.03em; }
        .ie-ctas { display:flex; gap:10px; flex-wrap:wrap; }
        .ie-cta-primary { display:flex; flex-direction:column; gap:2px; padding:15px 26px; background:var(--ie-teal); border:none; border-radius:2px; color:#040C1A; cursor:pointer; font-family:'Jost',sans-serif; text-align:left; transition:opacity 0.2s; }
        .ie-cta-primary:hover { opacity:0.9; }
        .ie-cta-title { font-weight:500; font-size:13px; letter-spacing:0.06em; }
        .ie-cta-sub   { font-weight:200; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; opacity:0.6; }
        .ie-cta-ghost { display:flex; flex-direction:column; gap:2px; padding:14px 20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.13); border-radius:2px; color:rgba(240,235,228,0.65); cursor:pointer; font-family:'Jost',sans-serif; text-align:left; transition:border-color 0.2s, color 0.2s; }
        .ie-cta-ghost:hover { border-color:rgba(78,205,196,0.4); color:rgba(78,205,196,0.9); }

        /* Scroll cue */
        .ie-scroll { position:absolute; bottom:24px; right:clamp(16px,4vw,52px); z-index:10; display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0; animation:ieReveal 1s ease forwards 1.3s, ieBob 2.5s ease-in-out 2s infinite; }
        @keyframes ieBob { 0%,100%{transform:translateY(0)}50%{transform:translateY(5px)} }
        .ie-scroll-line { width:1px; height:36px; background:linear-gradient(to bottom,rgba(78,205,196,0.6),transparent); }
        .ie-scroll-lbl  { font-weight:200; font-size:7px; letter-spacing:0.45em; text-transform:uppercase; color:rgba(78,205,196,0.5); writing-mode:vertical-rl; }

        /* TRUST BAR */
        .ie-trust { background:rgba(5,12,24,0.98); border-bottom:0.5px solid rgba(78,205,196,0.07); padding:22px clamp(20px,5vw,64px); }
        .ie-trust-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        .ie-trust-item { display:flex; align-items:flex-start; gap:12px; }
        .ie-trust-lbl  { font-weight:400; font-size:12px; color:rgba(240,235,228,0.72); margin-bottom:2px; }
        .ie-trust-sub  { font-weight:200; font-size:11px; color:rgba(240,235,228,0.3); letter-spacing:0.03em; }

        /* STATS */
        .ie-stats { padding:44px clamp(20px,5vw,64px); background:var(--ie-bg2); border-bottom:0.5px solid rgba(255,255,255,0.04); }
        .ie-stats-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:28px; }
        .ie-stat-n { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(34px,4vw,50px); color:rgba(78,205,196,0.82); line-height:1; margin-bottom:6px; text-align:center; }
        .ie-stat-l { font-weight:200; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(240,235,228,0.26); text-align:center; }

        /* DESTINATIONS */
        .ie-dest { padding:64px clamp(20px,5vw,64px); background:var(--ie-bg); }
        .ie-dest-inner { max-width:1200px; margin:0 auto; }
        .ie-section-eyebrow { font-weight:200; font-size:10px; letter-spacing:0.44em; text-transform:uppercase; color:rgba(78,205,196,0.55); margin-bottom:10px; }
        .ie-section-title { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(24px,3.5vw,38px); color:var(--ie-pearl); margin-bottom:4px; }
        .ie-section-sub { font-weight:300; font-size:13px; color:rgba(240,235,228,0.35); margin-bottom:32px; letter-spacing:0.04em; }

        /* Island destination scroll */
        .ie-dest-scroll { display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; scrollbar-width:none; }
        .ie-dest-scroll::-webkit-scrollbar { display:none; }
        .ie-dest-card { flex:0 0 clamp(180px,22vw,220px); border-radius:12px; overflow:hidden; position:relative; cursor:pointer; border:0.5px solid rgba(255,255,255,0.06); transition:border-color 0.3s, transform 0.3s; }
        .ie-dest-card:hover { border-color:rgba(78,205,196,0.3); transform:translateY(-3px); }
        .ie-dest-card img { width:100%; height:260px; object-fit:cover; transition:transform 0.6s; display:block; }
        .ie-dest-card:hover img { transform:scale(1.05); }
        .ie-dest-ov { position:absolute; inset:0; background:linear-gradient(to top,rgba(6,15,30,0.88) 0%,rgba(6,15,30,0.1) 55%); }
        .ie-dest-body { position:absolute; bottom:0; left:0; right:0; padding:14px; }
        .ie-dest-name { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:17px; color:var(--ie-pearl); margin-bottom:3px; }
        .ie-dest-tag  { font-weight:200; font-size:10px; color:rgba(78,205,196,0.7); letter-spacing:0.06em; }

        /* JOURNEYS GRID */
        .ie-journeys { padding:64px clamp(20px,5vw,64px); background:var(--ie-bg2); }
        .ie-journeys-inner { max-width:1200px; margin:0 auto; }
        .ie-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
        .ie-card { background:rgba(255,255,255,0.025); border:0.5px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; cursor:pointer; transition:border-color 0.25s, transform 0.25s; }
        .ie-card:hover { border-color:rgba(78,205,196,0.25); transform:translateY(-2px); }
        .ie-card-img { position:relative; height:185px; overflow:hidden; }
        .ie-card-img img { width:100%; height:100%; object-fit:cover; transition:transform 0.6s; display:block; }
        .ie-card:hover .ie-card-img img { transform:scale(1.04); }
        .ie-card-img-ov { position:absolute; inset:0; background:linear-gradient(to top,rgba(6,15,30,0.75) 0%,transparent 55%); }
        .ie-card-body { padding:14px 16px; }
        .ie-card-name { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:16px; color:var(--ie-pearl); margin-bottom:3px; }
        .ie-card-tag  { font-weight:200; font-size:11px; color:rgba(240,235,228,0.35); margin-bottom:12px; letter-spacing:0.03em; }
        .ie-card-row  { display:flex; justify-content:space-between; align-items:baseline; }
        .ie-card-price { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:20px; color:rgba(78,205,196,0.85); }
        .ie-card-nights { font-size:10px; color:rgba(240,235,228,0.28); letter-spacing:0.1em; }
        .ie-card-saving { font-size:10px; color:#4ade80; }

        /* VIEW ALL */
        .ie-view-btn { padding:12px 32px; border:0.5px solid rgba(255,255,255,0.12); border-radius:2px; background:transparent; color:rgba(240,235,228,0.45); font-size:12px; letter-spacing:0.16em; text-transform:uppercase; cursor:pointer; font-family:'Jost',sans-serif; transition:border-color 0.2s, color 0.2s; font-weight:300; }
        .ie-view-btn:hover { border-color:rgba(78,205,196,0.4); color:rgba(78,205,196,0.8); }

        /* FOOTER */
        .ie-footer { background:#030A14; border-top:0.5px solid rgba(255,255,255,0.05); padding:44px clamp(20px,5vw,64px) 28px; }
        .ie-footer-inner { max-width:1200px; margin:0 auto; }
        .ie-footer-top { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:44px; margin-bottom:40px; }
        .ie-footer-brand-name { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:18px; color:rgba(78,205,196,0.75); letter-spacing:0.1em; display:block; margin-bottom:4px; }
        .ie-footer-brand-sub  { font-weight:200; font-size:8px; letter-spacing:0.36em; text-transform:uppercase; color:rgba(78,205,196,0.35); display:block; margin-bottom:12px; }
        .ie-footer-brand p { font-weight:200; font-size:12px; color:rgba(240,235,228,0.26); line-height:1.7; max-width:260px; }
        .ie-footer-col h4 { font-weight:200; font-size:9px; letter-spacing:0.4em; text-transform:uppercase; color:rgba(78,205,196,0.45); margin-bottom:14px; }
        .ie-footer-col ul { list-style:none; margin:0; padding:0; }
        .ie-footer-col li { margin-bottom:9px; }
        .ie-footer-col button, .ie-footer-col a { background:none; border:none; font-weight:200; font-size:12px; letter-spacing:0.06em; color:rgba(240,235,228,0.3); text-decoration:none; cursor:pointer; font-family:'Jost',sans-serif; padding:0; text-align:left; transition:color 0.2s; }
        .ie-footer-col button:hover, .ie-footer-col a:hover { color:rgba(78,205,196,0.7); }
        .ie-footer-bottom { border-top:0.5px solid rgba(255,255,255,0.05); padding-top:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
        .ie-footer-legal { font-weight:200; font-size:10px; letter-spacing:0.1em; color:rgba(240,235,228,0.2); }
        .ie-footer-legal button { background:none; border:none; font-weight:200; font-size:10px; letter-spacing:0.1em; color:rgba(240,235,228,0.28); cursor:pointer; font-family:'Jost',sans-serif; padding:0; }
        .ie-adot { display:inline-block; width:3px; height:3px; border-radius:50%; background:rgba(78,205,196,0.45); margin:0 6px; vertical-align:middle; }
        .ie-badge { display:inline-flex; align-items:center; gap:6px; font-weight:200; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(240,235,228,0.2); }

        /* Toast */
        @keyframes fadeUp { from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)} }

        /* Responsive */
        @media(max-width:900px){
          .ie-nav-links{display:none;}
          .ie-trust-inner{grid-template-columns:1fr 1fr;}
          .ie-stats-inner{grid-template-columns:1fr 1fr;}
          .ie-footer-top{grid-template-columns:1fr 1fr;gap:28px;}
        }
        @media(max-width:560px){
          .ie-trust-inner{grid-template-columns:1fr;}
          .ie-footer-top{grid-template-columns:1fr;}
          .ie-ctas{flex-direction:column;}
        }
      `}</style>

      <div className="ie-root">

        {/* NAV */}
        <nav className={`ie-nav ${scrolled ? 'scrolled' : ''}`}>
          {/* Left: wordmark + edition switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="ie-wordmark" onClick={noop}>
              <div className="ie-gem"><div className="ie-gem-outer"/><div className="ie-gem-inner"/></div>
              <div>
                <span className="ie-wm-title">The Island Edition</span>
                <span className="ie-wm-sub">Indian Ocean · Handpicked</span>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <button className="ie-edition-btn" onClick={() => setEditionOpen(v => !v)}>
                <span className="ie-edition-arrow">{editionOpen ? '▲' : '▼'}</span>
              </button>
              {editionOpen && (
                <div className="ie-edition-menu">
                  <div className="ie-edition-current">
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(78,205,196,0.9)' }}>◈ The Island Edition</div>
                    <div style={{ fontSize: 10, color: 'rgba(240,235,228,0.3)', marginTop: 2 }}>Indian Ocean · Coming Soon</div>
                  </div>
                  {OTHER_EDITIONS.map(e => (
                    e.available && e.href ? (
                      <a
                        key={e.id}
                        href={e.href}
                        className="ie-edition-item"
                        style={{ opacity: 1, cursor: 'pointer', textDecoration: 'none', transition: 'background 0.15s' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(212,175,55,0.07)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                        onClick={() => setEditionOpen(false)}
                      >
                        <span style={{ fontSize: 14, color: e.color }}>{e.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: e.color, fontWeight: 500 }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(240,235,228,0.35)' }}>{e.desc}</div>
                        </div>
                        <span className="ie-edition-available">Visit →</span>
                      </a>
                    ) : (
                      <div key={e.id} className="ie-edition-item" style={{ opacity: 0.4 }}>
                        <span style={{ fontSize: 14, color: e.color }}>{e.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'rgba(240,235,228,0.55)', fontWeight: 400 }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(240,235,228,0.28)' }}>{e.desc}</div>
                        </div>
                        <span className="ie-edition-badge">Soon</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Centre */}
          <ul className="ie-nav-links">
            <li><a href="#" onClick={e => { e.preventDefault(); noop(); }}>Destinations</a></li>
            <li><a href="#" onClick={e => { e.preventDefault(); noop(); }}>How It Works</a></li>
            <li><a href="#" onClick={e => { e.preventDefault(); noop(); }}>Contact</a></li>
          </ul>

          {/* Right */}
          <div className="ie-nav-right">
            <select className="ie-currency-sel" value={currency.code} onChange={e => {
              const c = CURRENCIES.find(x => x.code === e.target.value);
              if (c) setCurrency(c);
            }}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <button className="ie-nav-partner" onClick={noop}>Partner Login</button>
            <button className="ie-nav-cta" onClick={noop}>Plan My Journey</button>
          </div>
        </nav>
        {editionOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setEditionOpen(false)} />}

        {/* HERO */}
        <section className="ie-hero">
          <div className="ie-bg">
            <img src={HERO_IMAGE} alt="The Island Edition" />
            <div className="ie-ov1" /><div className="ie-ov2" />
            <div className="ie-teal-glow" />
            <div className="ie-vignette" /><div className="ie-grain" />
          </div>

          <div className="ie-corner tl"/><div className="ie-corner tr"/>
          <div className="ie-corner bl"/><div className="ie-corner br"/>

          {/* Logo */}
          <div className="ie-logo-area">
            <div className="ie-logo-text">
              <div className="ie-logo-line">
                <div className="ie-logo-div"/>
                <div style={{ width: 8, height: 8, border: '1px solid rgba(78,205,196,0.55)', transform: 'rotate(45deg)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 2, background: 'rgba(78,205,196,0.65)', transform: 'none' }}/>
                </div>
                <div className="ie-logo-div"/>
              </div>
              <div className="ie-logo-name">The Island Edition</div>
              <div className="ie-logo-sub">Indian Ocean · Curated</div>
            </div>
          </div>

          {/* Content */}
          <div className="ie-content">
            <div className="ie-content-inner">
              <div className={`ie-r ie-r1 ${revealed ? 'show' : ''}`}>
                <div className="ie-eyebrow">
                  <div className="ie-eyebrow-line"/>
                  Indian Ocean · Maldives · Seychelles · Zanzibar
                </div>
              </div>
              <div className={`ie-r ie-r2 ${revealed ? 'show' : ''}`}>
                <div className="ie-h1">The ocean's finest</div>
              </div>
              <div className={`ie-r ie-r3 ${revealed ? 'show' : ''}`}>
                <div className="ie-h2">islands, <em>yours.</em></div>
              </div>
              <div className={`ie-r ie-r4 ${revealed ? 'show' : ''}`}>
                <p className="ie-sub">
                  Private overwater villas. Contracted rates up to 24% below direct.<br/>
                  Bespoke sequencing. Your dedicated island concierge. Complete in minutes.
                </p>
              </div>
              <div className={`ie-r ie-r5 ${revealed ? 'show' : ''}`}>
                <div className="ie-ctas">
                  <button className="ie-cta-primary" onClick={noop}>
                    <span className="ie-cta-title">◈ Plan My Journey</span>
                    <span className="ie-cta-sub">Itinerary built in minutes</span>
                  </button>
                  <button className="ie-cta-ghost" onClick={noop}>
                    <span className="ie-cta-title">Signature Journeys</span>
                    <span className="ie-cta-sub">Ready to book · from price</span>
                  </button>
                  <button className="ie-cta-ghost" onClick={noop}>
                    <span className="ie-cta-title">Send Your Brief</span>
                    <span className="ie-cta-sub">We handle everything</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="ie-scroll">
            <span className="ie-scroll-lbl">Scroll</span>
            <div className="ie-scroll-line"/>
          </div>
        </section>

        {/* TRUST BAR */}
        <div className="ie-trust">
          <div className="ie-trust-inner">
            {TRUST.map(t => (
              <div key={t.label} className="ie-trust-item">
                <div style={{ flexShrink: 0, marginTop: 2, width: 20, display: 'flex', alignItems: 'flex-start' }} dangerouslySetInnerHTML={{ __html: t.svg }}/>
                <div>
                  <div className="ie-trust-lbl">{t.label}</div>
                  <div className="ie-trust-sub">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div className="ie-stats">
          <div className="ie-stats-inner">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="ie-stat-n"><AnimatedNum value={s.value}/>{s.suffix}</div>
                <div className="ie-stat-l">{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ maxWidth: 1200, margin: '18px auto 0', paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontWeight: 200, fontSize: 10, color: 'rgba(240,235,228,0.2)', letterSpacing: '0.04em', margin: 0 }}>
              * Saving compared to booking directly with the resort. Actual saving varies by property, season and room type.
            </p>
          </div>
        </div>

        {/* ISLAND DESTINATIONS */}
        <div className="ie-dest">
          <div className="ie-dest-inner">
            <div className="ie-section-eyebrow">Ocean Destinations</div>
            <div className="ie-section-title">Five oceans. One concierge.</div>
            <div className="ie-section-sub">From overwater bungalows to ancient granite shores — every island personally selected.</div>
            <div className="ie-dest-scroll">
              {ISLANDS.map(island => (
                <div key={island.name} className="ie-dest-card" onClick={noop}>
                  <img src={island.image} alt={island.name}/>
                  <div className="ie-dest-ov"/>
                  <div className="ie-dest-body">
                    <div className="ie-dest-name">{island.name}</div>
                    <div className="ie-dest-tag">{island.tagline}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIGNATURE JOURNEYS */}
        <div className="ie-journeys">
          <div className="ie-journeys-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="ie-section-eyebrow">Signature Journeys</div>
                <div className="ie-section-title">Bespoke itineraries, ready to book</div>
                <div className="ie-section-sub">All-inclusive. Contracted rates. Every detail handled by your personal island specialist.</div>
              </div>
              <button className="ie-view-btn" onClick={noop}>View all →</button>
            </div>
            <div className="ie-grid">
              {JOURNEYS.map(j => {
                const saving = j.otaPrice - j.priceFrom;
                return (
                  <div key={j.name} className="ie-card" onClick={noop}>
                    <div className="ie-card-img">
                      <img src={j.image} alt={j.name}/>
                      <div className="ie-card-img-ov"/>
                      <div style={{ position: 'absolute', top: 10, left: 12, background: j.badgeColor, color: '#040C1A', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{j.badge}</div>
                    </div>
                    <div className="ie-card-body">
                      <div className="ie-card-name">{j.name}</div>
                      <div className="ie-card-tag">{j.tagline}</div>
                      <div className="ie-card-row">
                        <div>
                          <div className="ie-card-price">{fmt(j.priceFrom)}</div>
                          <div className="ie-card-nights">{j.nights}n · 2 pax</div>
                        </div>
                        {saving > 0 && <div className="ie-card-saving">Save {fmt(saving)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="ie-footer">
          <div className="ie-footer-inner">
            <div className="ie-footer-top">
              <div>
                <span className="ie-footer-brand-name">The Island Edition</span>
                <span className="ie-footer-brand-sub">by The Travel Catalogue</span>
                <p style={{ fontWeight: 200, fontSize: 12, color: 'rgba(240,235,228,0.26)', lineHeight: 1.7, maxWidth: 260 }}>
                  The Indian Ocean's finest resorts, contracted and curated. Launching 2026. Register your interest to be first.
                </p>
              </div>
              <div className="ie-footer-col">
                <h4>Journey</h4>
                <ul>
                  <li><button onClick={noop}>Plan My Journey</button></li>
                  <li><button onClick={noop}>Signature Journeys</button></li>
                  <li><button onClick={noop}>Send a Brief</button></li>
                  <li><button onClick={noop}>How It Works</button></li>
                </ul>
              </div>
              <div className="ie-footer-col">
                <h4>Company</h4>
                <ul>
                  <li><button onClick={noop}>About Us</button></li>
                  <li><button onClick={noop}>Contact</button></li>
                  <li><button onClick={noop}>Partner Login</button></li>
                  <li><a href="https://thesafariedition.com" style={{ color: 'rgba(78,205,196,0.4)' }}>The Safari Edition ↗</a></li>
                </ul>
              </div>
              <div className="ie-footer-col">
                <h4>Legal</h4>
                <ul>
                  <li><button onClick={noop}>Terms &amp; Conditions</button></li>
                  <li><button onClick={noop}>Privacy Policy</button></li>
                  <li><button onClick={noop}>Cancellation Policy</button></li>
                </ul>
              </div>
            </div>
            <div className="ie-footer-bottom">
              <div className="ie-footer-legal">
                © {new Date().getFullYear()} The Island Edition · A Travel Catalogue Edition ·{' '}
                <button onClick={noop}>T&Cs</button>
                <span className="ie-adot"/>
                <button onClick={noop}>Privacy</button>
              </div>
              <div className="ie-badge">
                <span className="ie-adot"/>ASATA Member
                <span className="ie-adot"/>SATSA Member
                <span className="ie-adot"/>POPIA Compliant
              </div>
            </div>
          </div>
        </footer>

      </div>

      {toast && <ComingSoonToast onClose={() => setToast(false)}/>}
    </>
  );
}
