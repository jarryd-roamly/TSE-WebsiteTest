'use client';

// LandingHero.tsx  v3  — full mobile-first redesign
// Mobile: full-screen video hero, bottom-sheet CTA, immersive cinematic
// Desktop: original split layout preserved, circle video, curated grid

import { useState, useEffect, useRef } from 'react';
import { T } from '@/app/lib/theme';

const HERO_BG_IMAGE = 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1800&q=85';

const OTHER_EDITIONS = [
  { id: 'island',    name: 'The Island Edition',    icon: '🏝', desc: 'Maldives · Seychelles · Zanzibar', color: '#60a5fa', href: '/island', live: true },
  { id: 'adventure', name: 'The Adventure Edition', icon: '🧗', desc: 'Nepal · Patagonia · Arctic',        color: '#4ade80', href: null,       live: false },
  { id: 'ski',       name: 'The Ski Edition',       icon: '⛷', desc: 'Alps · Aspen · Hokkaido',           color: '#a78bfa', href: null,       live: false },
];

const TRUST = [
  { icon: '🛡', label: 'Contracted rates', sub: 'Up to 27% below direct booking*' },
  { icon: '👁', label: 'Verified properties', sub: 'Every lodge personally inspected' },
  { icon: '👤', label: 'Dedicated concierge', sub: 'Your personal travel planner' },
  { icon: '↗', label: 'Flexible terms', sub: 'Best cancellation in the market' },
];

const STATS = [
  { value: 52,  suffix: '+',   label: 'Properties' },
  { value: 27,  suffix: '%',   label: 'Avg. saving' },
  { value: 9,   suffix: 'min', label: 'Booking time' },
  { value: 4.9, suffix: '★',   label: 'Satisfaction' },
];

const CURATED = [
  { name: 'The Sabi Sand Classic',    tagline: "South Africa's finest leopard territory", nights: 5, priceFrom: 142000, otaPrice: 192000, fallbackImage: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&q=80', badge: 'Most popular', badgeColor: '#d4af37', regionSlug: 'kruger-sabi-sand' },
  { name: 'The Grand Safari Circuit', tagline: 'Two countries. Three ecosystems.',         nights: 9, priceFrom: 298000, otaPrice: 412000, fallbackImage: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80', badge: 'Signature',    badgeColor: '#a78bfa', regionSlug: 'okavango-delta'   },
  { name: 'Kruger & Victoria Falls',  tagline: 'Big Five then one of the Seven Wonders',  nights: 7, priceFrom: 198000, otaPrice: 272000, fallbackImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', badge: 'Classic',      badgeColor: '#4ade80', regionSlug: 'chobe-vic-falls'  },
  { name: 'Safari & Indian Ocean',    tagline: 'Bush then beach — the perfect balance',   nights: 8, priceFrom: 224000, otaPrice: 316000, fallbackImage: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=800&q=80', badge: 'Our favourite', badgeColor: '#60a5fa', regionSlug: 'phinda'           },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$',  rate: 18.62 },
  { code: 'GBP', symbol: '£',  rate: 23.48 },
  { code: 'EUR', symbol: '€',  rate: 20.14 },
  { code: 'ZAR', symbol: 'R ', rate: 1     },
];
type Currency = { code: string; symbol: string; rate: number };

interface LandingHeroProps {
  onPlanJourney:     () => void;
  onCuratedJourneys: () => void;
  onSendBrief:       () => void;
  currency?:         Currency;
  onCurrencyChange?: (c: Currency) => void;
  currencies?:       Currency[];
}

export default function LandingHero({
  onPlanJourney, onCuratedJourneys, onSendBrief,
  currency: currencyProp, onCurrencyChange, currencies: currenciesProp,
}: LandingHeroProps) {
  const [heroBg,          setHeroBg]          = useState<string | null>(null);
  const [circleVideo,     setCircleVideo]     = useState<string | null>(null);
  const [logoUrl,         setLogoUrl]         = useState<string | null>(null);
  const [logoFailed,      setLogoFailed]      = useState(false);
  const [revealed,        setRevealed]        = useState(true);
  const [editionOpen,     setEditionOpen]     = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [regionImages,    setRegionImages]    = useState<Record<string, string>>({});
  const [curatedJourneys, setCuratedJourneys] = useState<any[]>([]);
  const [curatedLoading,  setCuratedLoading]  = useState(true);
  const [isMobile,        setIsMobile]        = useState(false);
  const [ctaVisible,      setCtaVisible]      = useState(false);
  const [menuOpen,        setMenuOpen]        = useState(false);

  const [localCurrency, setLocalCurrency] = useState<Currency>(CURRENCIES[0]);
  const activeCurrency   = currencyProp ?? localCurrency;
  const activeCurrencies = currenciesProp ?? CURRENCIES;
  const handleCurrencyChange = (c: Currency) => { setLocalCurrency(c); onCurrencyChange?.(c); };
  const fmt = (n: number) => `${activeCurrency.symbol}${Math.round(n / activeCurrency.rate).toLocaleString()}`;

  const circleRef = useRef<HTMLVideoElement>(null);
  const heroRef   = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  // CTA panel: animate in after short delay on mobile
  useEffect(() => {
    if (!isMobile) return;
    const t = setTimeout(() => setCtaVisible(true), 800);
    return () => clearTimeout(t);
  }, [isMobile]);

  // Load hero video + circle from Supabase
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    fetch(`${url}/rest/v1/cinematic_videos?select=region,url`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then(r => r.json())
      .then((rows: any[]) => {
        rows.forEach(r => {
          if (r.region === 'hero')        setHeroBg(r.url);
          if (r.region === 'hero_circle') setCircleVideo(r.url);
        });
      })
      .catch(() => {});
  }, []);

  // Load region images
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const slugs = ['kruger-sabi-sand', 'okavango-delta', 'chobe-vic-falls', 'cape-town', 'madikwe'];
    fetch(
      `${url}/rest/v1/suppliers?select=region_slug,images,hero_image,cover_image&is_active=eq.true&region_slug=in.(${slugs.join(',')})&order=trust_score.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
      .then(r => r.json())
      .then((rows: any[]) => {
        const map: Record<string, string> = {};
        rows.forEach((s: any) => {
          if (map[s.region_slug]) return;
          let img = '';
          try {
            if (typeof s.images === 'string' && s.images.startsWith('http')) { img = s.images; }
            else {
              const imgs: any[] = Array.isArray(s.images) ? s.images : (s.images ? JSON.parse(s.images) : []);
              const primary = imgs.find((i: any) => i.is_primary && i.status === 'approved') ?? imgs.find((i: any) => i.status === 'approved') ?? imgs[0];
              if (primary?.url) img = primary.url;
            }
          } catch {}
          if (!img || img.includes('unsplash')) { if (s.hero_image) img = s.hero_image; else if (s.cover_image) img = s.cover_image; }
          if (img && !img.includes('unsplash')) map[s.region_slug] = img;
        });
        if (Object.keys(map).length > 0) setRegionImages(map);
      })
      .catch(() => {});
  }, []);

  // Load curated journeys
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setCuratedLoading(false); return; }
    fetch(
      `${url}/rest/v1/curated_journeys?select=*&status=eq.published&edition_id=eq.safari&order=created_at.asc&limit=6`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
      .then(r => r.json())
      .then((rows: any[]) => { if (rows?.length > 0) setCuratedJourneys(rows); })
      .catch(() => {})
      .finally(() => setCuratedLoading(false));
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── MOBILE RENDER ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <style suppressHydrationWarning>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap');

          .m-root { font-family:'Jost',sans-serif; background:#080806; color:#f5f0e8; -webkit-tap-highlight-color:transparent; }

          /* ── MOBILE NAV ─────────────────────────────────────────── */
          .m-nav {
            position:fixed; top:0; left:0; right:0; z-index:300;
            height:56px; padding:0 20px;
            display:flex; align-items:center; justify-content:space-between;
            transition:background 0.3s;
          }
          .m-nav.scrolled { background:rgba(8,8,6,0.97); backdrop-filter:blur(20px); border-bottom:0.5px solid rgba(200,169,110,0.1); }
          .m-nav-wordmark { display:flex; align-items:center; gap:8px; }
          .m-nav-diamond  { width:20px; height:20px; position:relative; flex-shrink:0; }
          .m-nav-diamond::before,.m-nav-diamond::after { content:''; position:absolute; }
          .m-nav-diamond::before { inset:0; border:1.5px solid rgba(200,169,110,0.8); transform:rotate(45deg); }
          .m-nav-diamond::after  { inset:6px; background:rgba(200,169,110,0.85); transform:rotate(45deg); }
          .m-nav-title { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:14px; color:rgba(200,169,110,0.95); letter-spacing:0.08em; }
          .m-nav-right { display:flex; align-items:center; gap:10px; }
          .m-currency { background:transparent; border:0.5px solid rgba(255,255,255,0.15); color:rgba(245,240,232,0.6); border-radius:4px; padding:5px 8px; font-size:11px; outline:none; font-family:'Jost',sans-serif; }
          .m-hamburger { width:36px; height:36px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.1); border-radius:8px; cursor:pointer; }
          .m-hamburger span { display:block; width:16px; height:1px; background:rgba(245,240,232,0.7); transition:all 0.2s; }

          /* ── MOBILE MENU OVERLAY ────────────────────────────────── */
          .m-menu { position:fixed; inset:0; z-index:400; background:rgba(4,4,2,0.97); backdrop-filter:blur(30px); display:flex; flex-direction:column; padding:80px 32px 48px; transition:opacity 0.25s; }
          .m-menu-item { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:36px; color:rgba(245,240,232,0.75); padding:12px 0; border-bottom:0.5px solid rgba(255,255,255,0.06); cursor:pointer; letter-spacing:0.04em; transition:color 0.2s; }
          .m-menu-item:active { color:rgba(200,169,110,0.9); }
          .m-menu-close { position:absolute; top:20px; right:20px; width:40px; height:40px; background:rgba(255,255,255,0.07); border:0.5px solid rgba(255,255,255,0.12); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer; color:rgba(245,240,232,0.6); }

          /* ── HERO — full screen video ───────────────────────────── */
          .m-hero { position:relative; height:100svh; overflow:hidden; display:flex; flex-direction:column; }
          .m-hero-bg { position:absolute; inset:0; }
          .m-hero-bg video,
          .m-hero-bg img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 40%; }
          .m-hero-ov1 { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.92) 100%); z-index:2; }
          .m-hero-grain { position:absolute; inset:0; z-index:3; pointer-events:none; opacity:0.022; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size:160px; animation:m-grain .5s steps(1) infinite; }
          @keyframes m-grain { 0%{background-position:0 0}25%{background-position:-18px 9px}50%{background-position:9px -14px}75%{background-position:-9px 18px}100%{background-position:5px -5px} }

          /* ── LOGO centred in hero ───────────────────────────────── */
          .m-hero-logo {
            position:relative; z-index:10;
            padding-top:88px;
            display:flex; flex-direction:column; align-items:center; gap:8px;
            animation:m-fadeUp 1s ease forwards;
          }
          @keyframes m-fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
          .m-logo-diamond { width:32px; height:32px; position:relative; }
          .m-logo-diamond::before { content:''; position:absolute; inset:0; border:1.5px solid rgba(200,169,110,0.75); transform:rotate(45deg); }
          .m-logo-diamond::after  { content:''; position:absolute; inset:8px; background:rgba(200,169,110,0.85); transform:rotate(45deg); }
          .m-logo-name { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:22px; letter-spacing:0.24em; color:rgba(255,255,255,0.88); text-transform:uppercase; }
          .m-logo-sub  { font-weight:200; font-size:8px; letter-spacing:0.52em; text-transform:uppercase; color:rgba(200,169,110,0.6); }

          /* ── HERO TAGLINE — mid screen ──────────────────────────── */
          .m-hero-tagline {
            position:relative; z-index:10;
            flex:1; display:flex; align-items:center; justify-content:center;
            padding:0 28px;
            pointer-events:none;
          }
          .m-hero-headline { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:42px; line-height:1.0; letter-spacing:-0.01em; color:#f5f0e8; text-align:center; opacity:0; animation:m-fadeUp 1s ease 0.3s forwards; }
          .m-hero-headline em { font-style:italic; color:rgba(200,169,110,0.9); }

          /* ── BOTTOM CTA PANEL — slides up ───────────────────────── */
          .m-cta-panel {
            position:relative; z-index:10;
            padding:0 20px 0;
            padding-bottom:max(28px, env(safe-area-inset-bottom, 28px));
            opacity:0; transform:translateY(24px);
            transition:opacity 0.7s ease, transform 0.7s ease;
          }
          .m-cta-panel.visible { opacity:1; transform:translateY(0); }

          .m-cta-primary {
            width:100%; padding:18px 24px;
            background:linear-gradient(135deg,#c8a020,#f0c840);
            border:none; border-radius:4px;
            color:#080800; cursor:pointer;
            font-family:'Jost',sans-serif; font-weight:600; font-size:14px; letter-spacing:0.08em;
            display:flex; align-items:center; justify-content:space-between;
            margin-bottom:10px;
          }
          .m-cta-primary-sub { font-weight:200; font-size:10px; letter-spacing:0.14em; opacity:0.65; }

          .m-cta-row { display:flex; gap:8px; }
          .m-cta-ghost {
            flex:1; padding:14px 0;
            background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.15);
            border-radius:4px; color:rgba(245,240,232,0.65);
            cursor:pointer; font-family:'Jost',sans-serif; font-weight:300; font-size:12px;
            letter-spacing:0.1em; text-align:center;
          }

          /* ── SCROLL INDICATOR ───────────────────────────────────── */
          .m-scroll-hint {
            position:absolute; bottom:max(140px, calc(140px + env(safe-area-inset-bottom)));
            left:50%; transform:translateX(-50%);
            z-index:10; display:flex; flex-direction:column; align-items:center; gap:6px;
            opacity:0; animation:m-fadeUp 1s ease 1.6s forwards;
          }
          .m-scroll-dot { width:4px; height:4px; border-radius:50%; background:rgba(200,169,110,0.7); animation:m-bob 2s ease-in-out infinite; }
          .m-scroll-line { width:1px; height:28px; background:linear-gradient(to bottom,rgba(200,169,110,0.6),transparent); }
          @keyframes m-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }

          /* ── CORNER MARKS ───────────────────────────────────────── */
          .m-corner { position:absolute; width:14px; height:14px; z-index:6; opacity:0.28; }
          .m-corner::before,.m-corner::after{content:'';position:absolute;background:rgba(200,169,110,0.7);}
          .m-corner.tl{top:18px;left:18px}.m-corner.tl::before{top:0;left:0;width:14px;height:1px}.m-corner.tl::after{top:0;left:0;width:1px;height:14px}
          .m-corner.tr{top:18px;right:18px}.m-corner.tr::before{top:0;right:0;width:14px;height:1px}.m-corner.tr::after{top:0;right:0;width:1px;height:14px}
          .m-corner.bl{bottom:18px;left:18px}.m-corner.bl::before{bottom:0;left:0;width:14px;height:1px}.m-corner.bl::after{bottom:0;left:0;width:1px;height:14px}
          .m-corner.br{bottom:18px;right:18px}.m-corner.br::before{bottom:0;right:0;width:14px;height:1px}.m-corner.br::after{bottom:0;right:0;width:1px;height:14px}

          /* ── TRUST STRIP — horizontal scroll ───────────────────── */
          .m-trust { background:rgba(8,8,6,0.98); border-bottom:0.5px solid rgba(200,169,110,0.07); padding:20px 0; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
          .m-trust::-webkit-scrollbar { display:none; }
          .m-trust-inner { display:flex; gap:0; padding:0 20px; min-width:max-content; }
          .m-trust-item { display:flex; align-items:center; gap:10px; padding:0 24px 0 0; border-right:0.5px solid rgba(255,255,255,0.07); margin-right:24px; }
          .m-trust-item:last-child { border-right:none; padding-right:0; margin-right:20px; }
          .m-trust-icon { font-size:16px; }
          .m-trust-lbl  { font-weight:400; font-size:12px; color:rgba(245,240,232,0.75); white-space:nowrap; }
          .m-trust-sub  { font-weight:200; font-size:10px; color:rgba(245,240,232,0.3); letter-spacing:0.04em; white-space:nowrap; }

          /* ── STATS — 2×2 grid ───────────────────────────────────── */
          .m-stats { padding:36px 20px; background:#0a0a0a; display:grid; grid-template-columns:1fr 1fr; gap:1px; background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.05); }
          .m-stat  { background:#0a0a0a; padding:22px 20px; }
          .m-stat-n { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:38px; color:rgba(200,169,110,0.88); line-height:1; margin-bottom:4px; }
          .m-stat-l { font-weight:200; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(245,240,232,0.28); }

          /* ── CURATED — full-width cards ─────────────────────────── */
          .m-curated { padding:40px 0 0; background:#0a0a0a; }
          .m-curated-head { padding:0 20px 24px; }
          .m-curated-eyebrow { font-weight:200; font-size:9px; letter-spacing:0.44em; text-transform:uppercase; color:rgba(200,169,110,0.6); margin-bottom:6px; }
          .m-curated-title { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:28px; color:#f5f0e8; line-height:1.1; }
          .m-curated-sub { font-weight:200; font-size:12px; color:rgba(245,240,232,0.32); margin-top:6px; letter-spacing:0.04em; line-height:1.6; }

          /* Horizontal scroll cards */
          .m-card-scroll { display:flex; gap:12px; padding:0 20px; overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; scrollbar-width:none; padding-bottom:20px; }
          .m-card-scroll::-webkit-scrollbar { display:none; }
          .m-curated-card { flex-shrink:0; width:75vw; max-width:280px; scroll-snap-align:start; background:rgba(255,255,255,0.025); border:0.5px solid rgba(255,255,255,0.07); border-radius:14px; overflow:hidden; }
          .m-card-img { position:relative; height:160px; overflow:hidden; }
          .m-card-img img { width:100%; height:100%; object-fit:cover; }
          .m-card-img-ov { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 55%); }
          .m-card-body { padding:14px 16px; }
          .m-card-name { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:16px; color:#f5f0e8; margin-bottom:2px; }
          .m-card-tag  { font-weight:200; font-size:11px; color:rgba(245,240,232,0.36); margin-bottom:10px; }
          .m-card-price { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:20px; color:rgba(200,169,110,0.9); }
          .m-card-nights { font-size:10px; color:rgba(245,240,232,0.3); letter-spacing:0.08em; margin-top:1px; }
          .m-card-save { font-size:10px; color:#4ade80; margin-top:2px; }

          /* ── VIEW ALL ────────────────────────────────────────────── */
          .m-view-all { padding:20px 20px 40px; }
          .m-view-btn { width:100%; padding:15px 0; border:0.5px solid rgba(255,255,255,0.12); border-radius:4px; background:transparent; color:rgba(245,240,232,0.45); font-size:12px; letter-spacing:0.16em; text-transform:uppercase; cursor:pointer; font-family:'Jost',sans-serif; font-weight:300; }

          /* ── AFFIL strip ─────────────────────────────────────────── */
          .m-affil { background:#0a0a0a; border-top:0.5px solid rgba(255,255,255,0.04); padding:24px 20px; }
          .m-affil-lbl { font-weight:200; font-size:8px; letter-spacing:0.4em; text-transform:uppercase; color:rgba(245,240,232,0.18); text-align:center; margin-bottom:16px; }
          .m-affil-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
          .m-affil-item { display:flex; flex-direction:column; align-items:center; gap:3px; opacity:0.65; }
          .m-affil-abbr { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:14px; color:rgba(200,169,110,0.75); letter-spacing:0.06em; }
          .m-affil-note { font-size:9px; font-weight:300; letter-spacing:0.12em; color:rgba(74,222,128,0.55); }

          /* ── FOOTER ─────────────────────────────────────────────── */
          .m-footer { background:#040400; border-top:0.5px solid rgba(255,255,255,0.05); padding:32px 20px max(28px, env(safe-area-inset-bottom, 28px)); }
          .m-footer-brand { margin-bottom:28px; }
          .m-footer-brand-name { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:16px; color:rgba(200,169,110,0.75); letter-spacing:0.1em; display:block; margin-bottom:2px; }
          .m-footer-brand-sub  { font-weight:200; font-size:8px; letter-spacing:0.36em; text-transform:uppercase; color:rgba(200,169,110,0.35); display:block; margin-bottom:10px; }
          .m-footer-brand p    { font-weight:200; font-size:11px; color:rgba(245,240,232,0.25); line-height:1.7; }
          .m-footer-links { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
          .m-footer-col h4 { font-weight:200; font-size:8px; letter-spacing:0.4em; text-transform:uppercase; color:rgba(200,169,110,0.5); margin-bottom:10px; }
          .m-footer-col ul { list-style:none; margin:0; padding:0; }
          .m-footer-col li { margin-bottom:7px; }
          .m-footer-col a { font-weight:200; font-size:12px; color:rgba(245,240,232,0.3); text-decoration:none; }
          .m-footer-legal { font-size:10px; color:rgba(245,240,232,0.18); font-weight:200; text-align:center; line-height:1.8; }
          .m-footer-legal a { color:rgba(245,240,232,0.25); text-decoration:none; }
        `}</style>

        <div className="m-root">

          {/* NAV */}
          <nav className={`m-nav ${scrolled ? 'scrolled' : ''}`}>
            <div className="m-nav-wordmark">
              <div className="m-nav-diamond" />
              <span className="m-nav-title">The Safari Edition</span>
            </div>
            <div className="m-nav-right">
              <select className="m-currency" value={activeCurrency.code}
                onChange={e => { const c = activeCurrencies.find(x => x.code === e.target.value); if (c) handleCurrencyChange(c); }}>
                {activeCurrencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button className="m-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
                <span /><span /><span />
              </button>
            </div>
          </nav>

          {/* FULL SCREEN MENU */}
          {menuOpen && (
            <div className="m-menu">
              <button className="m-menu-close" onClick={() => setMenuOpen(false)}>×</button>
              {[
                { label: 'Plan My Journey',  action: () => { setMenuOpen(false); onPlanJourney(); } },
                { label: 'Curated Journeys', action: () => { setMenuOpen(false); onCuratedJourneys(); } },
                { label: 'Send a Brief',     action: () => { setMenuOpen(false); onSendBrief(); } },
                { label: 'How It Works',     action: () => setMenuOpen(false) },
                { label: 'About',            action: () => setMenuOpen(false) },
              ].map(item => (
                <div key={item.label} className="m-menu-item" onClick={item.action}>{item.label}</div>
              ))}
              <div style={{ marginTop: 'auto', fontSize: 11, color: 'rgba(245,240,232,0.2)', fontWeight: 200, letterSpacing: '0.1em' }}>
                ASATA · SATSA · POPIA Compliant
              </div>
            </div>
          )}

          {/* HERO */}
          <section className="m-hero" ref={heroRef}>
            {/* BG video or image */}
            <div className="m-hero-bg">
              {heroBg
                ? <video src={heroBg} autoPlay muted loop playsInline />
                : <img src={HERO_BG_IMAGE} alt="" />
              }
              <div className="m-hero-ov1" />
              <div className="m-hero-grain" />
            </div>

            {/* Corners */}
            <div className="m-corner tl" /><div className="m-corner tr" />
            <div className="m-corner bl" /><div className="m-corner br" />

            {/* Logo centred */}
            <div className="m-hero-logo">
              <div className="m-logo-diamond" />
              {!logoFailed && (
                <img src="/logo.png" alt="The Safari Edition"
                  style={{ maxHeight: 72, maxWidth: 240, objectFit: 'contain', filter: 'drop-shadow(0 2px 16px rgba(0,0,0,0.6))' }}
                  onError={() => setLogoFailed(true)} />
              )}
              {logoFailed && <>
                <div className="m-logo-name">The Safari Edition</div>
                <div className="m-logo-sub">Sub-Saharan Africa · Curated</div>
              </>}
            </div>

            {/* Tagline centred */}
            <div className="m-hero-tagline">
              <div className="m-hero-headline">
                Africa's finest<br />wilderness, <em>curated.</em>
              </div>
            </div>

            {/* Scroll hint */}
            <div className="m-scroll-hint">
              <div className="m-scroll-dot" />
              <div className="m-scroll-line" />
            </div>

            {/* Bottom CTA panel */}
            <div className={`m-cta-panel ${ctaVisible ? 'visible' : ''}`}>
              <button className="m-cta-primary" onClick={onPlanJourney}>
                <div>
                  <div>✦ &nbsp;Plan My Journey</div>
                  <div className="m-cta-primary-sub">Itinerary built in minutes</div>
                </div>
                <span style={{ fontSize: 16, opacity: 0.7 }}>→</span>
              </button>
              <div className="m-cta-row">
                <button className="m-cta-ghost" onClick={onCuratedJourneys}>Curated Journeys</button>
                <button className="m-cta-ghost" onClick={onSendBrief}>Send a Brief</button>
              </div>
            </div>
          </section>

          {/* TRUST — horizontal scroll */}
          <div className="m-trust">
            <div className="m-trust-inner">
              {TRUST.map(t => (
                <div key={t.label} className="m-trust-item">
                  <span className="m-trust-icon">{t.icon}</span>
                  <div>
                    <div className="m-trust-lbl">{t.label}</div>
                    <div className="m-trust-sub">{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STATS — 2×2 grid */}
          <div className="m-stats">
            {STATS.map(s => (
              <div key={s.label} className="m-stat">
                <div className="m-stat-n"><AnimatedNum value={s.value} />{s.suffix}</div>
                <div className="m-stat-l">{s.label}</div>
              </div>
            ))}
          </div>

          {/* CURATED JOURNEYS */}
          <div className="m-curated">
            <div className="m-curated-head">
              <div className="m-curated-eyebrow">Signature Journeys</div>
              <div className="m-curated-title">Bespoke itineraries,<br />ready to book</div>
              <div className="m-curated-sub">All-inclusive. Contracted rates.<br />Every detail handled.</div>
            </div>
            <div className="m-card-scroll">
              {(curatedJourneys.length > 0 ? curatedJourneys : CURATED).map((j: any) => {
                const firstRegionSlug = j.cities?.[0]?.regionSlug ?? j.regionSlug ?? '';
                const cardImage = regionImages[firstRegionSlug] || j.hero_image || j.fallbackImage || HERO_BG_IMAGE;
                const priceFrom = j.price_from_zar ?? j.priceFrom ?? 0;
                const otaPrice  = j.ota_price_zar  ?? j.otaPrice  ?? 0;
                const saving    = otaPrice - priceFrom;
                return (
                  <div key={j.id ?? j.name} className="m-curated-card" onClick={onCuratedJourneys}>
                    <div className="m-card-img">
                      <img src={cardImage} alt={j.name} />
                      <div className="m-card-img-ov" />
                      {j.badge && (
                        <div style={{ position: 'absolute', top: 10, left: 12, background: j.badge_color ?? j.badgeColor ?? '#d4af37', color: '#0a0a0a', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{j.badge}</div>
                      )}
                    </div>
                    <div className="m-card-body">
                      <div className="m-card-name">{j.name}</div>
                      <div className="m-card-tag">{j.tagline}</div>
                      {priceFrom > 0 && <>
                        <div className="m-card-price">{fmt(priceFrom)}</div>
                        <div className="m-card-nights">{j.nights}n · 2 pax · all-incl.</div>
                        {saving > 0 && <div className="m-card-save">Save {fmt(saving)}</div>}
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="m-view-all">
              <button className="m-view-btn" onClick={onCuratedJourneys}>View all journeys →</button>
            </div>
          </div>

          {/* AFFILIATIONS */}
          <div className="m-affil">
            <div className="m-affil-lbl">Accreditation &amp; Partnerships</div>
            <div className="m-affil-grid">
              {[
                { abbr: 'ASATA', note: 'Member' },
                { abbr: 'SATSA', note: 'Member' },
                { abbr: 'SA Tourism', note: 'Partner' },
                { abbr: 'ATTA', note: 'Applying 2026' },
              ].map(org => (
                <div key={org.abbr} className="m-affil-item">
                  <div className="m-affil-abbr">{org.abbr}</div>
                  <div className="m-affil-note">{org.note === 'Applying 2026' ? '◌ ' : '✓ '}{org.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <footer className="m-footer">
            <div className="m-footer-brand">
              <span className="m-footer-brand-name">The Safari Edition</span>
              <span className="m-footer-brand-sub">by The Travel Catalogue</span>
              <p>Africa's finest wilderness, contracted and curated. ASATA and SATSA registered.</p>
            </div>
            <div className="m-footer-links">
              <div className="m-footer-col">
                <h4>Journey</h4>
                <ul>
                  <li><a href="#" onClick={e => { e.preventDefault(); onPlanJourney(); }}>Plan My Journey</a></li>
                  <li><a href="#" onClick={e => { e.preventDefault(); onCuratedJourneys(); }}>Curated Journeys</a></li>
                  <li><a href="#" onClick={e => { e.preventDefault(); onSendBrief(); }}>Send a Brief</a></li>
                  <li><a href="/how-it-works">How It Works</a></li>
                </ul>
              </div>
              <div className="m-footer-col">
                <h4>Company</h4>
                <ul>
                  <li><a href="/about">About Us</a></li>
                  <li><a href="/contact">Contact</a></li>
                  <li><a href="/admin">Partner Login</a></li>
                  <li><a href="/terms">Terms</a></li>
                </ul>
              </div>
            </div>
            <div className="m-footer-legal">
              © {new Date().getFullYear()} The Safari Edition · A Travel Catalogue Edition<br />
              <a href="/terms">T&amp;Cs</a> · <a href="/privacy">Privacy</a> · <a href="/cancellation">Cancellation</a>
            </div>
          </footer>

        </div>
      </>
    );
  }

  // ── DESKTOP RENDER (original, preserved exactly) ─────────────────────────────
  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap');

        .lh2-root { font-family:'Jost',sans-serif; background:#0a0a0a; color:#f5f0e8; }

        /* NAV */
        .lh2-nav {
          position:fixed; top:0; left:0; right:0; z-index:200;
          height:62px; padding:0 clamp(16px,4vw,56px);
          display:flex; align-items:center; justify-content:space-between;
          background:linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%);
          transition:background 0.4s, border-color 0.4s;
        }
        .lh2-nav.scrolled {
          background:rgba(8,8,0,0.96); backdrop-filter:blur(20px);
          border-bottom:0.5px solid rgba(200,169,110,0.12);
        }
        .lh2-wordmark { display:flex; align-items:center; gap:10px; text-decoration:none; cursor:pointer; }
        .lh2-diamond  { position:relative; width:26px; height:26px; flex-shrink:0; }
        .lh2-d-outer  { position:absolute; inset:0; border:1.5px solid rgba(200,169,110,0.75); transform:rotate(45deg); }
        .lh2-d-inner  { position:absolute; inset:7px; background:rgba(200,169,110,0.88); transform:rotate(45deg); }
        .lh2-wm-title { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:15px; color:rgba(200,169,110,0.95); letter-spacing:0.08em; display:block; }
        .lh2-wm-sub   { font-weight:200; font-size:7.5px; letter-spacing:0.44em; text-transform:uppercase; color:rgba(200,169,110,0.55); display:block; margin-top:1px; }
        .lh2-nav-links { display:flex; align-items:center; gap:24px; list-style:none; margin:0; padding:0; }
        .lh2-nav-links a { font-weight:300; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(255,255,255,0.5); text-decoration:none; transition:color 0.2s; }
        .lh2-nav-links a:hover { color:rgba(200,169,110,0.9); }
        .lh2-nav-right { display:flex; align-items:center; gap:10px; }
        .lh2-currency-sel { background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.1); color:rgba(245,240,232,0.65); border-radius:4px; padding:6px 10px; font-size:11px; outline:none; cursor:pointer; font-family:'Jost',sans-serif; letter-spacing:0.1em; appearance:none; -webkit-appearance:none; }
        .lh2-currency-sel:hover { border-color:rgba(200,169,110,0.35); color:rgba(200,169,110,0.85); }
        .lh2-currency-sel option { background:#0f0f0a; color:#f5f0e8; }
        .lh2-nav-admin { font-size:11px; letter-spacing:0.14em; color:rgba(245,240,232,0.35); text-decoration:none; padding:6px 12px; border:0.5px solid rgba(255,255,255,0.1); border-radius:4px; transition:border-color 0.2s, color 0.2s; }
        .lh2-nav-admin:hover { border-color:rgba(200,169,110,0.4); color:rgba(200,169,110,0.8); }
        .lh2-nav-cta { font-weight:500; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(200,169,110,0.95); background:rgba(200,169,110,0.1); border:1px solid rgba(200,169,110,0.35); padding:8px 18px; border-radius:2px; cursor:pointer; font-family:'Jost',sans-serif; transition:background 0.2s; }
        .lh2-nav-cta:hover { background:rgba(200,169,110,0.2); }

        .lh2-edition-btn { background:none; border:none; cursor:pointer; font-family:'Jost',sans-serif; display:flex; align-items:center; gap:6px; padding:6px 10px; }
        .lh2-edition-name { font-size:13px; font-weight:400; color:rgba(200,169,110,0.9); letter-spacing:0.04em; }
        .lh2-edition-arrow { font-size:9px; color:rgba(200,169,110,0.5); }
        .lh2-edition-menu { position:absolute; top:calc(100% + 6px); left:0; min-width:240px; background:#0f0f0a; border:0.5px solid rgba(200,169,110,0.2); border-radius:10px; padding:8px; z-index:300; box-shadow:0 8px 40px rgba(0,0,0,0.7); }
        .lh2-edition-current { padding:10px 12px; background:rgba(200,169,110,0.07); border-radius:8px; margin-bottom:6px; }
        .lh2-edition-item { padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:10px; opacity:0.55; }
        .lh2-edition-badge { font-size:9px; color:#a78bfa; background:rgba(167,139,250,0.12); border:0.5px solid rgba(167,139,250,0.3); border-radius:20px; padding:2px 7px; margin-left:auto; }

        .lh2-hero { position:relative; height:100svh; min-height:640px; overflow:hidden; display:flex; flex-direction:column; }
        .lh2-bg { position:absolute; inset:0; overflow:hidden; }
        .lh2-bg img, .lh2-bg video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 35%; }
        .lh2-grain { position:absolute; inset:0; z-index:2; pointer-events:none; opacity:0.025; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); background-size:160px; animation:lh2Grain .5s steps(1) infinite; }
        @keyframes lh2Grain { 0%{background-position:0 0}25%{background-position:-18px 9px}50%{background-position:9px -14px}75%{background-position:-9px 18px}100%{background-position:5px -5px} }
        .lh2-ov1 { position:absolute; inset:0; z-index:3; background:linear-gradient(to bottom,rgba(0,0,0,0.45) 0%,rgba(0,0,0,0) 35%,rgba(0,0,0,0.1) 60%,rgba(0,0,0,0.88) 100%); }
        .lh2-ov2 { position:absolute; inset:0; z-index:3; background:linear-gradient(to right,rgba(0,0,0,0.45) 0%,transparent 55%); }
        .lh2-vignette { position:absolute; inset:0; z-index:4; background:radial-gradient(ellipse at center,transparent 35%,rgba(0,0,0,0.42) 100%); }
        .lh2-corner { position:absolute; width:18px; height:18px; z-index:6; opacity:0.3; }
        .lh2-corner::before,.lh2-corner::after{content:'';position:absolute;background:rgba(200,169,110,0.7);}
        .lh2-corner.tl{top:22px;left:22px}.lh2-corner.tl::before{top:0;left:0;width:18px;height:1px}.lh2-corner.tl::after{top:0;left:0;width:1px;height:18px}
        .lh2-corner.tr{top:22px;right:22px}.lh2-corner.tr::before{top:0;right:0;width:18px;height:1px}.lh2-corner.tr::after{top:0;right:0;width:1px;height:18px}
        .lh2-corner.bl{bottom:22px;left:22px}.lh2-corner.bl::before{bottom:0;left:0;width:18px;height:1px}.lh2-corner.bl::after{bottom:0;left:0;width:1px;height:18px}
        .lh2-corner.br{bottom:22px;right:22px}.lh2-corner.br::before{bottom:0;right:0;width:18px;height:1px}.lh2-corner.br::after{bottom:0;right:0;width:1px;height:18px}
        .lh2-logo-area { position:relative; z-index:10; flex:0 0 auto; display:flex; align-items:center; justify-content:center; padding-top:100px; padding-bottom:0; }
        .lh2-logo-img { max-height:120px; max-width:420px; object-fit:contain; filter:drop-shadow(0 2px 20px rgba(0,0,0,0.6)); }
        .lh2-logo-text { text-align:center; }
        .lh2-logo-line { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:8px; }
        .lh2-logo-divider { width:40px; height:0.5px; background:rgba(200,169,110,0.4); }
        .lh2-logo-name { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(28px,4.5vw,52px); letter-spacing:0.22em; color:rgba(255,255,255,0.92); text-transform:uppercase; line-height:1; }
        .lh2-logo-sub  { font-weight:200; font-size:9px; letter-spacing:0.55em; text-transform:uppercase; color:rgba(200,169,110,0.65); }
        .lh2-circle { position:absolute; z-index:4; right:clamp(-6%,0vw,3%); top:50%; transform:translateY(-50%); width:clamp(300px,44vw,620px); height:clamp(300px,44vw,620px); border-radius:50%; overflow:hidden; opacity:0.52; -webkit-mask-image:radial-gradient(circle at 50% 50%,black 25%,rgba(0,0,0,0.85) 40%,rgba(0,0,0,0.45) 58%,rgba(0,0,0,0.12) 70%,transparent 72%); mask-image:radial-gradient(circle at 50% 50%,black 25%,rgba(0,0,0,0.85) 40%,rgba(0,0,0,0.45) 58%,rgba(0,0,0,0.12) 70%,transparent 72%); }
        .lh2-circle video { width:100%; height:100%; object-fit:cover; filter:saturate(0.6) brightness(0.85); }
        .lh2-circle-ov { position:absolute; inset:0; background:radial-gradient(ellipse at center,rgba(10,8,0,0.05) 0%,rgba(10,8,0,0.35) 65%,rgba(10,8,0,0.75) 100%); z-index:1; pointer-events:none; }
        .lh2-circle-ring { display:none; }
        .lh2-content { position:relative; z-index:10; flex:1; display:flex; align-items:flex-end; padding:0 clamp(20px,5vw,64px) clamp(40px,6vh,72px); }
        .lh2-content-inner { max-width:480px; }
        .lh2-r { opacity:0; transform:translateY(20px); }
        .lh2-r.show { animation:lh2Reveal 0.9s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes lh2Reveal { to { opacity:1; transform:translateY(0); } }
        .lh2-r1.show{animation-delay:0.05s}.lh2-r2.show{animation-delay:0.18s}.lh2-r3.show{animation-delay:0.32s}.lh2-r4.show{animation-delay:0.48s}.lh2-r5.show{animation-delay:0.64s}
        .lh2-eyebrow { font-weight:200; font-size:10px; letter-spacing:0.5em; text-transform:uppercase; color:rgba(200,169,110,0.75); display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .lh2-eyebrow-line { width:28px; height:1px; background:rgba(200,169,110,0.45); }
        .lh2-headline1 { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(36px,5.5vw,68px); line-height:0.95; letter-spacing:-0.01em; color:#f5f0e8; margin-bottom:4px; }
        .lh2-headline2 { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(36px,5.5vw,68px); line-height:0.95; letter-spacing:-0.01em; color:rgba(255,255,255,0.6); margin-bottom:24px; }
        .lh2-headline2 em { font-style:italic; color:rgba(200,169,110,0.92); }
        .lh2-sub { font-weight:300; font-size:clamp(13px,1.5vw,15px); color:rgba(245,240,232,0.46); line-height:1.75; max-width:400px; margin-bottom:32px; letter-spacing:0.03em; }
        .lh2-ctas { display:flex; gap:10px; flex-wrap:wrap; }
        .lh2-cta-primary { display:flex; flex-direction:column; gap:2px; padding:15px 26px; background:linear-gradient(135deg,#c8a020,#f0c840); border:none; border-radius:2px; color:#080800; cursor:pointer; font-family:'Jost',sans-serif; text-align:left; transition:opacity 0.2s; }
        .lh2-cta-primary:hover { opacity:0.9; }
        .lh2-cta-title { font-weight:500; font-size:13px; letter-spacing:0.06em; }
        .lh2-cta-sub   { font-weight:200; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; opacity:0.6; }
        .lh2-cta-ghost { display:flex; flex-direction:column; gap:2px; padding:14px 20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.14); border-radius:2px; color:rgba(245,240,232,0.7); cursor:pointer; font-family:'Jost',sans-serif; text-align:left; transition:border-color 0.2s; }
        .lh2-cta-ghost:hover { border-color:rgba(200,169,110,0.4); color:rgba(200,169,110,0.9); }
        .lh2-scroll { position:absolute; bottom:24px; right:clamp(16px,4vw,52px); z-index:10; display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0; animation:lh2Reveal 1s ease forwards 1.3s, lh2Bob 2.5s ease-in-out 2s infinite; }
        @keyframes lh2Bob { 0%,100%{transform:translateY(0)}50%{transform:translateY(5px)} }
        .lh2-scroll-line { width:1px; height:36px; background:linear-gradient(to bottom,rgba(200,169,110,0.7),transparent); }
        .lh2-scroll-lbl  { font-weight:200; font-size:7px; letter-spacing:0.45em; text-transform:uppercase; color:rgba(200,169,110,0.6); writing-mode:vertical-rl; }
        .lh2-trust { background:rgba(8,8,0,0.98); border-bottom:0.5px solid rgba(200,169,110,0.08); padding:22px clamp(20px,5vw,64px); }
        .lh2-trust-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        .lh2-trust-item { display:flex; align-items:flex-start; gap:12px; }
        .lh2-trust-icon { font-size:16px; flex-shrink:0; margin-top:2px; }
        .lh2-trust-lbl  { font-weight:400; font-size:12px; color:rgba(245,240,232,0.75); margin-bottom:2px; }
        .lh2-trust-sub  { font-weight:200; font-size:11px; color:rgba(245,240,232,0.32); letter-spacing:0.04em; }
        .lh2-stats { padding:44px clamp(20px,5vw,64px); background:#0a0a0a; border-bottom:0.5px solid rgba(255,255,255,0.04); }
        .lh2-stats-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:28px; }
        .lh2-stat-n { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(34px,4vw,50px); color:rgba(200,169,110,0.88); line-height:1; margin-bottom:6px; text-align:center; }
        .lh2-stat-l { font-weight:200; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:rgba(245,240,232,0.28); text-align:center; }
        .lh2-curated { padding:64px clamp(20px,5vw,64px); background:#0a0a0a; }
        .lh2-curated-inner { max-width:1200px; margin:0 auto; }
        .lh2-section-eyebrow { font-weight:200; font-size:10px; letter-spacing:0.44em; text-transform:uppercase; color:rgba(200,169,110,0.65); margin-bottom:10px; }
        .lh2-section-title { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(24px,3.5vw,38px); color:#f5f0e8; margin-bottom:4px; }
        .lh2-section-sub { font-weight:300; font-size:13px; color:rgba(245,240,232,0.38); margin-bottom:32px; letter-spacing:0.04em; }
        .lh2-curated-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
        .lh2-curated-card { background:rgba(255,255,255,0.025); border:0.5px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; cursor:pointer; transition:border-color 0.2s, transform 0.2s; }
        .lh2-curated-card:hover { border-color:rgba(200,169,110,0.22); transform:translateY(-2px); }
        .lh2-curated-img { position:relative; height:185px; overflow:hidden; }
        .lh2-curated-img img { width:100%; height:100%; object-fit:cover; transition:transform 0.6s; }
        .lh2-curated-card:hover .lh2-curated-img img { transform:scale(1.04); }
        .lh2-curated-img-ov { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 52%); }
        .lh2-card-body { padding:14px 16px; }
        .lh2-card-name { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:16px; color:#f5f0e8; margin-bottom:3px; }
        .lh2-card-tag  { font-weight:200; font-size:11px; color:rgba(245,240,232,0.38); margin-bottom:12px; letter-spacing:0.04em; }
        .lh2-card-price-row { display:flex; justify-content:space-between; align-items:baseline; }
        .lh2-card-price { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:20px; color:rgba(200,169,110,0.9); }
        .lh2-card-nights { font-size:10px; color:rgba(245,240,232,0.32); letter-spacing:0.1em; }
        .lh2-card-saving { font-size:10px; color:#4ade80; }
        .lh2-view-all { margin-top:28px; display:flex; justify-content:center; }
        .lh2-view-btn { padding:12px 32px; border:0.5px solid rgba(255,255,255,0.14); border-radius:2px; background:transparent; color:rgba(245,240,232,0.5); font-size:12px; letter-spacing:0.16em; text-transform:uppercase; cursor:pointer; font-family:'Jost',sans-serif; transition:border-color 0.2s, color 0.2s; font-weight:300; }
        .lh2-view-btn:hover { border-color:rgba(200,169,110,0.4); color:rgba(200,169,110,0.8); }
        .lh2-footer { background:#040400; border-top:0.5px solid rgba(255,255,255,0.05); padding:44px clamp(20px,5vw,64px) 28px; }
        .lh2-footer-inner { max-width:1200px; margin:0 auto; }
        .lh2-footer-top { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:44px; margin-bottom:40px; }
        .lh2-footer-brand-name { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:18px; color:rgba(200,169,110,0.8); letter-spacing:0.1em; display:block; margin-bottom:4px; }
        .lh2-footer-brand-sub  { font-weight:200; font-size:8px; letter-spacing:0.36em; text-transform:uppercase; color:rgba(200,169,110,0.4); display:block; margin-bottom:12px; }
        .lh2-footer-brand p { font-weight:200; font-size:12px; color:rgba(245,240,232,0.28); line-height:1.7; max-width:260px; }
        .lh2-footer-col h4 { font-weight:200; font-size:9px; letter-spacing:0.4em; text-transform:uppercase; color:rgba(200,169,110,0.55); margin-bottom:14px; }
        .lh2-footer-col ul { list-style:none; margin:0; padding:0; }
        .lh2-footer-col li { margin-bottom:9px; }
        .lh2-footer-col a { font-weight:200; font-size:12px; letter-spacing:0.06em; color:rgba(245,240,232,0.35); text-decoration:none; transition:color 0.2s; }
        .lh2-footer-col a:hover { color:rgba(200,169,110,0.75); }
        .lh2-footer-bottom { border-top:0.5px solid rgba(255,255,255,0.05); padding-top:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
        .lh2-footer-legal { font-weight:200; font-size:10px; letter-spacing:0.1em; color:rgba(245,240,232,0.2); }
        .lh2-footer-legal a { color:rgba(245,240,232,0.28); text-decoration:none; }
        .lh2-asata { display:flex; align-items:center; gap:6px; font-weight:200; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(245,240,232,0.22); }
        .lh2-adot { width:3px; height:3px; border-radius:50%; background:rgba(200,169,110,0.5); }
        @media(max-width:900px){
          .lh2-nav-links{display:none;}
          .lh2-trust-inner{grid-template-columns:1fr 1fr;}
          .lh2-stats-inner{grid-template-columns:1fr 1fr;}
          .lh2-footer-top{grid-template-columns:1fr 1fr; gap:28px;}
          .lh2-circle{width:clamp(200px,60vw,340px);height:clamp(200px,60vw,340px);right:-8%;top:auto;bottom:10%;transform:none;}
        }
      `}</style>

      <div className="lh2-root">
        <nav className={`lh2-nav ${scrolled ? 'scrolled' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="lh2-wordmark" onClick={onPlanJourney}>
              <div className="lh2-diamond"><div className="lh2-d-outer" /><div className="lh2-d-inner" /></div>
              <div>
                <span className="lh2-wm-title">The Safari Edition</span>
                <span className="lh2-wm-sub">Sub-Saharan Africa · Handpicked</span>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <button className="lh2-edition-btn" onClick={() => setEditionOpen(v => !v)}>
                <span className="lh2-edition-arrow">{editionOpen ? '▲' : '▼'}</span>
              </button>
              {editionOpen && (
                <div className="lh2-edition-menu">
                  <div className="lh2-edition-current">
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(200,169,110,0.9)' }}>✦ The Safari Edition</div>
                    <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.35)', marginTop: 2 }}>Sub-Saharan Africa · Active</div>
                  </div>
                  {OTHER_EDITIONS.map(e => (
                    e.live && e.href ? (
                      <a key={e.id} href={e.href} className="lh2-edition-item" style={{ opacity: 1, cursor: 'pointer', textDecoration: 'none', background: 'transparent', transition: 'background 0.15s' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(96,165,250,0.07)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                        onClick={() => setEditionOpen(false)}>
                        <span style={{ fontSize: 18 }}>{e.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: e.color, fontWeight: 500 }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.38)' }}>{e.desc}</div>
                        </div>
                        <span style={{ fontSize: 9, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '0.5px solid rgba(74,222,128,0.28)', borderRadius: 20, padding: '2px 7px', marginLeft: 'auto' }}>Preview →</span>
                      </a>
                    ) : (
                      <div key={e.id} className="lh2-edition-item">
                        <span style={{ fontSize: 18 }}>{e.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)', fontWeight: 400 }}>{e.name}</div>
                          <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.28)' }}>{e.desc}</div>
                        </div>
                        <span className="lh2-edition-badge">Soon</span>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
          <ul className="lh2-nav-links">
            <li><a href="/how-it-works">How It Works</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
          <div className="lh2-nav-right">
            <select className="lh2-currency-sel" value={activeCurrency.code}
              onChange={e => { const c = activeCurrencies.find(x => x.code === e.target.value); if (c) handleCurrencyChange(c); }}>
              {activeCurrencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <a href="/admin" className="lh2-nav-admin">Partner Login</a>
            <button className="lh2-nav-cta" onClick={onPlanJourney}>Plan My Journey</button>
          </div>
        </nav>
        {editionOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setEditionOpen(false)} />}

        <section className="lh2-hero">
          <div className="lh2-bg">
            {heroBg ? <video src={heroBg} autoPlay muted loop playsInline /> : <img src={HERO_BG_IMAGE} alt="" />}
            <div className="lh2-ov1" /><div className="lh2-ov2" /><div className="lh2-vignette" /><div className="lh2-grain" />
          </div>
          <div className="lh2-corner tl" /><div className="lh2-corner tr" />
          <div className="lh2-corner bl" /><div className="lh2-corner br" />
          <div className="lh2-logo-area">
            {!logoFailed && (
              <img src="/logo.png" alt="The Safari Edition" className="lh2-logo-img" onError={() => setLogoFailed(true)} />
            )}
            {logoFailed && (
              <div className="lh2-logo-text">
                <div className="lh2-logo-line">
                  <div className="lh2-logo-divider" />
                  <div style={{ width: 8, height: 8, border: '1px solid rgba(200,169,110,0.6)', transform: 'rotate(45deg)', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 2, background: 'rgba(200,169,110,0.7)' }} />
                  </div>
                  <div className="lh2-logo-divider" />
                </div>
                <div className="lh2-logo-name">The Safari Edition</div>
                <div className="lh2-logo-sub" style={{ marginTop: 6 }}>Sub-Saharan Africa · Curated</div>
              </div>
            )}
          </div>
          {circleVideo && (
            <div className="lh2-circle">
              <video ref={circleRef} src={circleVideo} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div className="lh2-circle-ov" /><div className="lh2-circle-ring" />
            </div>
          )}
          <div className="lh2-content">
            <div className="lh2-content-inner">
              <div className={`lh2-r lh2-r1 ${revealed ? 'show' : ''}`}>
                <div className="lh2-eyebrow"><div className="lh2-eyebrow-line" />Sub-Saharan Africa · Handpicked</div>
              </div>
              <div className={`lh2-r lh2-r2 ${revealed ? 'show' : ''}`}><div className="lh2-headline1">Africa's finest</div></div>
              <div className={`lh2-r lh2-r3 ${revealed ? 'show' : ''}`}><div className="lh2-headline2">wilderness, <em>curated.</em></div></div>
              <div className={`lh2-r lh2-r4 ${revealed ? 'show' : ''}`}>
                <p className="lh2-sub">Handpicked lodges. Contracted rates up to 27% below direct.<br />Bespoke sequencing. Your dedicated concierge. Complete in minutes.</p>
              </div>
              <div className={`lh2-r lh2-r5 ${revealed ? 'show' : ''}`}>
                <div className="lh2-ctas">
                  <button className="lh2-cta-primary" onClick={onPlanJourney}>
                    <span className="lh2-cta-title">✦ Plan My Journey</span>
                    <span className="lh2-cta-sub">Itinerary built in minutes</span>
                  </button>
                  <button className="lh2-cta-ghost" onClick={onCuratedJourneys}>
                    <span className="lh2-cta-title">Curated Journeys</span>
                    <span className="lh2-cta-sub">Ready to book · from price</span>
                  </button>
                  <button className="lh2-cta-ghost" onClick={onSendBrief}>
                    <span className="lh2-cta-title">Send Your Brief</span>
                    <span className="lh2-cta-sub">We handle everything</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="lh2-scroll">
            <span className="lh2-scroll-lbl">Scroll</span>
            <div className="lh2-scroll-line" />
          </div>
        </section>

        <div className="lh2-trust">
          <div className="lh2-trust-inner">
            {TRUST.map(t => (
              <div key={t.label} className="lh2-trust-item">
                <div className="lh2-trust-icon" style={{ flexShrink: 0, marginTop: 2, width: 20, display: 'flex', alignItems: 'flex-start' }}>
                  {t.icon}
                </div>
                <div>
                  <div className="lh2-trust-lbl">{t.label}</div>
                  <div className="lh2-trust-sub">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lh2-stats">
          <div className="lh2-stats-inner">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="lh2-stat-n"><AnimatedNum value={s.value} />{s.suffix}</div>
                <div className="lh2-stat-l">{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ maxWidth: 1200, margin: '18px auto 0', paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap' as const, gap: 16 }}>
            <p style={{ fontWeight: 200, fontSize: 10, color: 'rgba(245,240,232,0.22)', letterSpacing: '0.04em', lineHeight: 1.7, margin: 0 }}>* Saving compared to booking directly with the lodge. Actual saving varies by property, season and room type.</p>
            <p style={{ fontWeight: 200, fontSize: 10, color: 'rgba(245,240,232,0.22)', letterSpacing: '0.04em', lineHeight: 1.7, margin: 0 }}>† Guest satisfaction target. Tracked via post-journey NPS survey from first confirmed booking.</p>
          </div>
        </div>

        <div style={{ background: '#0a0a0a', borderTop: '0.5px solid rgba(255,255,255,0.04)', borderBottom: '0.5px solid rgba(255,255,255,0.04)', padding: '28px clamp(20px,5vw,64px)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <p style={{ textAlign: 'center' as const, fontWeight: 200, fontSize: 9, letterSpacing: '0.42em', textTransform: 'uppercase' as const, color: 'rgba(245,240,232,0.2)', marginBottom: 24 }}>Accreditation &amp; Industry Partnerships</p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'clamp(24px,5vw,64px)', flexWrap: 'wrap' as const }}>
              {[
                { abbr: 'ASATA', full: 'Association of Southern African Travel Agents', note: 'Member' },
                { abbr: 'SATSA', full: 'Southern Africa Tourism Services Association', note: 'Member' },
                { abbr: 'ATTA',  full: 'African Travel & Tourism Association', note: 'Applying 2026' },
                { abbr: 'SA Tourism', full: 'South African Tourism Board', note: 'Partner' },
              ].map(org => (
                <div key={org.abbr} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4, opacity: org.note === 'Applying 2026' ? 0.45 : 0.7 }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 15, color: 'rgba(200,169,110,0.8)', letterSpacing: '0.08em' }}>{org.abbr}</div>
                  <div style={{ fontWeight: 200, fontSize: 8, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(245,240,232,0.25)', textAlign: 'center' as const, maxWidth: 120 }}>{org.full}</div>
                  <div style={{ fontWeight: 300, fontSize: 8, letterSpacing: '0.18em', color: org.note === 'Applying 2026' ? 'rgba(167,139,250,0.6)' : 'rgba(74,222,128,0.55)', textTransform: 'uppercase' as const }}>{org.note === 'Applying 2026' ? '◌ ' : '✓ '}{org.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lh2-curated">
          <div className="lh2-curated-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="lh2-section-eyebrow">Signature Journeys</div>
                <div className="lh2-section-title">Bespoke itineraries, ready to book</div>
                <div className="lh2-section-sub">All-inclusive. Contracted rates. Every detail handled by your personal specialist.</div>
              </div>
              <button className="lh2-view-btn" onClick={onCuratedJourneys}>View all →</button>
            </div>
            <div className="lh2-curated-grid">
              {(curatedJourneys.length > 0 ? curatedJourneys : CURATED).map((j: any) => {
                const firstRegionSlug = j.cities?.[0]?.regionSlug ?? j.regionSlug ?? '';
                const cardImage = regionImages[firstRegionSlug] || j.hero_image || j.fallbackImage || HERO_BG_IMAGE;
                const priceFrom = j.price_from_zar ?? j.priceFrom ?? 0;
                const otaPrice  = j.ota_price_zar  ?? j.otaPrice  ?? 0;
                const saving    = otaPrice - priceFrom;
                return (
                  <div key={j.id ?? j.name} className="lh2-curated-card" onClick={onCuratedJourneys}>
                    <div className="lh2-curated-img">
                      <img src={cardImage} alt={j.name} />
                      <div className="lh2-curated-img-ov" />
                      {j.badge && <div style={{ position: 'absolute', top: 10, left: 12, background: j.badge_color ?? j.badgeColor ?? '#d4af37', color: '#0a0a0a', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>{j.badge}</div>}
                    </div>
                    <div className="lh2-card-body">
                      <div className="lh2-card-name">{j.name}</div>
                      <div className="lh2-card-tag">{j.tagline}</div>
                      <div className="lh2-card-price-row">
                        <div>
                          <div className="lh2-card-price">{fmt(priceFrom)}</div>
                          <div className="lh2-card-nights">{j.nights}n · 2 pax</div>
                        </div>
                        {saving > 0 && <div className="lh2-card-saving">Save {fmt(saving)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="lh2-footer">
          <div className="lh2-footer-inner">
            <div className="lh2-footer-top">
              <div className="lh2-footer-brand">
                <span className="lh2-footer-brand-name">The Safari Edition</span>
                <span className="lh2-footer-brand-sub">by The Travel Catalogue</span>
                <p>Africa's finest wilderness, contracted and curated. UK, US and German primary markets. ASATA and SATSA registered.</p>
              </div>
              <div className="lh2-footer-col"><h4>Journey</h4><ul>
                <li><a href="#" onClick={e=>{e.preventDefault();onPlanJourney();}}>Plan My Journey</a></li>
                <li><a href="#" onClick={e=>{e.preventDefault();onCuratedJourneys();}}>Curated Journeys</a></li>
                <li><a href="#" onClick={e=>{e.preventDefault();onSendBrief();}}>Send a Brief</a></li>
                <li><a href="/how-it-works">How It Works</a></li>
              </ul></div>
              <div className="lh2-footer-col"><h4>Company</h4><ul>
                <li><a href="/about">About Us</a></li>
                <li><a href="/contact">Contact</a></li>
                <li><a href="/admin">Partner Login</a></li>
              </ul></div>
              <div className="lh2-footer-col"><h4>Legal</h4><ul>
                <li><a href="/terms">Terms & Conditions</a></li>
                <li><a href="/privacy">Privacy Policy</a></li>
                <li><a href="/cancellation">Cancellation Policy</a></li>
              </ul></div>
            </div>
            <div className="lh2-footer-bottom">
              <div className="lh2-footer-legal">© {new Date().getFullYear()} The Safari Edition · A Travel Catalogue Edition · <a href="/terms">T&Cs</a> · <a href="/privacy">Privacy</a></div>
              <div className="lh2-asata"><div className="lh2-adot" />ASATA Member<div className="lh2-adot" />SATSA Member<div className="lh2-adot" />POPIA Compliant</div>
            </div>
          </div>
        </footer>
      </div>
    </>
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
        const e2 = 1 - Math.pow(1 - p, 3);
        setN(isFloat ? Math.round(e2 * value * 10) / 10 : Math.round(e2 * value));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);
  return <span ref={ref}>{n}</span>;
}
