// ─── THEME ───────────────────────────────────────────────────────────────────
// Design tokens. ONE source. Never duplicated (T2 in MsBriefScreen was a bug — fixed).
// HANDOVER: swap EDITION_THEME per Edition. Nothing else changes visually.

export const T = {
  bg: '#0a0a0a', bg2: '#111111', bg3: '#181818', surface: '#1e1e1e',
  border: 'rgba(255,255,255,0.08)', borderGold: 'rgba(212,175,55,0.3)',
  gold: '#d4af37', goldLight: '#f0c040', goldDim: 'rgba(212,175,55,0.15)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.6)', textDim: 'rgba(245,240,232,0.35)',
  green: '#4ade80', red: '#f87171', amber: '#fb923c',
  pillar: {
    flights: '#d4af37', hotels: '#4ade80', transfers: '#60a5fa', activities: '#a78bfa', intl: '#60a5fa',
  } as const,
} as const;

// Global CSS — injected ONCE at app root. Never regenerated per render.
// Was a bug in original: css string was inside component = re-created every render.
export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.text};font-family:'DM Sans','Segoe UI',sans-serif;line-height:1.5}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:2px}
input[type=range]{-webkit-appearance:none;width:100%;height:2px;border-radius:1px;background:rgba(255,255,255,0.12);outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${T.gold};cursor:pointer;border:2px solid ${T.bg}}
textarea{resize:vertical}select option{background:#1e1e1e}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
.fade-up{animation:fadeUp 0.45s ease forwards}
.spinner{width:20px;height:20px;border-radius:50%;border:2px solid rgba(212,175,55,0.12);border-top-color:${T.gold};animation:spin 0.75s linear infinite;display:inline-block}
.btn-gold{background:linear-gradient(135deg,${T.gold},${T.goldLight});border:none;color:#0a0a0a;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s}
.btn-gold:hover{opacity:.88;transform:translateY(-1px)}
.btn-gold:disabled{opacity:.4;cursor:not-allowed;transform:none}
.btn-ghost{background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.14);color:${T.text};border-radius:10px;padding:12px 22px;font-size:14px;cursor:pointer;font-family:inherit;transition:all 0.15s}
.btn-ghost:hover{background:rgba(255,255,255,0.1)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:400;display:flex;align-items:flex-end;justify-content:center}
@media(min-width:600px){.overlay{align-items:center}}
.card{background:${T.surface};border:0.5px solid ${T.border};border-radius:16px;overflow:hidden;transition:border-color 0.2s}
.card:hover{border-color:rgba(212,175,55,0.18)}
.trust-pill{display:inline-flex;align-items:center;gap:4px;background:rgba(74,222,128,0.08);border:0.5px solid rgba(74,222,128,0.25);border-radius:20px;padding:3px 10px;font-size:11px;color:${T.green};font-weight:600}
.city-card{background:${T.surface};border:0.5px solid ${T.border};border-radius:14px;padding:16px;margin-bottom:12px}
.fun-fact{background:rgba(212,175,55,0.07);border:0.5px solid rgba(212,175,55,0.16);border-radius:10px;padding:10px 14px;font-size:12px;color:rgba(212,175,55,0.85);line-height:1.55;margin-top:10px}
.inter-transfer{background:rgba(96,165,250,0.06);border:0.5px solid rgba(96,165,250,0.2);border-radius:10px;padding:10px 14px;margin:8px 0;cursor:pointer;transition:all 0.15s}
.inter-transfer:hover{background:rgba(96,165,250,0.1)}
.property-card{background:${T.surface};border:0.5px solid ${T.border};border-radius:16px;overflow:hidden;margin-bottom:4px}
.kb-tag-regional{background:rgba(96,165,250,0.1);border:0.5px solid rgba(96,165,250,0.3);color:#60a5fa;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
.kb-tag-property{background:rgba(212,175,55,0.1);border:0.5px solid rgba(212,175,55,0.3);color:${T.gold};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
.kb-tag-trade_tip{background:rgba(74,222,128,0.1);border:0.5px solid rgba(74,222,128,0.3);color:${T.green};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
.kb-flagged{background:rgba(248,113,113,0.07);border:0.5px solid rgba(248,113,113,0.25);border-radius:8px;padding:6px 10px;font-size:11px;color:#f87171}
`;