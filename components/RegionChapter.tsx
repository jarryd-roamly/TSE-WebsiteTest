'use client';
// components/RegionChapter.tsx  v3
// Immersive chapter wrapper. Carousels are children — untouched.
// Left: region facts / KB highlights / skeleton findings (traveller-safe only)
// Right: seasonal note / property tips (traveller-safe only)
// Background: per-region static image at 9% opacity, fades in on scroll
// Chapter split: prominent gold rule + chapter label between regions

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { T } from '@/app/lib/theme';

export interface SkeletonFinding {
  id:string; category:string;
  severity:'block'|'warning'|'recommendation'|'confirmed';
  title:string; traveller_message:string;
  kb_entry_id?:string; traveller_flagged:boolean;
}

export interface RegionChapterProps {
  chapterIndex:         number;
  totalChapters:        number;
  regionSlug:           string;
  regionLabel:          string;
  countryLabel:         string;
  nights:               number;
  checkinDate?:         string;
  bgImageUrl?:          string;
  kbHighlights:         string[];  // traveller-safe facts about the region
  kbTips:               string[];  // traveller-safe tips
  skeletonFindings:     SkeletonFinding[];
  selectedHotelName?:   string;
  selectedHotelIncludes:string[];  // rate_includes from suppliers
  malariaFree:          boolean;
  seasonalNote?:        string;
  specialistNote?:      string;    // MUST be traveller-safe before passing in
  onRegionVisible?:     (slug: string) => void;  // fires when chapter enters viewport
  children:             ReactNode;
}

// ── Static data ───────────────────────────────────────────────────────────────

const REGION_BG: Record<string,string> = {
  'kruger-sabi-sand':'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1600&q=50',
  'okavango-delta':  'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1600&q=50',
  'cape-town':       'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600&q=50',
  'madikwe':         'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1600&q=50',
  'chobe-vic-falls': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=50',
  'masai-mara':      'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=1600&q=50',
};

const CHAPTER_TAG: Record<string,string> = {
  'kruger-sabi-sand':'The Bush','okavango-delta':'The Delta',
  'cape-town':'The Cape','madikwe':'The Reserve',
  'chobe-vic-falls':'The Falls','masai-mara':'The Mara',
};

const INCLUSION_LABELS: Record<string,{icon:string;label:string}> = {
  all_meals:      {icon:'meals',label:'All meals'},
  game_drives:    {icon:'safari',label:'Game drives'},
  mokoro:         {icon:'boat',label:'Mokoro'},
  local_drinks:   {icon:'drinks',label:'Local drinks'},
  premium_drinks: {icon:'drinks',label:'Premium drinks'},
  laundry:        {icon:'laundry',label:'Laundry'},
  park_fees:      {icon:'leaf',label:'Park fees'},
};

// Clean, consistent monochrome line icons (replaces inconsistent emoji)
function IncIcon({ kind, color }: { kind:string; color:string }) {
  const common = { width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:color, strokeWidth:2, strokeLinecap:'round' as const, strokeLinejoin:'round' as const };
  switch (kind) {
    case 'meals':   return <svg {...common}><path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M6 12v9"/><path d="M18 3c-1.5 1-2.5 3-2.5 6 0 2 .5 3 2.5 3v9"/></svg>;
    case 'safari':  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M2 12h3M19 12h3M12 2v3M12 19v3"/></svg>;
    case 'boat':    return <svg {...common}><path d="M3 14l1.5 5h15L21 14"/><path d="M5 14V8a7 7 0 0 1 14 0v6"/><path d="M12 3v4"/></svg>;
    case 'drinks':  return <svg {...common}><path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3Z"/><path d="M12 13v6M9 21h6"/></svg>;
    case 'laundry': return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'leaf':    return <svg {...common}><path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 16-9 0 7-4 13-9 13Z"/><path d="M4 20c2-4 5-6 9-7"/></svg>;
    default:        return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

const SEV: Record<string,{color:string;bg:string;icon:string}> = {
  block:          {color:T.red,   bg:'rgba(248,113,113,0.08)',icon:'⚠'},
  warning:        {color:T.amber, bg:'rgba(251,146,60,0.07)', icon:'◈'},
  recommendation: {color:T.blue,  bg:'rgba(96,165,250,0.07)', icon:'›'},
  confirmed:      {color:T.green, bg:'rgba(74,222,128,0.07)', icon:'✓'},
};

// ── Fade-on-scroll hook ───────────────────────────────────────────────────────

function useFade(threshold=0.05) {
  const ref = useRef(null as HTMLDivElement | null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVis(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.intersectionRatio >= threshold) setVis(true); },
      { threshold:[0, threshold, 0.25], rootMargin:'0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

// ── Typewriter hook — streams text character-by-character when activated ─────
// Used in LeftSidebar (left-first) and RightSidebar (delayed 450ms).
// Each string in `texts` streams sequentially.
function useTypewriter(
  texts: string[],
  active: boolean,
  msPerChar = 26,
  startDelayMs = 0
): string[] {
  const [displayed, setDisplayed] = useState(texts.map(() => '') as string[]);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    cancelRef.current = false;

    const run = async () => {
      if (startDelayMs > 0) await new Promise(r => setTimeout(r, startDelayMs));
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        for (let j = 1; j <= text.length; j++) {
          if (cancelRef.current) return;
          const char = j; const idx = i;
          setDisplayed(prev => { const n = [...prev]; n[idx] = text.slice(0, char); return n; });
          await new Promise(r => setTimeout(r, msPerChar));
        }
        if (i < texts.length - 1 && !cancelRef.current) {
          await new Promise(r => setTimeout(r, 380));
        }
      }
    };

    run();
    return () => { cancelRef.current = true; };
  // Re-run when active changes OR when texts content changes (handles async KB load)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, texts.join('||')]);

  // Reset displayed state when texts change so old streamed text doesn't linger
  useEffect(() => {
    setDisplayed(texts.map(() => ''));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts.join('||')]);

  return displayed;
}

// ── Mobile hook ──────────────────────────────────────────────────────────────

function useMobile() {
  const [m,       setM]       = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const check = () => setM(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);
  // Return false until mounted — prevents SSR/hydration mismatch
  return mounted && m;
}

// ── Mobile CSS ────────────────────────────────────────────────────────────────

const MOBILE_BCC_CSS = `
  @keyframes kbCursor { 0%,100%{opacity:1} 50%{opacity:0} }

  /* ── Mobile BCC global ────────────────────────────────────────── */
  @media (max-width: 699px) {
    /* Bigger tap targets */
    button { min-height: 44px; }

    /* Nav safe area */
    .bcc-nav { padding-left: max(16px, env(safe-area-inset-left)) !important; padding-right: max(16px, env(safe-area-inset-right)) !important; }

    /* Inspire-input — single column, full padding */
    .inspire-split { display:block !important; }
    .inspire-form  { padding: 24px 20px 100px !important; max-width:100% !important; }

    /* Property cards — full viewport width */
    [data-card] { width: min(88vw, 380px) !important; }

    /* Prevent horizontal overflow */
    body { overflow-x: hidden; }
  }
`;

// ── Mobile RegionChapter layout ───────────────────────────────────────────────

function MobileRegionChapter({
  chapterIndex, totalChapters, regionSlug, regionLabel, countryLabel,
  nights, checkinDate, kbHighlights, kbTips, skeletonFindings,
  selectedHotelName, selectedHotelIncludes, malariaFree,
  seasonalNote, specialistNote, onRegionVisible, children,
}: RegionChapterProps) {
  const ref = useRef(null as HTMLDivElement | null);
  const [entered,       setEntered]       = useState(false);
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [drawerPeeked,  setDrawerPeeked]  = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setEntered(true); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setEntered(true);
        onRegionVisible?.(regionSlug);
        // Peek drawer after region enters
        setTimeout(() => { setDrawerPeeked(true); }, 600);
      }
    }, { threshold: 0.08, rootMargin: '-15% 0px -15% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hasMeta = kbHighlights.length > 0 || kbTips.length > 0 || !!seasonalNote || !!specialistNote;
  const month   = checkinDate ? new Date(checkinDate).toLocaleString('en', { month: 'long' }) : null;
  const warns   = skeletonFindings.filter(f => f.severity === 'warning' || f.severity === 'recommendation');

  return (
    <div ref={ref} style={{ position: 'relative', paddingBottom: hasMeta ? 0 : 0 }}>
      <style suppressHydrationWarning>{MOBILE_BCC_CSS}</style>

      {/* Chapter divider */}
      {chapterIndex > 0 && (
        <div style={{ padding: '32px 0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, transparent, \${T.gold}55, \${T.gold}88, \${T.gold}55, transparent)` }} />
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <div style={{ width: 5, height: 5, background: T.gold, transform: 'rotate(45deg)', opacity: 0.8 }} />
              <div style={{ fontSize: 8, letterSpacing: '0.45em', textTransform: 'uppercase' as const, color: T.gold, opacity: 0.7, whiteSpace: 'nowrap' as const }}>
                {String(chapterIndex + 1).padStart(2, '0')} / {String(totalChapters).padStart(2, '0')} &nbsp;·&nbsp; {CHAPTER_TAG[regionSlug] ?? regionLabel} &nbsp;·&nbsp; {countryLabel}
              </div>
              <div style={{ width: 5, height: 5, background: T.gold, transform: 'rotate(45deg)', opacity: 0.8 }} />
            </div>
            <div style={{ flex: 1, height: '1px', background: `linear-gradient(to left, transparent, \${T.gold}55, \${T.gold}88, \${T.gold}55, transparent)` }} />
          </div>
        </div>
      )}

      {chapterIndex === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '0 2px' }}>
          <div style={{ fontSize: 8, letterSpacing: '0.38em', textTransform: 'uppercase' as const, color: T.gold, opacity: 0.5, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
            {String(chapterIndex + 1).padStart(2, '0')} / {String(totalChapters).padStart(2, '0')} · {CHAPTER_TAG[regionSlug] ?? regionLabel}
          </div>
          <div style={{ flex: 1, height: '0.5px', background: T.borderGold, opacity: 0.3 }} />
        </div>
      )}

      {/* Skeleton warnings — inline on mobile */}
      {warns.slice(0, 1).map(f => {
        const s = SEV[f.severity] ?? SEV.recommendation;
        return (
          <div key={f.id} style={{ margin: '0 0 12px', padding: '10px 14px', borderLeft: `2px solid \${s.color}`, background: s.bg, borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontSize: 10, color: s.color, fontWeight: 700, marginBottom: 2 }}>{s.icon} {f.title}</div>
            <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.55 }}>{f.traveller_message}</div>
          </div>
        );
      })}

      {/* Main carousel content — full width */}
      <div style={{ opacity: entered ? 1 : 0, transform: entered ? 'none' : 'translateY(12px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
        {children}
      </div>

      {/* KB bottom drawer — peeks up after scroll */}
      {hasMeta && (
        <>
          {/* Drawer backdrop */}
          {drawerOpen && (
            <div
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            />
          )}

          {/* Drawer */}
          <div style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            zIndex: 201,
            background: 'rgba(12,10,16,0.98)',
            border: `0.5px solid \${T.borderGold}`,
            borderBottom: 'none',
            borderRadius: '20px 20px 0 0',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
            transform: drawerOpen ? 'translateY(0)' : drawerPeeked ? 'translateY(calc(100% - 72px))' : 'translateY(100%)',
            transition: 'transform 0.38s cubic-bezier(0.22,1,0.36,1)',
            maxHeight: '72vh',
            display: 'flex', flexDirection: 'column' as const,
          }}>
            {/* Handle + header */}
            <div
              onClick={() => setDrawerOpen(v => !v)}
              style={{ flexShrink: 0, padding: '14px 20px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' as const, opacity: 0.75 }}>
                  ✦ {CHAPTER_TAG[regionSlug] ?? regionLabel} · {nights}n{month ? ` · \${month}` : ''}
                </div>
                {!drawerOpen && (
                  <div style={{ fontSize: 11, color: T.textMid, marginTop: 3, lineHeight: 1.4, overflow: 'hidden', maxHeight: 32, WebkitMaskImage: 'linear-gradient(to right, black 70%, transparent)' }}>
                    {kbHighlights[0] ?? seasonalNote ?? kbTips[0] ?? ''}
                  </div>
                )}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: `0.5px solid \${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: T.textDim, transform: drawerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', flexShrink: 0 }}>
                ↑
              </div>
            </div>

            {/* Handle pill */}
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 20px 20px', WebkitOverflowScrolling: 'touch' as unknown as undefined }}>
              {/* Seasonal note */}
              {seasonalNote && month && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(212,175,55,0.06)', border: `0.5px solid \${T.borderGold}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 5 }}>✦ {month} in {regionLabel}</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7, fontStyle: 'italic' }}>{seasonalNote}</div>
                </div>
              )}

              {/* KB highlights */}
              {kbHighlights.slice(0, 3).map((h, i) => (
                <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < Math.min(kbHighlights.length, 3) - 1 ? `0.5px solid \${T.border}` : 'none' }}>
                  <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 5 }}>✦ Did you know</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.72, fontStyle: 'italic' }}>{h}</div>
                </div>
              ))}

              {/* Specialist note */}
              {specialistNote && (
                <div style={{ marginBottom: 14, borderLeft: `2px solid rgba(212,175,55,0.4)`, paddingLeft: 12 }}>
                  <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>About this region</div>
                  <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.7 }}>{specialistNote}</div>
                </div>
              )}

              {/* KB tips */}
              {kbTips.slice(0, 3).map((tip, i) => (
                <div key={i} style={{ fontSize: 12, color: T.textMid, lineHeight: 1.65, padding: '6px 0', borderBottom: i < Math.min(kbTips.length, 3) - 1 ? `0.5px solid \${T.border}` : 'none' }}>
                  <span style={{ color: T.gold, marginRight: 6 }}>›</span>{tip}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inclusions strip (goes INTO the property tile via portal-style, but here we
//    export it so NestedPropertyCarousel can use it too) ─────────────────────
export function InclusionPills({ includes, malariaFree, compact=false }: {
  includes:string[]; malariaFree:boolean; compact?:boolean;
}) {
  const shown = includes.filter(k => k !== 'accommodation' && INCLUSION_LABELS[k]);
  const isRoomOnly = includes.length === 0 || (includes.length === 1 && includes[0] === 'accommodation');
  if (!shown.length && !malariaFree && !isRoomOnly) return null;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:compact?4:8 }}>
      {isRoomOnly && (
        <span style={{ fontSize:10, color:T.amber, background:'rgba(251,146,60,0.1)', border:'0.5px solid rgba(251,146,60,0.25)', borderRadius:20, padding:'2px 8px', fontWeight:600 }}>
          ⚑ Room only
        </span>
      )}
      {!isRoomOnly && shown.map(k => (
        <span key={k} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:10, color:T.green, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'3px 9px' }}>
          <IncIcon kind={INCLUSION_LABELS[k].icon} color={T.green} />{compact ? '' : INCLUSION_LABELS[k].label}
        </span>
      ))}
      {malariaFree && (
        <span style={{ fontSize:10, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'2px 8px', fontWeight:600 }}>
          ✦ Malaria-free
        </span>
      )}
    </div>
  );
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({ kbHighlights, skeletonFindings, chapterIndex, regionSlug }:{
  kbHighlights:string[]; skeletonFindings:SkeletonFinding[];
  chapterIndex:number; regionSlug:string;
}) {
  const { ref, vis } = useFade();
  const warns = skeletonFindings.filter(f => f.severity==='warning' || f.severity==='recommendation');
  // Stream each highlight text left-first (0ms delay)
  const streamed = useTypewriter(kbHighlights.slice(0,2), vis, 24, 0);

  if (!kbHighlights.length && !warns.length) return <div ref={ref} />;

  return (
    <div ref={ref} className="kb-col-left" style={{
      opacity: vis?1:0, transform: vis?'none':'translateY(18px)',
      transition:'opacity 0.6s ease, transform 0.6s ease',
      position:'sticky', top:20,
    }}>
      {/* Chapter eyebrow */}
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.4em', textTransform:'uppercase', color:T.gold, opacity:0.55, marginBottom:18 }}>
        {String(chapterIndex+1).padStart(2,'0')} — {CHAPTER_TAG[regionSlug] ?? ''}
      </div>

      {/* Skeleton warnings */}
      {warns.slice(0,2).map(f => {
        const s = SEV[f.severity]??SEV.recommendation;
        return (
          <div key={f.id} style={{ borderLeft:`2px solid ${s.color}`, paddingLeft:10, marginBottom:14 }}>
            <div style={{ fontSize:10, color:s.color, fontWeight:700, marginBottom:3 }}>{s.icon} {f.title}</div>
            <div style={{ fontSize:11, color:T.textMid, lineHeight:1.6 }}>{f.traveller_message}</div>
          </div>
        );
      })}

      {/* KB highlights — typewriter reveal, left-first */}
      {kbHighlights.slice(0,2).map((h,i) => (
        <div key={i} style={{
          marginBottom:14,
          paddingBottom:14,
          borderBottom: i < Math.min(kbHighlights.length,2)-1 ? `0.5px solid ${T.border}` : 'none',
          opacity: vis ? 1 : 0,
          transition: `opacity 0.5s ease ${i*0.2}s`,
        }}>
          <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:5 }}>
            ✦ Did you know
          </div>
          <div style={{ fontSize:12, color:T.textMid, lineHeight:1.72, fontStyle:'italic' }}>
            {streamed[i] ?? ''}
            {/* blinking cursor while streaming */}
            {vis && streamed[i] !== undefined && streamed[i].length < h.length && (
              <span style={{ display:'inline-block', width:1.5, height:'0.85em', background:T.gold, marginLeft:2, verticalAlign:'middle', animation:'kbCursor 0.85s step-end infinite' }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Right sidebar ─────────────────────────────────────────────────────────────

function RightSidebar({ seasonalNote, kbTips, nights, checkinDate, regionLabel, specialistNote }:{
  seasonalNote?:string; kbTips:string[]; nights:number;
  checkinDate?:string; regionLabel:string; specialistNote?:string;
}) {
  const { ref, vis } = useFade();
  const month = checkinDate ? new Date(checkinDate).toLocaleString('en',{month:'long'}) : null;
  // Right side streams 450ms after left (so left visibly starts first)
  const rightTexts = [seasonalNote, specialistNote, ...kbTips.slice(0,2)].filter(Boolean) as string[];
  const streamed = useTypewriter(rightTexts, vis, 24, 450);
  if (!seasonalNote && !kbTips.length && !specialistNote) return <div ref={ref} />;

  return (
    <div ref={ref} className="kb-col-right" style={{
      opacity: vis?1:0, transform: vis?'none':'translateY(18px)',
      transition:'opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s',
      position:'sticky', top:20,
    }}>
      {/* Seasonal context — typewriter reveal */}
      {seasonalNote && month && (() => {
        const s0 = streamed[0] ?? '';
        return (
          <div style={{ marginBottom:16, padding:'10px 12px', background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:9 }}>
            <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>✦ {month} in {regionLabel}</div>
            <div style={{ fontSize:12, color:T.textMid, lineHeight:1.7, fontStyle:'italic' }}>
              {s0}
              {vis && s0.length < seasonalNote.length && (
                <span style={{ display:'inline-block', width:1.5, height:'0.85em', background:T.gold, marginLeft:2, verticalAlign:'middle', animation:'kbCursor 0.85s step-end infinite' }} />
              )}
            </div>
          </div>
        );
      })()}

      {/* Specialist note */}
      {specialistNote && (() => {
        const sIdx = seasonalNote ? 1 : 0;
        const s = streamed[sIdx] ?? '';
        return (
          <div style={{ marginBottom:16, borderLeft:`2px solid rgba(212,175,55,0.4)`, paddingLeft:10 }}>
            <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>About this region</div>
            <div style={{ fontSize:11, color:T.textMid, lineHeight:1.7 }}>
              {s}
              {vis && s.length < specialistNote.length && (
                <span style={{ display:'inline-block', width:1.5, height:'0.85em', background:T.gold, marginLeft:2, verticalAlign:'middle', animation:'kbCursor 0.85s step-end infinite' }} />
              )}
            </div>
          </div>
        );
      })()}

      {/* KB tips — typewriter */}
      {kbTips.slice(0,2).map((tip,i) => {
        const offset = (seasonalNote ? 1 : 0) + (specialistNote ? 1 : 0);
        const s = streamed[offset + i] ?? '';
        return (
          <div key={i} style={{
            fontSize:11, color:T.textMid, lineHeight:1.68,
            padding:'5px 0',
            borderBottom: i < Math.min(kbTips.length,2)-1 ? `0.5px solid ${T.border}` : 'none',
            opacity: vis ? 1 : 0,
            transition: `opacity 0.5s ease ${0.3 + i*0.15}s`,
          }}>
            <span style={{ color:T.gold, marginRight:5 }}>›</span>
            {s}
            {vis && s.length < tip.length && (
              <span style={{ display:'inline-block', width:1.5, height:'0.85em', background:T.gold, marginLeft:2, verticalAlign:'middle', animation:'kbCursor 0.85s step-end infinite' }} />
            )}
          </div>
        );
      })}

      {/* Nights context */}
      <div style={{ marginTop:16, fontSize:10, color:T.textDim, letterSpacing:'0.06em' }}>
        {nights} night{nights!==1?'s':''} · {regionLabel}
      </div>
    </div>
  );
}

// ── Main RegionChapter ────────────────────────────────────────────────────────

export default function RegionChapter(props: RegionChapterProps) {
  const isMobile = useMobile();
  if (isMobile) return <MobileRegionChapter {...props} />;

  const {
    chapterIndex, totalChapters, regionSlug, regionLabel, countryLabel,
    nights, checkinDate, bgImageUrl, kbHighlights, kbTips, skeletonFindings,
    selectedHotelName, selectedHotelIncludes, malariaFree,
    seasonalNote, specialistNote, children,
  } = props;

  const ref = useRef(null as HTMLDivElement | null);
  const [entered, setEntered] = useState(false);
  const bg = bgImageUrl ?? REGION_BG[regionSlug] ?? '';
  const hasSidebars = kbHighlights.length > 0 || kbTips.length > 0 ||
    skeletonFindings.length > 0 || !!seasonalNote || !!specialistNote;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver==='undefined') { setEntered(true); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setEntered(true);
        onRegionVisible?.(regionSlug);
      }
    }, {threshold:0.08, rootMargin:'-20% 0px -20% 0px'});
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position:'relative', marginBottom:0 }}>

      {/* Background handled by fixed layer in page.tsx — no per-chapter bg */}

      {/* ── Chapter divider — prominent between regions ── */}
      {chapterIndex > 0 && (
        <div style={{
          position:'relative', zIndex:1,
          paddingTop:40, marginBottom:28,
        }}>
          {/* Thick gold rule */}
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ height:'1px', flex:1, background:`linear-gradient(to right, transparent, ${T.gold}55, ${T.gold}88, ${T.gold}55, transparent)` }} />
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
              <div style={{ width:6, height:6, background:T.gold, transform:'rotate(45deg)', opacity:0.8 }} />
              <div style={{ fontSize:9, letterSpacing:'0.5em', textTransform:'uppercase', color:T.gold, opacity:0.7, whiteSpace:'nowrap' }}>
                {String(chapterIndex+1).padStart(2,'0')} / {String(totalChapters).padStart(2,'0')} &nbsp;·&nbsp; {CHAPTER_TAG[regionSlug] ?? regionLabel} &nbsp;·&nbsp; {countryLabel}
              </div>
              <div style={{ width:6, height:6, background:T.gold, transform:'rotate(45deg)', opacity:0.8 }} />
            </div>
            <div style={{ height:'1px', flex:1, background:`linear-gradient(to left, transparent, ${T.gold}55, ${T.gold}88, ${T.gold}55, transparent)` }} />
          </div>
        </div>
      )}

      {/* First chapter - subtle top label */}
      {chapterIndex === 0 && (
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ fontSize:9, letterSpacing:'0.4em', textTransform:'uppercase', color:T.gold, opacity:0.5, flexShrink:0 }}>
            {String(chapterIndex+1).padStart(2,'0')} / {String(totalChapters).padStart(2,'0')} &nbsp;·&nbsp; {CHAPTER_TAG[regionSlug] ?? regionLabel}
          </div>
          <div style={{ flex:1, height:'0.5px', background:T.borderGold, opacity:0.3 }} />
        </div>
      )}

      {/* Three-column grid */}
      <div style={{
        position:'relative', zIndex:1,
        display:'grid',
        gridTemplateColumns: hasSidebars ? '172px minmax(0,1fr) 172px' : '1fr',
        gap:'0 24px',
        alignItems:'start',
        paddingBottom:8,
      }}>
        {hasSidebars && (
          <LeftSidebar
            kbHighlights={kbHighlights}
            skeletonFindings={skeletonFindings}
            chapterIndex={chapterIndex}
            regionSlug={regionSlug}
          />
        )}

        {/* Center — carousels passed as children, completely untouched */}
        <div>{children}</div>

        {hasSidebars && (
          <RightSidebar
            seasonalNote={seasonalNote}
            specialistNote={specialistNote}
            kbTips={kbTips}
            nights={nights}
            checkinDate={checkinDate}
            regionLabel={regionLabel}
          />
        )}
      </div>
    </div>
  );
}

// ── PropertyMiniSite ──────────────────────────────────────────────────────────
// Slide-up sheet. Sticky bar stays visible (paddingBottom:120).
// Room types from room_types Supabase table.
// KB content: traveller-safe highlights + tips only.


// PropertyMiniSite extracted to its own file to avoid SWC TSX parsing issues
export { PropertyMiniSite } from './PropertyMiniSite';
export type { PropertyMiniSiteProps } from './PropertyMiniSite';
