// ─── THEME ───────────────────────────────────────────────────────────────────
// Design tokens. ONE source. Never duplicated.
// HANDOVER: swap EDITION_THEME per Edition. Nothing else changes visually.
//
// Font system:
//   Display (headings, prices, titles): Cormorant Garamond
//   Body (UI, labels, paragraphs):      Jost
//   Loaded globally via app/layout.tsx — no per-component @import needed.

export const T = {
  // Backgrounds — warm black, not blue-black
  bg:      '#0a0a0a',
  bg2:     '#111111',
  bg3:     '#181818',
  surface: '#1a1a1a',

  // Borders
  border:      'rgba(255,255,255,0.07)',
  borderGold:  'rgba(212,175,55,0.28)',

  // Gold brand colour
  gold:      '#d4af37',
  goldLight: '#f0c040',
  goldDim:   'rgba(212,175,55,0.12)',

  // Text
  text:    '#f5f0e8',
  textMid: 'rgba(245,240,232,0.58)',
  textDim: 'rgba(245,240,232,0.32)',

  // Accents
  green: '#4ade80',
  red:   '#f87171',
  amber: '#fb923c',
  blue:  '#60a5fa',

  // Pillar colours (for flight/hotel/transfer/activity colour coding)
  pillar: {
    flights:    '#d4af37',
    hotels:     '#4ade80',
    transfers:  '#60a5fa',
    activities: '#a78bfa',
    intl:       '#60a5fa',
  } as const,
} as const;

// Global CSS — injected once at app root via <style suppressHydrationWarning>.
// Fonts are pre-loaded by layout.tsx so @import here is a belt-and-suspenders
// fallback only (loads from cache if already fetched by layout).
export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Jost:wght@200;300;400;500;600&display=swap');

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }

body {
  background:${T.bg};
  color:${T.text};
  font-family:'Jost','DM Sans',-apple-system,sans-serif;
  font-weight:300;
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
}

/* Scrollbar */
::-webkit-scrollbar { width:3px; height:3px; }
::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.28); border-radius:2px; }

/* Range inputs */
input[type=range] { -webkit-appearance:none; width:100%; height:2px; border-radius:1px; background:rgba(255,255,255,0.1); outline:none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:${T.gold}; cursor:pointer; border:2px solid ${T.bg}; }

textarea { resize:vertical; }
select option { background:#1a1a1a; }

/* Animations */
@keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
@keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes spin    { to{transform:rotate(360deg)} }
@keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes glow    { 0%,100%{box-shadow:0 0 0 rgba(212,175,55,0)} 50%{box-shadow:0 0 24px rgba(212,175,55,0.5)} }

.fade-up { animation:fadeUp 0.45s ease forwards; }
/* Inspire-input split layout */
.inspire-split {
  display:grid;
  grid-template-columns:1fr 42%;
  min-height:calc(100vh - 58px);
  align-items:start;
}
.inspire-form {
  padding:32px clamp(20px,5vw,52px) 110px;
  max-width:680px;
}
.inspire-panel {
  position:sticky;
  top:58px;
  height:calc(100vh - 58px);
  overflow:hidden;
}
@media(max-width:860px){
  .inspire-split { grid-template-columns:1fr !important; }
  .inspire-panel { display:none !important; }
}

/* Loading spinner */
.spinner {
  width:22px; height:22px; border-radius:50%;
  border:2px solid rgba(212,175,55,0.12);
  border-top-color:${T.gold};
  animation:spin 0.75s linear infinite;
  display:inline-block;
}

/* Buttons */
.btn-gold {
  background:linear-gradient(135deg,${T.gold},${T.goldLight});
  border:none; color:#0a0a0a; border-radius:8px;
  padding:12px 22px; font-size:14px; font-weight:600;
  font-family:'Jost',sans-serif; letter-spacing:0.04em;
  cursor:pointer; transition:opacity 0.2s,transform 0.2s;
}
.btn-gold:hover    { opacity:.88; transform:translateY(-1px); }
.btn-gold:disabled { opacity:.4; cursor:not-allowed; transform:none; }

.btn-ghost {
  background:rgba(255,255,255,0.05);
  border:0.5px solid rgba(255,255,255,0.12);
  color:${T.text}; border-radius:8px;
  padding:12px 22px; font-size:14px;
  font-family:'Jost',sans-serif;
  cursor:pointer; transition:background 0.15s,border-color 0.15s;
}
.btn-ghost:hover { background:rgba(255,255,255,0.09); }

/* Overlay */
.overlay {
  position:fixed; inset:0; background:rgba(0,0,0,0.76);
  z-index:400; display:flex; align-items:flex-end; justify-content:center;
}
@media(min-width:600px){.overlay{align-items:center}}

/* Cards */
.card {
  background:${T.surface}; border:0.5px solid ${T.border};
  border-radius:14px; overflow:hidden; transition:border-color 0.2s;
}
.card:hover { border-color:rgba(212,175,55,0.18); }

/* Pills & tags */
.trust-pill { display:inline-flex; align-items:center; gap:4px; background:rgba(74,222,128,0.08); border:0.5px solid rgba(74,222,128,0.25); border-radius:20px; padding:3px 10px; font-size:11px; color:${T.green}; font-weight:600; }
.fun-fact   { background:rgba(212,175,55,0.06); border:0.5px solid rgba(212,175,55,0.14); border-radius:8px; padding:9px 13px; font-size:12px; color:rgba(212,175,55,0.82); line-height:1.55; margin-top:10px; }
.city-card  { background:${T.surface}; border:0.5px solid ${T.border}; border-radius:13px; padding:16px; margin-bottom:12px; }

/* ── MOBILE BCC OVERRIDES ─────────────────────────────────────────── */
@media (max-width: 699px) {
  body { overflow-x:hidden; }
  .inspire-split  { display:block !important; }
  .inspire-panel  { display:none !important; }
  .inspire-form   { padding:20px 18px 100px !important; max-width:100% !important; }
  [data-card]     { width:min(88vw,360px) !important; }
  [data-act-card] { width:min(80vw,260px) !important; }
  button, [role=button] { min-height:44px; }
}
@media (max-width: 480px) {
  [data-card] { width:min(92vw,340px) !important; }
}
.inter-transfer { background:rgba(96,165,250,0.05); border:0.5px solid rgba(96,165,250,0.18); border-radius:9px; padding:9px 13px; margin:7px 0; cursor:pointer; transition:background 0.15s; }
.inter-transfer:hover { background:rgba(96,165,250,0.1); }

/* KB tags */
.kb-tag-regional  { background:rgba(96,165,250,0.1);  border:0.5px solid rgba(96,165,250,0.3);  color:${T.blue};  padding:2px 8px; border-radius:20px; font-size:10px; font-weight:600; }
.kb-tag-property  { background:rgba(212,175,55,0.1);  border:0.5px solid rgba(212,175,55,0.3);  color:${T.gold};  padding:2px 8px; border-radius:20px; font-size:10px; font-weight:600; }
.kb-tag-trade_tip { background:rgba(74,222,128,0.1);  border:0.5px solid rgba(74,222,128,0.3);  color:${T.green}; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:600; }
.kb-flagged       { background:rgba(248,113,113,0.07); border:0.5px solid rgba(248,113,113,0.25); border-radius:7px; padding:5px 9px; font-size:11px; color:${T.red}; }
.property-card    { background:${T.surface}; border:0.5px solid ${T.border}; border-radius:14px; overflow:hidden; margin-bottom:4px; }
`;
