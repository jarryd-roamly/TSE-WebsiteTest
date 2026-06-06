'use client';

// components/RegionChapter.tsx  v2
// Full-width chapter layout wrapping existing carousels.
// Carousels are UNTOUCHED — passed as children.
// Left/right sidebars fade in on scroll via IntersectionObserver.
// Background image at 8% opacity changes per region.

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { T } from '@/app/lib/theme';

export interface SkeletonFinding {
  id: string; category: string;
  severity: 'block'|'warning'|'recommendation'|'confirmed';
  title: string; traveller_message: string;
  kb_entry_id?: string; traveller_flagged: boolean;
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
  kbHighlights:         string[];
  kbTips:               string[];
  skeletonFindings:     SkeletonFinding[];
  selectedHotelName?:   string;
  selectedHotelIncludes:string[];
  malariaFree:          boolean;
  seasonalNote?:        string;
  specialistNote?:      string;
  children:             ReactNode;
}

const REGION_BG: Record<string,string> = {
  'kruger-sabi-sand':'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1600&q=50',
  'okavango-delta':  'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1600&q=50',
  'cape-town':       'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1600&q=50',
  'madikwe':         'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1600&q=50',
  'chobe-vic-falls': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=50',
  'masai-mara':      'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=1600&q=50',
};

const CHAPTER_SUBTITLE: Record<string,string> = {
  'kruger-sabi-sand':'The Bush','okavango-delta':'The Delta',
  'cape-town':'The Cape','madikwe':'The Reserve',
  'chobe-vic-falls':'The Falls','masai-mara':'The Mara',
};

const SEVERITY_STYLE: Record<string,{color:string;bg:string;icon:string}> = {
  block:          {color:T.red,   bg:'rgba(248,113,113,0.08)', icon:'⚠'},
  warning:        {color:T.amber, bg:'rgba(251,146,60,0.07)',  icon:'◈'},
  recommendation: {color:T.blue,  bg:'rgba(96,165,250,0.07)',  icon:'✦'},
  confirmed:      {color:T.green, bg:'rgba(74,222,128,0.07)',  icon:'✓'},
};

const INCLUSION_LABELS: Record<string,string> = {
  accommodation:'Accommodation', all_meals:'All meals',
  game_drives:'Game drives', mokoro:'Mokoro',
  local_drinks:'Local drinks', premium_drinks:'Premium drinks',
  laundry:'Laundry', park_fees:'Park fees',
};

function useFade(threshold=0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVis(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.intersectionRatio > threshold) setVis(true); },
      { threshold:[0,threshold,0.5] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

function LeftSidebar({ kbHighlights, skeletonFindings, chapterIndex, regionLabel }:{
  kbHighlights:string[]; skeletonFindings:SkeletonFinding[];
  chapterIndex:number; regionLabel:string;
}) {
  const { ref, vis } = useFade(0.08);
  const findings = skeletonFindings.filter(f => f.severity === 'warning' || f.severity === 'recommendation');
  const hasContent = kbHighlights.length > 0 || findings.length > 0;
  if (!hasContent) return <div ref={ref} />;

  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(20px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
      position: 'sticky', top: 20,
    }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.4em', textTransform:'uppercase', color:T.gold, opacity:0.6, marginBottom:16 }}>
        {String(chapterIndex+1).padStart(2,'0')} — {CHAPTER_SUBTITLE[regionLabel] ?? regionLabel}
      </div>

      {findings.slice(0,3).map(f => {
        const s = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.recommendation;
        return (
          <div key={f.id} style={{ borderLeft:`2px solid ${s.color}`, paddingLeft:10, marginBottom:14 }}>
            <div style={{ fontSize:10, color:s.color, fontWeight:700, marginBottom:3 }}>{s.icon} {f.title}</div>
            <div style={{ fontSize:11, color:T.textMid, lineHeight:1.6 }}>{f.traveller_message}</div>
          </div>
        );
      })}

      {kbHighlights.slice(0,4).map((h,i) => (
        <div key={i} style={{ marginBottom:14, paddingBottom:14, borderBottom: i < Math.min(kbHighlights.length,4)-1 ? `0.5px solid ${T.border}` : 'none' }}>
          <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:5 }}>✦ Did you know</div>
          <div style={{ fontSize:12, color:T.textMid, lineHeight:1.7, fontStyle:'italic' }}>{h}</div>
        </div>
      ))}
    </div>
  );
}

function RightSidebar({ seasonalNote, specialistNote, kbTips, nights, checkinDate,
  regionLabel, selectedHotelName, selectedHotelIncludes, malariaFree }:{
  seasonalNote?:string; specialistNote?:string; kbTips:string[];
  nights:number; checkinDate?:string; regionLabel:string;
  selectedHotelName?:string; selectedHotelIncludes:string[]; malariaFree:boolean;
}) {
  const { ref, vis } = useFade(0.08);
  const month = checkinDate ? new Date(checkinDate).toLocaleString('en',{month:'long'}) : null;
  const isRoomOnly = selectedHotelIncludes.length <= 1;
  const hasContent = seasonalNote || specialistNote || kbTips.length > 0 || selectedHotelName;

  if (!hasContent) return <div ref={ref} />;

  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(20px)',
      transition: 'opacity 0.7s ease 0.12s, transform 0.7s ease 0.12s',
      position: 'sticky', top: 20,
    }}>
      {selectedHotelName && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:600, marginBottom:6 }}>Your selection</div>
          <div style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:"'Cormorant Garamond',serif", marginBottom:2 }}>{selectedHotelName}</div>
          <div style={{ fontSize:11, color:T.textDim }}>{nights} night{nights!==1?'s':''}</div>
          {malariaFree && <div style={{ marginTop:6, fontSize:10, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:20, padding:'2px 10px', display:'inline-block' }}>✦ Malaria-free</div>}
        </div>
      )}

      {selectedHotelIncludes.length > 0 && (
        <div style={{ marginBottom:16, padding:'10px 12px', background: isRoomOnly?'rgba(251,146,60,0.06)':'rgba(74,222,128,0.05)', border:`0.5px solid ${isRoomOnly?'rgba(251,146,60,0.2)':'rgba(74,222,128,0.15)'}`, borderRadius:9 }}>
          <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:6 }}>Included</div>
          {isRoomOnly
            ? <div style={{ fontSize:11, color:T.amber }}>⚑ Room only — meals not included</div>
            : <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {selectedHotelIncludes.filter(k=>k!=='accommodation').map(k => (
                  <span key={k} style={{ fontSize:10, color:T.green, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'2px 8px' }}>
                    {INCLUSION_LABELS[k] ?? k}
                  </span>
                ))}
              </div>
          }
        </div>
      )}

      {seasonalNote && month && (
        <div style={{ marginBottom:16, padding:'10px 12px', background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:9 }}>
          <div style={{ fontSize:9, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>✦ {month}</div>
          <div style={{ fontSize:11, color:T.textMid, lineHeight:1.7, fontStyle:'italic' }}>{seasonalNote}</div>
        </div>
      )}

      {specialistNote && (
        <div style={{ marginBottom:16, borderLeft:`2px solid rgba(96,165,250,0.5)`, paddingLeft:10 }}>
          <div style={{ fontSize:9, color:T.blue, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>Specialist note</div>
          <div style={{ fontSize:11, color:T.textMid, lineHeight:1.65 }}>{specialistNote}</div>
        </div>
      )}

      {kbTips.slice(0,3).map((tip,i) => (
        <div key={i} style={{ fontSize:11, color:T.textMid, lineHeight:1.65, padding:'5px 0', borderBottom: i < Math.min(kbTips.length,3)-1 ? `0.5px solid ${T.border}` : 'none' }}>
          <span style={{ color:T.gold, marginRight:5 }}>›</span>{tip}
        </div>
      ))}
    </div>
  );
}

export default function RegionChapter({
  chapterIndex, totalChapters, regionSlug, regionLabel, countryLabel,
  nights, checkinDate, bgImageUrl, kbHighlights, kbTips, skeletonFindings,
  selectedHotelName, selectedHotelIncludes, malariaFree,
  seasonalNote, specialistNote, children,
}: RegionChapterProps) {

  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const bg = bgImageUrl ?? REGION_BG[regionSlug] ?? '';

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setEntered(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setEntered(true); }, { threshold:0.04 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const hasSidebarContent = kbHighlights.length > 0 || kbTips.length > 0 ||
    skeletonFindings.length > 0 || seasonalNote || specialistNote || selectedHotelName;

  return (
    <div ref={ref} style={{
      position:'relative',
      marginBottom: 0,
      paddingTop: chapterIndex > 0 ? 40 : 0,
      paddingBottom: 8,
    }}>
      {/* Regional background image */}
      {bg && (
        <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
          <img src={bg} alt="" aria-hidden style={{
            width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 35%',
            opacity: entered ? 0.07 : 0,
            transition:'opacity 1.4s ease',
            filter:'saturate(0.6) contrast(0.85)',
          }} />
          <div style={{ position:'absolute', inset:0, background:`linear-gradient(to bottom, rgba(10,10,10,0.65) 0%, rgba(10,10,10,0.25) 30%, rgba(10,10,10,0.25) 70%, rgba(10,10,10,0.8) 100%)` }} />
        </div>
      )}

      {/* Chapter divider line */}
      {chapterIndex > 0 && (
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <div style={{ flex:1, height:'0.5px', background:T.borderGold, opacity:0.3 }} />
          <div style={{ fontSize:9, letterSpacing:'0.4em', textTransform:'uppercase', color:T.gold, opacity:0.6 }}>
            {String(chapterIndex+1).padStart(2,'0')} / {String(totalChapters).padStart(2,'0')} — {CHAPTER_SUBTITLE[regionSlug] ?? regionLabel} · {countryLabel}
          </div>
          <div style={{ flex:1, height:'0.5px', background:T.borderGold, opacity:0.3 }} />
        </div>
      )}

      {/* Three-column layout */}
      <div style={{
        position:'relative', zIndex:1,
        display:'grid',
        gridTemplateColumns: hasSidebarContent ? '180px minmax(0,1fr) 180px' : '1fr',
        gap:'0 28px',
        alignItems:'start',
      }}>
        {hasSidebarContent && (
          <div style={{ paddingTop:4 }}>
            <LeftSidebar
              kbHighlights={kbHighlights}
              skeletonFindings={skeletonFindings}
              chapterIndex={chapterIndex}
              regionLabel={regionSlug}
            />
          </div>
        )}

        <div>{children}</div>

        {hasSidebarContent && (
          <div style={{ paddingTop:4 }}>
            <RightSidebar
              seasonalNote={seasonalNote}
              specialistNote={specialistNote}
              kbTips={kbTips}
              nights={nights}
              checkinDate={checkinDate}
              regionLabel={regionLabel}
              selectedHotelName={selectedHotelName}
              selectedHotelIncludes={selectedHotelIncludes}
              malariaFree={malariaFree}
            />
          </div>
        )}
      </div>

      <style>{`
        @media(max-width:1024px){
          .rch-grid { grid-template-columns: 1fr !important; }
          .rch-grid > div:first-child,
          .rch-grid > div:last-child { display:none; }
        }
      `}</style>
    </div>
  );
}

// ─── PropertyMiniSite ──────────────────────────────────────────────────────────
// Launched from Explore → button. Slide-up sheet — sticky bar remains visible.

export interface PropertyMiniSiteProps {
  hotel: any;
  supplierId?: string;
  kbEntries: any[];
  includes: string[];
  onClose: () => void;
  onSelectRoom?: (extra: number, label: string) => void;
}

export function PropertyMiniSite({ hotel, supplierId, kbEntries, includes, onClose, onSelectRoom }: PropertyMiniSiteProps) {
  const [rooms, setRooms]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeImg, setActiveImg]   = useState(0);

  const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  useEffect(() => {
    const id = supplierId ?? hotel?.supplier_id ?? hotel?.id;
    if (!id || !SB_URL) { setLoading(false); return; }
    // Try room_types table (existing) then supplier_rooms (new)
    fetch(`${SB_URL}/rest/v1/room_types?supplier_id=eq.${id}&select=*&order=name.asc`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows:any[]) => {
        if (rows?.length > 0) {
          setRooms(rows.map(r => ({
            id:r.id, name:r.name,
            description:r.description ?? null,
            max_guests:r.max_occupancy ?? r.max_guests ?? null,
            size_sqm:r.size_sqm ?? null,
            images: (() => { try { return Array.isArray(r.images) ? r.images.map((img:any)=>typeof img==='string'?img:img.url).filter(Boolean) : []; } catch { return []; }})(),
            features: r.bed_type ? [r.bed_type, r.view, r.category].filter(Boolean) : (r.features ?? []),
            extra_zar: Math.max(0, Math.round((Number(r.display_rate_per_night)||hotel.displayRate) - (hotel.displayRate||0))),
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [supplierId, hotel?.id]);

  const propKB = kbEntries.filter((e:any) =>
    (e.status==='active'||e.active===true) &&
    (e.entry_type==='property'||e.type==='property') &&
    e.claim_type !== 'commercial' && !e.internal_only &&
    (e.linked_name??e.linkedTo??'').toLowerCase().includes((hotel?.name??'').toLowerCase())
  );
  const highlights = propKB.flatMap((e:any) => e.highlights ?? []);
  const tips       = propKB.flatMap((e:any) => e.tips ?? []);
  const specialistNote = propKB.flatMap((e:any) => e.specialist_recs ?? [e.specialistNotes]).filter(Boolean)[0];
  const cur = rooms[activeRoom];

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:450,
      background:'rgba(0,0,0,0.82)', backdropFilter:'blur(10px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
      // Leave 120px at bottom for sticky bar
      paddingBottom:120,
    }} onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        width:'100%', maxWidth:680,
        // 92vh minus 120px sticky bar = leaves room for sticky bar
        height:'calc(92vh - 120px)',
        background:'#0f0f0f',
        border:`0.5px solid ${T.borderGold}`,
        borderRadius:'20px 20px 0 0',
        overflow:'hidden',
        display:'flex', flexDirection:'column',
        animation:'slideUp 0.32s ease',
      }}>
        {/* Header */}
        <div style={{ flexShrink:0, padding:'16px 20px 14px', borderBottom:`0.5px solid ${T.border}`, display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:700, marginBottom:3 }}>✦ Property detail</div>
            <div style={{ fontSize:18, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", lineHeight:1.2 }}>{hotel?.name}</div>
            <div style={{ fontSize:11, color:T.textDim, marginTop:3 }}>{hotel?.destination} · ★ {hotel?.trustScore}/100{hotel?.malariaFree?' · ✦ Malaria-free':''}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.07)', border:`0.5px solid ${T.border}`, color:T.textMid, width:34, height:34, borderRadius:'50%', cursor:'pointer', fontSize:16, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
        </div>

        {/* Hero */}
        <div style={{ flexShrink:0, height:180, position:'relative', overflow:'hidden' }}>
          <img src={hotel?.image} alt={hotel?.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
          {hotel?.funFact && <div style={{ position:'absolute', bottom:12, left:16, right:16, fontSize:12, color:'rgba(255,255,255,0.85)', fontStyle:'italic', lineHeight:1.5 }}>"{hotel.funFact}"</div>}
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px 24px' }}>

          {/* Inclusions */}
          {includes.length > 1 && (
            <div style={{ marginBottom:18, padding:'9px 12px', background:'rgba(74,222,128,0.05)', border:'0.5px solid rgba(74,222,128,0.15)', borderRadius:9 }}>
              <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:6 }}>What's included</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {includes.filter(k=>k!=='accommodation').map(k=>(
                  <span key={k} style={{ fontSize:11, color:T.green, background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'2px 9px' }}>
                    {INCLUSION_LABELS[k]??k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Room types */}
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:12 }}>Room types</div>
            {loading ? (
              <div style={{ fontSize:12, color:T.textDim, display:'flex', alignItems:'center', gap:8 }}>
                <div className="spinner" style={{ width:16, height:16 }} /> Loading room types…
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ fontSize:12, color:T.textDim, fontStyle:'italic' }}>Your specialist will brief you on room types and availability.</div>
            ) : (
              <>
                <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:14 }}>
                  {rooms.map((r,i) => (
                    <button key={r.id} onClick={() => { setActiveRoom(i); setActiveImg(0); }} style={{
                      padding:'5px 13px', borderRadius:20,
                      border:`1.5px solid ${i===activeRoom?T.gold:T.border}`,
                      background: i===activeRoom?T.goldDim:'transparent',
                      color: i===activeRoom?T.gold:T.textMid,
                      fontSize:12, cursor:'pointer', fontFamily:'inherit',
                      fontWeight: i===activeRoom?600:400,
                    }}>
                      {r.name}
                    </button>
                  ))}
                </div>

                {cur && (
                  <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:12, overflow:'hidden' }}>
                    {cur.images.length > 0 && (
                      <div style={{ position:'relative', height:170 }}>
                        <img src={cur.images[activeImg]} alt={cur.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        {cur.images.length > 1 && (
                          <>
                            {activeImg > 0 && <button onClick={()=>setActiveImg(i=>i-1)} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>}
                            {activeImg < cur.images.length-1 && <button onClick={()=>setActiveImg(i=>i+1)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,0.6)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>}
                            <div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex', justifyContent:'center', gap:4 }}>
                              {cur.images.map((_:any,i:number) => <div key={i} onClick={()=>setActiveImg(i)} style={{ width:i===activeImg?14:5, height:5, borderRadius:3, background:i===activeImg?T.gold:'rgba(255,255,255,0.4)', cursor:'pointer', transition:'all 0.2s' }} />)}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div style={{ padding:'13px 16px' }}>
                      <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:"'Cormorant Garamond',serif", marginBottom:5 }}>{cur.name}</div>
                      {cur.description && <div style={{ fontSize:12, color:T.textMid, lineHeight:1.65, marginBottom:8 }}>{cur.description}</div>}
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom: onSelectRoom ? 12 : 0 }}>
                        {cur.max_guests && <span style={{ fontSize:11, color:T.textDim }}>👥 {cur.max_guests} guests max</span>}
                        {cur.size_sqm && <span style={{ fontSize:11, color:T.textDim }}>{cur.size_sqm}m²</span>}
                        {cur.features.map((f:string,i:number) => <span key={i} style={{ fontSize:10, color:T.textMid, background:'rgba(255,255,255,0.05)', border:`0.5px solid ${T.border}`, borderRadius:20, padding:'2px 8px' }}>{f}</span>)}
                      </div>
                      {onSelectRoom && (
                        <button onClick={() => { onSelectRoom(cur.extra_zar, cur.name); onClose(); }} style={{ width:'100%', padding:'11px 0', borderRadius:9, border:`1.5px solid ${T.gold}`, background:T.goldDim, color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>
                          Select {cur.name} {cur.extra_zar > 0 ? '→' : '— included'}
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
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>Why this property</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {highlights.map((h:string,i:number) => <span key={i} style={{ fontSize:11, color:T.gold, background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:6, padding:'4px 10px' }}>{h}</span>)}
              </div>
            </div>
          )}

          {specialistNote && (
            <div style={{ marginBottom:18, borderLeft:`2px solid ${T.gold}`, paddingLeft:12, fontStyle:'italic' }}>
              <div style={{ fontSize:10, color:T.gold, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>Specialist note</div>
              <div style={{ fontSize:12, color:T.textMid, lineHeight:1.7 }}>{specialistNote}</div>
            </div>
          )}

          {tips.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:T.blue, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>Tips from our specialists</div>
              {tips.map((tip:string,i:number) => (
                <div key={i} style={{ fontSize:12, color:T.textMid, lineHeight:1.65, padding:'5px 0', borderBottom:i<tips.length-1?`0.5px solid ${T.border}`:'none' }}>
                  <span style={{ color:T.blue, marginRight:6 }}>›</span>{tip}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
