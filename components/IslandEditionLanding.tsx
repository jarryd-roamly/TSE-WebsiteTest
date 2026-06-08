'use client';

// IslandEditionLanding.tsx
// The Island Edition — Maldives · Seychelles · Zanzibar
// Distinct from Safari Edition: deep ocean palette, water-world imagery, island pacing

import { useState, useEffect, useRef } from 'react';

// ── Design tokens — Island Edition ─────────────────────────────────────────
// Same dark base as Safari, but ocean teal replaces safari gold
const C = {
  bg:     '#060d14',
  bg2:    '#0a1520',
  bg3:    '#0f1e2e',
  surf:   '#132233',
  border: 'rgba(255,255,255,0.07)',
  borderTeal: 'rgba(32,178,170,0.28)',
  teal:   '#20b2aa',
  tealDim:'rgba(32,178,170,0.12)',
  tealGlow:'rgba(32,178,170,0.22)',
  text:   '#eef4f8',
  textMid:'rgba(238,244,248,0.58)',
  textDim:'rgba(238,244,248,0.32)',
  white:  '#ffffff',
};

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Jost:wght@200;300;400;500;600&display=swap');
`;

// ── Island destinations ──────────────────────────────────────────────────────
const DESTINATIONS = [
  {
    id: 'maldives',
    name: 'Maldives',
    sub: 'The definitive island escape',
    tag: 'North Malé · Baa Atoll · Noonu Atoll',
    img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=900&q=80',
    highlight: 'Overwater bungalows. House reef snorkelling at dawn. No shoes required.',
    nights: '5–10 nights',
    from: '$8,400',
  },
  {
    id: 'seychelles',
    name: 'Seychelles',
    sub: 'Pristine granite archipelago',
    tag: 'Mahé · Praslin · La Digue · Fregate',
    img: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=900&q=80',
    highlight: 'World\'s only island coco de mer forest. Secluded beaches with zero footprints.',
    nights: '7–14 nights',
    from: '$11,200',
  },
  {
    id: 'zanzibar',
    name: 'Zanzibar',
    sub: 'Spice island & turquoise coast',
    tag: 'Stone Town · North Coast · Pemba',
    img: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=900&q=80',
    highlight: 'Swahili culture, coral reefs, and dhow sunsets. The perfect safari extension.',
    nights: '3–7 nights',
    from: '$3,200',
  },
];

// ── Curated journeys ─────────────────────────────────────────────────────────
const JOURNEYS = [
  {
    name: 'The Maldives Immersion',
    nights: 8,
    tagline: 'Two atolls. Reef to horizon. Nothing else.',
    badge: 'Most booked',
    badgeColor: C.teal,
    img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=700&q=80',
    priceFrom: 142000,
    otaPrice: 198000,
  },
  {
    name: 'Seychelles & Outer Islands',
    nights: 11,
    tagline: 'Begin Mahé. Discover Praslin. Disappear to Fregate.',
    badge: 'Our favourite',
    badgeColor: '#a78bfa',
    img: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=700&q=80',
    priceFrom: 198000,
    otaPrice: 271000,
  },
  {
    name: 'Safari & Zanzibar',
    nights: 10,
    tagline: 'Three nights Zanzibar. The perfect safari ending.',
    badge: 'Pairs perfectly',
    badgeColor: '#4ade80',
    img: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=700&q=80',
    priceFrom: 98000,
    otaPrice: 134000,
  },
];

// ── Trust signals ─────────────────────────────────────────────────────────────
const TRUST = [
  { icon: '🪸', label: 'Reef-certified partners', sub: 'Every resort scored on marine conservation' },
  { icon: '🛥', label: 'Private transfers only', sub: 'No shared speedboats or group shuttles' },
  { icon: '👤', label: 'Island Specialist assigned', sub: 'Before, during, and after your trip' },
  { icon: '📍', label: 'Atoll-level expertise', sub: 'We know which overwater faces the sunset' },
];

// ── How it works ──────────────────────────────────────────────────────────────
const HOW = [
  { n: '01', title: 'Choose your atoll', body: 'Tell us your island vision in two minutes — pace, privacy, experience level.' },
  { n: '02', title: 'Itinerary builds instantly', body: 'Our engine sequences transfers, tides, and resort rates. Everything timed.' },
  { n: '03', title: 'Specialist refines it', body: 'A human island specialist confirms every detail and personalises your stay.' },
  { n: '04', title: 'Travel with confidence', body: 'Concierge available throughout. Every reef transfer pre-arranged.' },
];

// ── Interest form state ──────────────────────────────────────────────────────
interface FormState { name: string; email: string; destination: string; when: string; submitted: boolean; }

export default function IslandEditionLanding() {
  const [scrolled,   setScrolled]   = useState(false);
  const [activeImg,  setActiveImg]  = useState(0);
  const [form,       setForm]       = useState<FormState>({ name:'', email:'', destination:'any', when:'', submitted:false });
  const [mounted,    setMounted]    = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Rotate hero background
  useEffect(() => {
    const t = setInterval(() => setActiveImg(i => (i + 1) % DESTINATIONS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForm(f => ({ ...f, submitted: true }));
  };

  const fmt = (n: number) => `R ${Math.round(n).toLocaleString()}`;

  if (!mounted) return null;

  return (
    <>
      <style suppressHydrationWarning>{`
        ${FONTS}
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        body { background:${C.bg}; color:${C.text}; font-family:'Jost','DM Sans',sans-serif; font-weight:300; }
        .ie-nav { position:fixed; top:0; left:0; right:0; z-index:100; padding:0 24px; height:60px; display:flex; align-items:center; justify-content:space-between; transition:background 0.3s; }
        .ie-nav.scrolled { background:rgba(6,13,20,0.94); backdrop-filter:blur(12px); border-bottom:0.5px solid ${C.border}; }
        .ie-wordmark { font-family:'Cormorant Garamond',serif; font-size:18px; font-weight:600; color:${C.teal}; letter-spacing:0.12em; text-transform:uppercase; }
        .ie-wordmark small { display:block; font-size:9px; font-weight:300; color:${C.textDim}; letter-spacing:0.22em; margin-top:-2px; }
        .ie-nav-link { font-size:12px; color:${C.textMid}; text-decoration:none; letter-spacing:0.06em; transition:color 0.2s; }
        .ie-nav-link:hover { color:${C.teal}; }
        .ie-back-btn { font-size:11px; color:${C.textDim}; border:0.5px solid ${C.border}; border-radius:20px; padding:5px 12px; text-decoration:none; letter-spacing:0.06em; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
        .ie-back-btn:hover { color:${C.text}; border-color:rgba(255,255,255,0.2); }
        .ie-hero { position:relative; min-height:100svh; display:flex; align-items:flex-end; overflow:hidden; }
        .ie-hero-bg { position:absolute; inset:0; z-index:0; }
        .ie-hero-bg img { width:100%; height:100%; object-fit:cover; transition:opacity 1.2s ease; }
        .ie-hero-bg::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(6,13,20,0.28) 0%, rgba(6,13,20,0.55) 60%, rgba(6,13,20,0.95) 100%); }
        .ie-hero-content { position:relative; z-index:1; padding:40px 48px 80px; max-width:700px; }
        .ie-edition-label { font-size:10px; letter-spacing:0.28em; color:${C.teal}; text-transform:uppercase; font-weight:500; margin-bottom:18px; }
        .ie-hero-title { font-family:'Cormorant Garamond',serif; font-size:clamp(42px,6vw,76px); font-weight:300; line-height:1.05; color:${C.white}; margin-bottom:18px; }
        .ie-hero-title em { font-style:italic; color:${C.teal}; }
        .ie-hero-sub { font-size:16px; color:rgba(238,244,248,0.72); line-height:1.6; max-width:440px; margin-bottom:36px; font-weight:300; }
        .ie-hero-cta { display:inline-flex; align-items:center; gap:10px; background:${C.teal}; color:#060d14; padding:13px 28px; border-radius:3px; font-size:13px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; border:none; font-family:'Jost',sans-serif; transition:all 0.2s; }
        .ie-hero-cta:hover { background:#25cec5; transform:translateY(-1px); }
        .ie-hero-ghost { display:inline-flex; align-items:center; gap:10px; background:transparent; color:${C.text}; padding:13px 28px; border-radius:3px; font-size:13px; font-weight:400; letter-spacing:0.08em; cursor:pointer; border:0.5px solid rgba(255,255,255,0.25); font-family:'Jost',sans-serif; transition:all 0.2s; margin-left:12px; }
        .ie-hero-ghost:hover { border-color:${C.teal}; color:${C.teal}; }
        .ie-dest-dots { position:absolute; bottom:32px; right:48px; z-index:2; display:flex; gap:8px; }
        .ie-dot { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.3); cursor:pointer; transition:all 0.2s; }
        .ie-dot.active { background:${C.teal}; transform:scale(1.4); }
        .ie-section { padding:96px 48px; max-width:1200px; margin:0 auto; }
        .ie-section-label { font-size:10px; letter-spacing:0.28em; color:${C.teal}; text-transform:uppercase; margin-bottom:12px; }
        .ie-section-title { font-family:'Cormorant Garamond',serif; font-size:clamp(30px,4vw,48px); font-weight:300; color:${C.text}; margin-bottom:20px; line-height:1.15; }
        .ie-section-body { font-size:15px; color:${C.textMid}; line-height:1.7; max-width:560px; }
        .ie-dest-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; margin-top:48px; }
        .ie-dest-card { position:relative; overflow:hidden; aspect-ratio:3/4; cursor:pointer; }
        .ie-dest-card img { width:100%; height:100%; object-fit:cover; transition:transform 0.6s ease; }
        .ie-dest-card:hover img { transform:scale(1.06); }
        .ie-dest-card-overlay { position:absolute; inset:0; background:linear-gradient(180deg,transparent 40%,rgba(6,13,20,0.9) 100%); padding:24px; display:flex; flex-direction:column; justify-content:flex-end; }
        .ie-dest-name { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:400; color:${C.white}; }
        .ie-dest-sub { font-size:11px; color:${C.teal}; letter-spacing:0.12em; margin-bottom:6px; text-transform:uppercase; }
        .ie-dest-tag { font-size:11px; color:rgba(238,244,248,0.5); margin-top:4px; }
        .ie-dest-nights { position:absolute; top:16px; right:16px; background:rgba(6,13,20,0.75); border:0.5px solid ${C.borderTeal}; border-radius:20px; padding:4px 12px; font-size:10px; color:${C.teal}; letter-spacing:0.08em; }
        .ie-journey-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:48px; }
        .ie-journey-card { background:${C.bg2}; border:0.5px solid ${C.border}; border-radius:12px; overflow:hidden; transition:border-color 0.2s; }
        .ie-journey-card:hover { border-color:${C.borderTeal}; }
        .ie-journey-img { width:100%; aspect-ratio:16/9; object-fit:cover; }
        .ie-journey-body { padding:20px; }
        .ie-journey-badge { display:inline-block; font-size:9px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; padding:3px 9px; border-radius:20px; margin-bottom:10px; }
        .ie-journey-name { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:400; color:${C.text}; margin-bottom:6px; }
        .ie-journey-tagline { font-size:12px; color:${C.textMid}; line-height:1.5; margin-bottom:16px; }
        .ie-journey-price { display:flex; align-items:baseline; gap:10px; }
        .ie-journey-from { font-size:18px; font-weight:600; color:${C.text}; }
        .ie-journey-ota { font-size:12px; color:${C.textDim}; text-decoration:line-through; }
        .ie-journey-saving { font-size:10px; color:#4ade80; font-weight:600; letter-spacing:0.06em; }
        .ie-trust-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:2px; margin-top:48px; }
        .ie-trust-item { background:${C.bg2}; padding:32px 24px; }
        .ie-trust-icon { font-size:28px; margin-bottom:14px; }
        .ie-trust-label { font-size:14px; font-weight:500; color:${C.text}; margin-bottom:6px; }
        .ie-trust-sub { font-size:12px; color:${C.textDim}; line-height:1.5; }
        .ie-how-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:2px; margin-top:48px; }
        .ie-how-item { background:${C.bg2}; padding:32px 24px; }
        .ie-how-n { font-family:'Cormorant Garamond',serif; font-size:40px; font-weight:300; color:${C.borderTeal}; margin-bottom:14px; line-height:1; }
        .ie-how-title { font-size:14px; font-weight:500; color:${C.text}; margin-bottom:8px; }
        .ie-how-body { font-size:12px; color:${C.textDim}; line-height:1.6; }
        .ie-form-section { background:${C.bg2}; border-top:0.5px solid ${C.border}; padding:96px 48px; }
        .ie-form-inner { max-width:560px; margin:0 auto; }
        .ie-form { display:grid; gap:12px; margin-top:36px; }
        .ie-form input, .ie-form select { background:${C.bg3}; border:0.5px solid ${C.border}; border-radius:6px; padding:12px 16px; color:${C.text}; font-family:'Jost',sans-serif; font-size:13px; width:100%; outline:none; transition:border-color 0.2s; }
        .ie-form input:focus, .ie-form select:focus { border-color:${C.teal}; }
        .ie-form input::placeholder { color:${C.textDim}; }
        .ie-form select option { background:${C.bg3}; }
        .ie-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .ie-form-submit { background:${C.teal}; color:#060d14; border:none; border-radius:6px; padding:13px 28px; font-family:'Jost',sans-serif; font-size:13px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; cursor:pointer; width:100%; margin-top:4px; transition:background 0.2s; }
        .ie-form-submit:hover { background:#25cec5; }
        .ie-form-success { text-align:center; padding:32px; }
        .ie-form-success-icon { font-size:40px; margin-bottom:12px; }
        .ie-form-success-title { font-family:'Cormorant Garamond',serif; font-size:26px; color:${C.text}; margin-bottom:8px; }
        .ie-form-success-body { font-size:13px; color:${C.textMid}; line-height:1.6; }
        .ie-footer { padding:40px 48px; border-top:0.5px solid ${C.border}; display:flex; justify-content:space-between; align-items:center; }
        .ie-footer-brand { font-family:'Cormorant Garamond',serif; font-size:13px; color:${C.textDim}; letter-spacing:0.1em; }
        .ie-footer-links { display:flex; gap:24px; }
        .ie-footer-link { font-size:11px; color:${C.textDim}; text-decoration:none; letter-spacing:0.06em; transition:color 0.2s; }
        .ie-footer-link:hover { color:${C.teal}; }
        .ie-safari-banner { background:linear-gradient(135deg,#0f1a0a,#151f10); border:0.5px solid rgba(212,175,55,0.2); border-radius:12px; padding:28px 32px; display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:48px; }
        .ie-safari-text strong { font-family:'Cormorant Garamond',serif; font-size:20px; font-weight:400; color:#f5f0e8; display:block; margin-bottom:4px; }
        .ie-safari-text span { font-size:12px; color:rgba(212,175,55,0.7); }
        .ie-safari-btn { background:rgba(212,175,55,0.1); border:0.5px solid rgba(212,175,55,0.3); color:#d4af37; padding:10px 22px; border-radius:6px; font-family:'Jost',sans-serif; font-size:12px; font-weight:500; letter-spacing:0.08em; text-decoration:none; white-space:nowrap; transition:all 0.2s; }
        .ie-safari-btn:hover { background:rgba(212,175,55,0.18); }
        @media (max-width:768px) {
          .ie-hero-content { padding:32px 24px 72px; }
          .ie-section { padding:64px 24px; }
          .ie-dest-grid, .ie-journey-grid { grid-template-columns:1fr; }
          .ie-trust-grid, .ie-how-grid { grid-template-columns:1fr 1fr; }
          .ie-form-section { padding:64px 24px; }
          .ie-form-row { grid-template-columns:1fr; }
          .ie-footer { flex-direction:column; gap:16px; text-align:center; }
          .ie-footer-links { flex-wrap:wrap; justify-content:center; }
          .ie-safari-banner { flex-direction:column; align-items:flex-start; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className={`ie-nav ${scrolled ? 'scrolled' : ''}`}>
        <div>
          <div className="ie-wordmark">The Island Edition<small>by The Travel Catalogue</small></div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <a href="#destinations" className="ie-nav-link">Destinations</a>
          <a href="#journeys" className="ie-nav-link">Journeys</a>
          <a href="#notify" className="ie-nav-link">Notify me</a>
          <a href="/" className="ie-back-btn">← The Safari Edition</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="ie-hero" ref={heroRef} id="top">
        <div className="ie-hero-bg">
          {DESTINATIONS.map((d, i) => (
            <img
              key={d.id}
              src={d.img}
              alt={d.name}
              style={{ position:'absolute', inset:0, opacity: i === activeImg ? 1 : 0, transition:'opacity 1.4s ease' }}
            />
          ))}
        </div>

        <div className="ie-hero-content">
          <div className="ie-edition-label">✦ The Island Edition</div>
          <h1 className="ie-hero-title">
            Where the ocean<br /><em>is the destination</em>
          </h1>
          <p className="ie-hero-sub">
            The same specialist knowledge and contracted rates that define The Safari Edition — now applied to the world's finest island escapes. Maldives. Seychelles. Zanzibar.
          </p>
          <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8 }}>
            <a href="#notify">
              <button className="ie-hero-cta">Request early access →</button>
            </a>
            <a href="#destinations">
              <button className="ie-hero-ghost">Explore islands</button>
            </a>
          </div>
        </div>

        <div className="ie-dest-dots">
          {DESTINATIONS.map((d, i) => (
            <div
              key={d.id}
              className={`ie-dot ${i === activeImg ? 'active' : ''}`}
              onClick={() => setActiveImg(i)}
            />
          ))}
        </div>
      </section>

      {/* ── DESTINATIONS ── */}
      <section className="ie-section" id="destinations">
        <div className="ie-section-label">✦ Where we operate</div>
        <h2 className="ie-section-title">Three island worlds.<br />One specialist platform.</h2>
        <p className="ie-section-body">
          Every resort personally evaluated. Overwater villa categories mapped. Transfer timing pre-calculated. The Island Edition applies the same rigour as the safari world to the Indian Ocean.
        </p>

        <div className="ie-dest-grid">
          {DESTINATIONS.map(d => (
            <div key={d.id} className="ie-dest-card">
              <img src={d.img} alt={d.name} loading="lazy" />
              <div className="ie-dest-card-overlay">
                <div className="ie-dest-sub">{d.tag}</div>
                <div className="ie-dest-name">{d.name}</div>
                <div style={{ fontSize:12, color:C.textMid, lineHeight:1.5, marginTop:8 }}>{d.highlight}</div>
              </div>
              <div className="ie-dest-nights">{d.nights} · from {d.from}/pp</div>
            </div>
          ))}
        </div>

        {/* Safari edition cross-sell */}
        <div className="ie-safari-banner">
          <div className="ie-safari-text">
            <strong>Planning a bush & beach combination?</strong>
            <span>The Safari Edition handles Southern Africa. We connect the two.</span>
          </div>
          <a href="/" className="ie-safari-btn">← The Safari Edition</a>
        </div>
      </section>

      {/* ── JOURNEYS ── */}
      <section style={{ padding:'0 48px 96px', maxWidth:1200, margin:'0 auto' }} id="journeys">
        <div className="ie-section-label">✦ Curated journeys</div>
        <h2 className="ie-section-title">Our most-booked island programmes</h2>

        <div className="ie-journey-grid">
          {JOURNEYS.map(j => {
            const saving = Math.round((1 - j.priceFrom / j.otaPrice) * 100);
            return (
              <div key={j.name} className="ie-journey-card">
                <img src={j.img} alt={j.name} className="ie-journey-img" loading="lazy" />
                <div className="ie-journey-body">
                  <div className="ie-journey-badge" style={{ background:`${j.badgeColor}18`, color:j.badgeColor, border:`0.5px solid ${j.badgeColor}40` }}>{j.badge}</div>
                  <div className="ie-journey-name">{j.name}</div>
                  <div style={{ fontSize:11, color:C.teal, marginBottom:8, letterSpacing:'0.06em' }}>{j.nights} nights</div>
                  <div className="ie-journey-tagline">{j.tagline}</div>
                  <div className="ie-journey-price">
                    <span className="ie-journey-from">{fmt(j.priceFrom)} <span style={{ fontSize:11, fontWeight:300, color:C.textDim }}>/person</span></span>
                    <span className="ie-journey-ota">{fmt(j.otaPrice)}</span>
                    <span className="ie-journey-saving">↓ {saving}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{ background:C.bg2, borderTop:`0.5px solid ${C.border}`, borderBottom:`0.5px solid ${C.border}` }}>
        <div style={{ padding:'96px 48px', maxWidth:1200, margin:'0 auto' }}>
          <div className="ie-section-label">✦ Why book with us</div>
          <h2 className="ie-section-title">The specialist difference</h2>
          <div className="ie-trust-grid">
            {TRUST.map(t => (
              <div key={t.label} className="ie-trust-item">
                <div className="ie-trust-icon">{t.icon}</div>
                <div className="ie-trust-label">{t.label}</div>
                <div className="ie-trust-sub">{t.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding:'96px 48px', maxWidth:1200, margin:'0 auto' }}>
        <div className="ie-section-label">✦ The process</div>
        <h2 className="ie-section-title">Five questions.<br />A fully-priced island itinerary.</h2>
        <div className="ie-how-grid">
          {HOW.map(h => (
            <div key={h.n} className="ie-how-item">
              <div className="ie-how-n">{h.n}</div>
              <div className="ie-how-title">{h.title}</div>
              <div className="ie-how-body">{h.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INTEREST FORM ── */}
      <section className="ie-form-section" id="notify">
        <div className="ie-form-inner">
          <div className="ie-section-label">✦ Early access</div>
          <h2 className="ie-section-title" style={{ fontSize:'clamp(28px,3vw,40px)' }}>
            The Island Edition launches<br />Q1 2027
          </h2>
          <p className="ie-section-body">
            We are currently contracting with resorts and building the Knowledge Base. Register below and your Island Specialist will reach out personally when planning opens for your dates.
          </p>

          {form.submitted ? (
            <div className="ie-form-success">
              <div className="ie-form-success-icon">🌊</div>
              <div className="ie-form-success-title">You're on the list, {form.name.split(' ')[0]}.</div>
              <div className="ie-form-success-body">
                Your Island Specialist will be in touch before launch. In the meantime, our safari specialists are available now — the bush and beach combination is one of our most-booked pairings.
              </div>
              <a href="/" style={{ display:'inline-block', marginTop:20, color:C.teal, fontSize:13, letterSpacing:'0.06em' }}>Explore The Safari Edition →</a>
            </div>
          ) : (
            <form className="ie-form" onSubmit={handleSubmit}>
              <div className="ie-form-row">
                <input
                  type="text" required placeholder="Your name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))}
                />
                <input
                  type="email" required placeholder="Email address"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))}
                />
              </div>
              <select value={form.destination} onChange={e => setForm(f => ({ ...f, destination:e.target.value }))}>
                <option value="any">Any destination — help me choose</option>
                <option value="maldives">Maldives</option>
                <option value="seychelles">Seychelles</option>
                <option value="zanzibar">Zanzibar</option>
                <option value="safari-and-island">Safari + island combination</option>
              </select>
              <input
                type="text" placeholder="When are you thinking of travelling? (e.g. June 2027)"
                value={form.when} onChange={e => setForm(f => ({ ...f, when:e.target.value }))}
              />
              <button type="submit" className="ie-form-submit">Register interest →</button>
              <p style={{ fontSize:11, color:C.textDim, textAlign:'center', lineHeight:1.5 }}>
                No spam. Your Island Specialist reaches out personally — not an automated sequence.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ie-footer">
        <div className="ie-footer-brand">The Island Edition · by The Travel Catalogue</div>
        <div className="ie-footer-links">
          <a href="/" className="ie-footer-link">The Safari Edition</a>
          <a href="/privacy" className="ie-footer-link">Privacy</a>
          <a href="/terms" className="ie-footer-link">Terms</a>
          <a href="/contact" className="ie-footer-link">Contact</a>
        </div>
      </footer>
    </>
  );
}
