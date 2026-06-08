'use client';
// components/PropertyMiniSite.tsx
// Extracted from RegionChapter to avoid SWC TSX parsing issues with complex generics.

import { useState, useEffect } from 'react';
import { T } from '@/app/lib/theme';
import { InclusionPills } from './RegionChapter';

export interface PropertyMiniSiteProps {
  hotel:        any;
  supplierId?:  string;
  kbEntries:    any[];
  includes:     string[];
  onClose:      () => void;
  onSelectRoom?: (extra:number, label:string) => void;
}

export function PropertyMiniSite({ hotel, supplierId, kbEntries, includes, onClose, onSelectRoom }: PropertyMiniSiteProps) {
  const [rooms, setRooms]           = useState([] as any[]);
  const [loading, setLoading]       = useState(true);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeImg, setActiveImg]   = useState(0);
  const [addons, setAddons]         = useState([] as any[]);
  // Use explicit empty array for add-on selections — simpler than Set for TSX compat
  const [selectedAddons, setSelectedAddons] = useState([] as string[]);
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
            const cats: {[key: string]: any[]} = {};
            addons.forEach(a => { cats[a.category] = cats[a.category] ?? []; cats[a.category].push(a); });
            const catLabels: {[k: string]: string} = {
              spa:'✦ Spa & Wellness', experience:'✦ Experiences', dining:'✦ Private Dining', vehicle:'✦ Private Vehicle',
            };
            return (
              <div style={{ marginTop:20 }}>
                <div style={{ fontSize:10, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>Add to your stay</div>
                {Object.entries(cats).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, color:T.textDim, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:7 }}>{catLabels[cat] ?? cat}</div>
                    {items.map((a:any) => {
                      const isSel = selectedAddons.includes(a.id);
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
                              onClick={() => setSelectedAddons(prev =>
                                prev.includes(a.id)
                                  ? prev.filter(x => x !== a.id)
                                  : [...prev, a.id]
                              )}
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
            {selectedAddons.length > 0 && (
              <div style={{ fontSize:10, color:T.gold, marginBottom:8, fontStyle:'italic' }}>
                + {selectedAddons.size} add-on{selectedAddons.length>1?'s':''} selected — your specialist will confirm availability
              </div>
            )}
            <button onClick={() => {
              const addonNotes = addons.filter((a:any) => selectedAddons.includes(a.id)).map((a:any) => a.name).join(', ');
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
        const sections: {title:string; body:string}[] = [];

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
