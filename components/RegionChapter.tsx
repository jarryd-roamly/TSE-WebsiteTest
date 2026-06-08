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
  const ref = useRef<HTMLDivElement>(null);
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
  const [displayed, setDisplayed] = useState<string[]>(texts.map(() => ''));
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
  const ref = useRef<HTMLDivElement>(null);
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

  const ref = useRef<HTMLDivElement>(null);
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

export interface PropertyMiniSiteProps {
  hotel:        any;
  supplierId?:  string;
  kbEntries:    any[];
  includes:     string[];
  onClose:      () => void;
  onSelectRoom?: (extra:number, label:string) => void;
}

export function PropertyMiniSite({ hotel, supplierId, kbEntries, includes, onClose, onSelectRoom }: PropertyMiniSiteProps) {
  const [rooms, setRooms]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeImg, setActiveImg]   = useState(0);
  const [addons, setAddons]         = useState<any[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [factsheetOpen, setFactsheetOpen] = useState(false);
  const [reelPlaying, setReelPlaying]     = useState(false);

  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  useEffect(() => {
    const id = supplierId ?? hotel?.supplier_id ?? hotel?.id;
    if (!id || !SB_URL) { setLoading(false); return; }
    fetch(`${SB_URL}/rest/v1/room_types?supplier_id=eq.${id}&select=id,name,net_rate_zar,category,max_occupancy,bed_type,view,meal_basis,description,images,keywords&is_active=eq.true&order=name.asc`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows:any[]) => {
        if (rows?.length > 0) {
          const baseRate = hotel?.displayRate || hotel?.netRate || 0;
          const upgradesList = hotel?.upgrades?.rooms ?? [];
        setRooms(rows.map((r,rowIdx) => {
            const cat = (r.category||'').toLowerCase();
            // Use actual net_rate_zar from room_types table, or hotel.upgrades extra
            const roomNetRate = r.net_rate_zar && r.net_rate_zar > 0 ? r.net_rate_zar : 0;
            const upgradeEntry = upgradesList[rowIdx];
            const extra = roomNetRate > 0
              ? Math.max(0, roomNetRate - baseRate)
              : upgradeEntry?.extra !== undefined
              ? upgradeEntry.extra
              : (cat==='premium' ? Math.round(baseRate*0.20)
                : (cat==='villa'||cat==='exclusive-use') ? Math.round(baseRate*0.45) : 0);
            const imgs = (() => { try {
              const arr = Array.isArray(r.images) ? r.images : (r.images ? JSON.parse(r.images) : []);
              return arr.map((img:any)=>typeof img==='string'?img:img?.url).filter(Boolean);
            } catch { return []; }})();
            return { id:r.id, name:r.name, description:r.description, max_guests:r.max_occupancy,
              bed_type:r.bed_type, view:r.view, meal_basis:r.meal_basis, category:r.category,
              images:imgs, extra_zar:extra };
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [supplierId, hotel?.id]);

  // Fetch property add-ons (spa, experiences, private vehicle)
  useEffect(() => {
    const id = supplierId ?? hotel?.supplier_id ?? hotel?.id;
    if (!id || !SB_URL) return;
    fetch(`${SB_URL}/rest/v1/property_addons?supplier_id=eq.${id}&is_active=eq.true&select=id,name,category,description,price_per_person_zar,price_type,duration_minutes,notes&order=category.asc,name.asc`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    }).then(r => r.ok ? r.json() : []).then(setAddons).catch(() => {});
  }, [supplierId, hotel?.id]);

  // Traveller-safe KB only
  const propKB = kbEntries.filter((e:any) =>
    (e.status==='active'||e.active===true) &&
    (e.entry_type==='property'||e.type==='property') &&
    e.claim_type !== 'commercial' && !e.internal_only &&
    ((e.linked_name??e.linkedTo??'')).toLowerCase().includes((hotel?.name??'').toLowerCase())
  );
  const highlights = propKB.flatMap((e:any) => e.highlights ?? []);
  const tips       = propKB.flatMap((e:any) => e.tips ?? []);
  const cur = rooms[activeRoom];
  const isRoomOnly = includes.length === 0 || (includes.length===1 && includes[0]==='accommodation');

  return (
    <div style={{ position:'fixed', inset:0, zIndex:450, background:'rgba(0,0,0,0.82)',
      backdropFilter:'blur(10px)', display:'flex', alignItems:'flex-end', justifyContent:'center',
      paddingBottom:80,
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{ width:'100%', maxWidth:680, height:'calc(88vh - 80px)',
        background:'#0f0f0f', border:`0.5px solid ${T.borderGold}`,
        borderRadius:'20px 20px 0 0', overflow:'hidden',
        display:'flex', flexDirection:'column', animation:'slideUp 0.32s ease',
      }}>
        {/* Header */}
        <div style={{ flexShrink:0, padding:'14px 20px 0', borderBottom:`0.5px solid ${T.border}` }}>
          {/* Name row */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9, color:T.gold, textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:700, marginBottom:2 }}>✦ Property detail</div>
              <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.15 }}>{hotel?.name}</div>
              <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{hotel?.destination} · ★ {hotel?.trustScore}/100{hotel?.malariaFree?' · ✦ Malaria-free':''}</div>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:`0.5px solid ${T.border}`, color:T.textMid, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:16, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
          </div>

          {/* Social links + Factsheet button */}
          <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:10 }}>
            {/* Instagram */}
            {hotel?.instagram_url && (
              <a href={hotel.instagram_url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.textMid, textDecoration:'none', fontSize:13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
              </a>
            )}
            {/* Facebook */}
            {hotel?.facebook_url && (
              <a href={hotel.facebook_url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.textMid, textDecoration:'none', fontSize:13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
            )}
            {/* YouTube */}
            {hotel?.youtube_url && (
              <a href={hotel.youtube_url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:8, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, color:T.textMid, textDecoration:'none', fontSize:13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0f0f0f"/></svg>
              </a>
            )}
            {/* If no social provided, show generic website link */}
            {!hotel?.instagram_url && !hotel?.facebook_url && !hotel?.youtube_url && (
              <div style={{ fontSize:10, color:T.textDim, fontStyle:'italic' }}>Social links — ask your specialist</div>
            )}

            {/* Spacer */}
            <div style={{ flex:1 }} />

            {/* Factsheet button */}
            <button
              onClick={() => setFactsheetOpen(true)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, color:T.gold, fontSize:11, fontWeight:600, cursor:'pointer', letterSpacing:'0.04em', fontFamily:'inherit' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Factsheet
            </button>
          </div>
        </div>

        {/* Hero */}
        <div style={{ flexShrink:0, height:170, position:'relative', overflow:'hidden' }}>
          <img src={hotel?.image} alt={hotel?.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 55%)' }} />
          {hotel?.funFact && <div style={{ position:'absolute', bottom:10, left:16, right:16, fontSize:12, color:'rgba(255,255,255,0.85)', fontStyle:'italic', lineHeight:1.5 }}>"{hotel.funFact}"</div>}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 24px' }}>

          {/* Inclusions */}
          {includes.length > 0 && (
            <div style={{ marginBottom:16, padding:'9px 12px',
              background:isRoomOnly?'rgba(251,146,60,0.06)':'rgba(74,222,128,0.05)',
              border:`0.5px solid ${isRoomOnly?'rgba(251,146,60,0.2)':'rgba(74,222,128,0.15)'}`,
              borderRadius:9 }}>
              <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:5 }}>What's included</div>
              <InclusionPills includes={includes} malariaFree={hotel?.malariaFree??false} />
            </div>
          )}

          {/* Room types */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>Room types</div>
            {loading ? (
              <div style={{ fontSize:12, color:T.textDim, display:'flex', alignItems:'center', gap:8 }}>
                <div className="spinner" style={{ width:14, height:14 }} /> Loading room types…
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ fontSize:12, color:T.textDim, fontStyle:'italic' }}>Your specialist will confirm room types and availability.</div>
            ) : (
              <>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                  {rooms.map((r,i)=>(
                    <button key={r.id} onClick={()=>{setActiveRoom(i);setActiveImg(0);}} style={{
                      padding:'5px 12px', borderRadius:20, fontFamily:'inherit', cursor:'pointer',
                      border:`1.5px solid ${i===activeRoom?T.gold:T.border}`,
                      background:i===activeRoom?T.goldDim:'transparent',
                      color:i===activeRoom?T.gold:T.textMid,
                      fontSize:11, fontWeight:i===activeRoom?600:400,
                    }}>{r.name}</button>
                  ))}
                </div>
                {cur && (
                  <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:11, overflow:'hidden' }}>
                    {cur.images.length > 0 && (
                      <div style={{ position:'relative', height:160 }}>
                        <img src={cur.images[activeImg]} alt={cur.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        {cur.images.length > 1 && <>
                          {activeImg>0 && <button onClick={()=>setActiveImg(i=>i-1)} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>}
                          {activeImg<cur.images.length-1 && <button onClick={()=>setActiveImg(i=>i+1)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>}
                        </>}
                      </div>
                    )}
                    <div style={{ padding:'12px 14px' }}>
                      <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", marginBottom:4 }}>{cur.name}</div>
                      {/* Meal basis badge */}
                      <div style={{ marginBottom:6 }}>
                        {cur.meal_basis==='FI'
                          ? <span style={{ fontSize:10, color:T.green, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:20, padding:'2px 9px', fontWeight:600 }}>✓ Fully inclusive</span>
                          : cur.meal_basis==='BB'
                          ? <span style={{ fontSize:10, color:T.amber, background:'rgba(251,146,60,0.08)', border:'0.5px solid rgba(251,146,60,0.3)', borderRadius:20, padding:'2px 9px', fontWeight:600 }}>Breakfast included</span>
                          : null
                        }
                      </div>
                      {cur.description && <div style={{ fontSize:12, color:T.textMid, lineHeight:1.65, marginBottom:8 }}>{cur.description}</div>}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: onSelectRoom?10:0 }}>
                        {cur.max_guests && <span style={{ fontSize:10, color:T.textDim }}>👥 {cur.max_guests} max</span>}
                        {cur.bed_type   && <span style={{ fontSize:10, color:T.textDim }}>{cur.bed_type}</span>}
                        {cur.view       && <span style={{ fontSize:10, color:T.textDim }}>{cur.view}</span>}
                      </div>
                      {/* Room selection now handled by confirm button below */}
                      {cur.extra_zar > 0 && (
                        <div style={{ fontSize:10, color:T.gold, background:T.goldDim, borderRadius:6, padding:'3px 10px', display:'inline-block' }}>
                          +R {cur.extra_zar.toLocaleString()}/night supplement
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* KB highlights */}
          {highlights.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:8 }}>Why this property</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {highlights.map((h:string,i:number)=>(
                  <span key={i} style={{ fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:6, padding:'3px 9px' }}>{h}</span>
                ))}
              </div>
            </div>
          )}

          {tips.length > 0 && (
            <div>
              <div style={{ fontSize:10, color:T.blue, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:8 }}>Tips</div>
              {tips.map((tip:string,i:number)=>(
                <div key={i} style={{ fontSize:12, color:T.textMid, lineHeight:1.65, padding:'5px 0', borderBottom:i<tips.length-1?`0.5px solid ${T.border}`:'none' }}>
                  <span style={{ color:T.blue, marginRight:5 }}>›</span>{tip}
                </div>
              ))}
            </div>
          )}

          {!highlights.length && !tips.length && !loading && (
            <div style={{ fontSize:12, color:T.textDim, fontStyle:'italic' }}>Your specialist will brief you on this property before travel.</div>
          )}

          {/* ── Property add-ons: spa, experiences, private vehicle ── */}
          {addons.length > 0 && (() => {
            const cats: Record<string,any[]> = {};
            addons.forEach(a => { cats[a.category] = cats[a.category] ?? []; cats[a.category].push(a); });
            const catLabels: Record<string,string> = {
              spa:'✦ Spa & Wellness', experience:'✦ Experiences', dining:'✦ Private Dining', vehicle:'✦ Private Vehicle',
            };
            return (
              <div style={{ marginTop:20 }}>
                <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>Add to your stay</div>
                {Object.entries(cats).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:7 }}>{catLabels[cat] ?? cat}</div>
                    {items.map((a:any) => {
                      const isSel = selectedAddons.has(a.id);
                      const priceLabel = a.price_type==='flat'
                        ? `R ${a.price_per_person_zar.toLocaleString()} flat`
                        : a.price_type==='per_couple'
                        ? `R ${a.price_per_person_zar.toLocaleString()} / couple`
                        : `R ${a.price_per_person_zar.toLocaleString()} / person`;
                      return (
                        <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 12px', background:isSel?T.goldDim:'rgba(255,255,255,0.03)', border:`0.5px solid ${isSel?T.borderGold:T.border}`, borderRadius:9, marginBottom:6, transition:'all 0.15s' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'baseline', gap:7, flexWrap:'wrap' }}>
                              <span style={{ fontSize:12, fontWeight:600, color:isSel?T.gold:T.text }}>{a.name}</span>
                              {a.duration_minutes && <span style={{ fontSize:10, color:T.textDim }}>{a.duration_minutes} min</span>}
                            </div>
                            <div style={{ fontSize:11, color:T.textMid, lineHeight:1.6, marginTop:2 }}>{a.description}</div>
                            {a.notes && <div style={{ fontSize:10, color:T.textDim, marginTop:3, fontStyle:'italic' }}>{a.notes}</div>}
                          </div>
                          <div style={{ flexShrink:0, textAlign:'right' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:isSel?T.gold:T.textMid, marginBottom:4 }}>{priceLabel}</div>
                            <button
                              onClick={() => setSelectedAddons(prev => {
                                const next = new Set(prev);
                                if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                                return next;
                              })}
                              style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${isSel?T.gold:T.border}`, background:isSel?T.goldDim:'transparent', color:isSel?T.gold:T.textMid, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                              {isSel ? '✓ Added' : '+ Add'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Confirm button with add-ons summary ── */}
        {onSelectRoom && cur && (
          <div style={{ flexShrink:0, padding:'12px 20px', borderTop:`0.5px solid ${T.border}`, background:'#0f0f0f' }}>
            {selectedAddons.size > 0 && (
              <div style={{ fontSize:10, color:T.gold, marginBottom:8, fontStyle:'italic' }}>
                + {selectedAddons.size} add-on{selectedAddons.size>1?'s':''} selected — your specialist will confirm availability
              </div>
            )}
            <button onClick={() => {
              const addonNotes = addons.filter((a:any) => selectedAddons.has(a.id)).map((a:any) => a.name).join(', ');
              onSelectRoom(cur.extra_zar, cur.name + (addonNotes ? ` · ${addonNotes}` : ''));
              onClose();
            }} style={{ width:'100%', padding:'11px 0', borderRadius:8, border:`1.5px solid ${T.gold}`, background:T.goldDim, color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>
              Confirm {cur.name}{cur.extra_zar>0?' — upgrade applied':' — included'} →
            </button>
          </div>
        )}
      </div>

      {/* ── Factsheet modal ── */}
      {factsheetOpen && (() => {
        const propHighlights = propKB.flatMap((e:any) => e.highlights ?? []);
        const propTips       = propKB.flatMap((e:any) => e.tips ?? []);
        const propNotes      = propKB.flatMap((e:any) => e.specialist_notes ? [e.specialist_notes] : []);
        // Build well-worded factsheet prose from KB data
        const sections: Array<{title:string; body:string}> = [];

        if (propHighlights.length > 0) {
          sections.push({
            title: 'About this Property',
            body: propHighlights.join(' ') || `${hotel?.name} is one of the most celebrated properties in ${hotel?.destination}. Known for its exceptional service, wildlife access, and sense of place, it has earned a trust score of ${hotel?.trustScore}/100 among specialists.`,
          });
        }

        if (propTips.length > 0) {
          sections.push({
            title: 'Specialist Recommendations',
            body: propTips.map((t:string, i:number) => `${i+1}. ${t}`).join('
'),
          });
        }

        sections.push({
          title: 'Inclusions & Rate Basis',
          body: includes.length > 0
            ? `Your rate at ${hotel?.name} includes: ${includes.filter((k:string) => k !== 'accommodation').map((k:string) => k.replace(/_/g,' ')).join(', ')}.${hotel?.malariaFree ? ' This property is in a malaria-free zone — no prophylactics required.' : ' Note: this destination is in a malaria zone. Consult your doctor before travel.'}`
            : `Room-only rate. All meals and activities charged separately. Your specialist will confirm current pricing.`,
        });

        if (rooms.length > 0) {
          sections.push({
            title: 'Room Categories',
            body: rooms.map(r => `${r.name}${r.extra_zar > 0 ? ` (+R ${r.extra_zar.toLocaleString()}/night supplement)` : ''}: ${r.description || 'Details available from your specialist.'}`).join('

'),
          });
        }

        sections.push({
          title: 'Location & Access',
          body: `${hotel?.name} is located in ${hotel?.destination}. Access is typically by light aircraft to the nearest airstrip, followed by a short road transfer. Your Journey Specialist will confirm exact routing based on your travel dates and origin.`,
        });

        return (
          <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={e => { if (e.target===e.currentTarget) setFactsheetOpen(false); }}>
            <div style={{ width:'100%', maxWidth:560, maxHeight:'85vh', background:'#0f0f0f', border:`0.5px solid ${T.borderGold}`, borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              {/* Factsheet header */}
              <div style={{ flexShrink:0, padding:'16px 20px', borderBottom:`0.5px solid ${T.border}`, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:T.gold, textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:700, marginBottom:2 }}>✦ Property Factsheet</div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif" }}>{hotel?.name}</div>
                </div>
                <button onClick={() => setFactsheetOpen(false)} style={{ background:'rgba(255,255,255,0.07)', border:`0.5px solid ${T.border}`, color:T.textMid, width:30, height:30, borderRadius:'50%', cursor:'pointer', fontSize:16, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
              {/* Factsheet content */}
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 24px' }}>
                {sections.map((s,i) => (
                  <div key={i} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:10, color:T.gold, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8, paddingBottom:5, borderBottom:`0.5px solid ${T.borderGold}` }}>{s.title}</div>
                    <div style={{ fontSize:12, color:T.textMid, lineHeight:1.78, whiteSpace:'pre-line' }}>{s.body}</div>
                  </div>
                ))}
                <div style={{ marginTop:24, padding:'10px 14px', background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:8, fontSize:11, color:T.textMid, lineHeight:1.65 }}>
                  <strong style={{ color:T.gold, display:'block', marginBottom:4 }}>✦ Note from your Journey Specialist</strong>
                  This factsheet is compiled from our Knowledge Base. Your specialist will provide a fully personalised briefing document before travel with current rates, availability, and any operational notes specific to your dates.
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
