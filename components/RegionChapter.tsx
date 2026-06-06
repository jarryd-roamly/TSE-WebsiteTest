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
  all_meals:      {icon:'🍽',label:'All meals'},
  game_drives:    {icon:'🐘',label:'Game drives'},
  mokoro:         {icon:'🛶',label:'Mokoro'},
  local_drinks:   {icon:'🍷',label:'Local drinks'},
  premium_drinks: {icon:'🥂',label:'Premium drinks'},
  laundry:        {icon:'👕',label:'Laundry'},
  park_fees:      {icon:'🌿',label:'Park fees'},
};

const SEV: Record<string,{color:string;bg:string;icon:string}> = {
  block:          {color:T.red,   bg:'rgba(248,113,113,0.08)',icon:'⚠'},
  warning:        {color:T.amber, bg:'rgba(251,146,60,0.07)', icon:'◈'},
  recommendation: {color:T.blue,  bg:'rgba(96,165,250,0.07)', icon:'›'},
  confirmed:      {color:T.green, bg:'rgba(74,222,128,0.07)', icon:'✓'},
};

// ── Fade-on-scroll hook ───────────────────────────────────────────────────────

function useFade(threshold=0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVis(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.intersectionRatio >= threshold) setVis(true); },
      { threshold:[0, threshold, 0.4] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

// ── Mobile hook ──────────────────────────────────────────────────────────────

function useMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);
  return m;
}

// ── Mobile CSS ────────────────────────────────────────────────────────────────

const MOBILE_BCC_CSS = `
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
            <div style={{ flex: 1, height: '1px', background: \`linear-gradient(to right, transparent, \${T.gold}55, \${T.gold}88, \${T.gold}55, transparent)\` }} />
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <div style={{ width: 5, height: 5, background: T.gold, transform: 'rotate(45deg)', opacity: 0.8 }} />
              <div style={{ fontSize: 8, letterSpacing: '0.45em', textTransform: 'uppercase' as const, color: T.gold, opacity: 0.7, whiteSpace: 'nowrap' as const }}>
                {String(chapterIndex + 1).padStart(2, '0')} / {String(totalChapters).padStart(2, '0')} &nbsp;·&nbsp; {CHAPTER_TAG[regionSlug] ?? regionLabel} &nbsp;·&nbsp; {countryLabel}
              </div>
              <div style={{ width: 5, height: 5, background: T.gold, transform: 'rotate(45deg)', opacity: 0.8 }} />
            </div>
            <div style={{ flex: 1, height: '1px', background: \`linear-gradient(to left, transparent, \${T.gold}55, \${T.gold}88, \${T.gold}55, transparent)\` }} />
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
          <div key={f.id} style={{ margin: '0 0 12px', padding: '10px 14px', borderLeft: \`2px solid \${s.color}\`, background: s.bg, borderRadius: '0 8px 8px 0' }}>
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
            border: \`0.5px solid \${T.borderGold}\`,
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
                  ✦ {CHAPTER_TAG[regionSlug] ?? regionLabel} · {nights}n{month ? \` · \${month}\` : ''}
                </div>
                {!drawerOpen && (
                  <div style={{ fontSize: 11, color: T.textMid, marginTop: 3, lineHeight: 1.4, overflow: 'hidden', maxHeight: 32, WebkitMaskImage: 'linear-gradient(to right, black 70%, transparent)' }}>
                    {kbHighlights[0] ?? seasonalNote ?? kbTips[0] ?? ''}
                  </div>
                )}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: \`0.5px solid \${T.border}\`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: T.textDim, transform: drawerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', flexShrink: 0 }}>
                ↑
              </div>
            </div>

            {/* Handle pill */}
            <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 32, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }} />

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: '0 20px 20px', WebkitOverflowScrolling: 'touch' as unknown as undefined }}>
              {/* Seasonal note */}
              {seasonalNote && month && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(212,175,55,0.06)', border: \`0.5px solid \${T.borderGold}\`, borderRadius: 10 }}>
                  <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 5 }}>✦ {month} in {regionLabel}</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7, fontStyle: 'italic' }}>{seasonalNote}</div>
                </div>
              )}

              {/* KB highlights */}
              {kbHighlights.slice(0, 3).map((h, i) => (
                <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < Math.min(kbHighlights.length, 3) - 1 ? \`0.5px solid \${T.border}\` : 'none' }}>
                  <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 5 }}>✦ Did you know</div>
                  <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.72, fontStyle: 'italic' }}>{h}</div>
                </div>
              ))}

              {/* Specialist note */}
              {specialistNote && (
                <div style={{ marginBottom: 14, borderLeft: \`2px solid rgba(212,175,55,0.4)\`, paddingLeft: 12 }}>
                  <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>About this region</div>
                  <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.7 }}>{specialistNote}</div>
                </div>
              )}

              {/* KB tips */}
              {kbTips.slice(0, 3).map((tip, i) => (
                <div key={i} style={{ fontSize: 12, color: T.textMid, lineHeight: 1.65, padding: '6px 0', borderBottom: i < Math.min(kbTips.length, 3) - 1 ? \`0.5px solid \${T.border}\` : 'none' }}>
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

// ── Inclusions strip
 (goes INTO the property tile via portal-style, but here we
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
        <span key={k} style={{ fontSize:10, color:T.green, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'2px 8px' }}>
          {INCLUSION_LABELS[k].icon} {compact ? '' : INCLUSION_LABELS[k].label}
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

  if (!kbHighlights.length && !warns.length) return <div ref={ref} />;

  return (
    <div ref={ref} style={{
      opacity: vis?1:0, transform: vis?'none':'translateY(18px)',
      transition:'opacity 0.7s ease, transform 0.7s ease',
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

      {/* KB highlights — "Did you know" */}
      {kbHighlights.slice(0,2).map((h,i) => (
        <div key={i} style={{
          marginBottom:14,
          paddingBottom:14,
          borderBottom: i < Math.min(kbHighlights.length,2)-1 ? `0.5px solid ${T.border}` : 'none',
          opacity: vis ? 1 : 0,
          transform: vis ? 'none' : 'translateY(12px)',
          transition: `opacity 0.7s ease ${0.15 + i*0.18}s, transform 0.7s ease ${0.15 + i*0.18}s`,
        }}>
          <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:5 }}>
            ✦ Did you know
          </div>
          <div style={{ fontSize:12, color:T.textMid, lineHeight:1.72, fontStyle:'italic' }}>{h}</div>
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
  if (!seasonalNote && !kbTips.length && !specialistNote) return <div ref={ref} />;

  return (
    <div ref={ref} style={{
      opacity: vis?1:0, transform: vis?'none':'translateY(18px)',
      transition:'opacity 0.7s ease 0.12s, transform 0.7s ease 0.12s',
      position:'sticky', top:20,
    }}>
      {/* Seasonal context */}
      {seasonalNote && month && (
        <div style={{ marginBottom:16, padding:'10px 12px', background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:9 }}>
          <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>✦ {month} in {regionLabel}</div>
          <div style={{ fontSize:12, color:T.textMid, lineHeight:1.7, fontStyle:'italic' }}>{seasonalNote}</div>
        </div>
      )}

      {/* Traveller-safe specialist context (NOT ops notes) */}
      {specialistNote && (
        <div style={{ marginBottom:16, borderLeft:`2px solid rgba(212,175,55,0.4)`, paddingLeft:10 }}>
          <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>About this region</div>
          <div style={{ fontSize:11, color:T.textMid, lineHeight:1.7 }}>{specialistNote}</div>
        </div>
      )}

      {/* KB tips */}
      {kbTips.slice(0,2).map((tip,i) => (
        <div key={i} style={{
          fontSize:11, color:T.textMid, lineHeight:1.68,
          padding:'5px 0',
          borderBottom: i < Math.min(kbTips.length,2)-1 ? `0.5px solid ${T.border}` : 'none',
          opacity: vis ? 1 : 0,
          transform: vis ? 'none' : 'translateX(8px)',
          transition: `opacity 0.65s ease ${0.2 + i*0.18}s, transform 0.65s ease ${0.2 + i*0.18}s`,
        }}>
          <span style={{ color:T.gold, marginRight:5 }}>›</span>{tip}
        </div>
      ))}

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
  const [rooms, setRooms]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeImg, setActiveImg]   = useState(0);

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
          setRooms(rows.map(r => {
            const cat = (r.category||'').toLowerCase();
            const extra = cat==='premium' ? Math.round(baseRate*0.20)
              : (cat==='villa'||cat==='exclusive-use') ? Math.round(baseRate*0.45) : 0;
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
        <div style={{ flexShrink:0, padding:'14px 20px 12px', borderBottom:`0.5px solid ${T.border}`,
          display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, color:T.gold, textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:700, marginBottom:2 }}>✦ Property detail</div>
            <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.15 }}>{hotel?.name}</div>
            <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>{hotel?.destination} · ★ {hotel?.trustScore}/100{hotel?.malariaFree?' · ✦ Malaria-free':''}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:`0.5px solid ${T.border}`, color:T.textMid, width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:16, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
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
                      {onSelectRoom && (
                        <button onClick={()=>{onSelectRoom(cur.extra_zar,cur.name);onClose();}} style={{
                          width:'100%', padding:'10px 0', borderRadius:8,
                          border:`1.5px solid ${T.gold}`, background:T.goldDim,
                          color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700,
                        }}>
                          Select {cur.name}{cur.extra_zar>0?' →':' — included'}
                        </button>
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
        </div>
      </div>
    </div>
  );
}
