'use client';

// ─────────────────────────────────────────────────────────────────────────────
// components/RegionChapter.tsx
//
// Two exports:
//
// 1. PropertyMiniSite — full-screen bottom-sheet overlay launched from
//    "Explore →" button on each property tile. Reads from room_types table
//    (same table the CMS uses). Shows room type gallery, inclusions, KB tips.
//
// 2. RegionChapter — passthrough default export, not yet wired into page.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { T } from '@/app/lib/theme';

// ── Inclusion display ─────────────────────────────────────────────────────────

const INCLUSION_DISPLAY: Record<string, { icon: string; label: string }> = {
  accommodation:        { icon: '🏕',  label: 'Accommodation' },
  all_meals:            { icon: '🍽',  label: 'All meals' },
  game_drives:          { icon: '🐘',  label: 'Game drives & activities' },
  mokoro:               { icon: '🛶',  label: 'Mokoro' },
  laundry:              { icon: '👕',  label: 'Laundry' },
  park_fees:            { icon: '🌿',  label: 'Park & conservation fees' },
  local_drinks:         { icon: '🍷',  label: 'Local drinks & house wines' },
  premium_drinks:       { icon: '🥂',  label: 'Premium drinks & spirits' },
  spa_treatments:       { icon: '💆',  label: 'Spa treatments' },
  transfers_to_airstrip:{ icon: '✈',  label: 'Airstrip transfers' },
};

function InclusionStrip({ includes, malariaFree }: { includes: string[]; malariaFree?: boolean }) {
  if (!includes?.length) return null;
  const isRoomOnly = includes.length <= 1 && includes[0] === 'accommodation';
  return (
    <div style={{
      padding: '12px 16px',
      background: isRoomOnly ? 'rgba(251,146,60,0.06)' : 'rgba(74,222,128,0.05)',
      border: `0.5px solid ${isRoomOnly ? 'rgba(251,146,60,0.2)' : 'rgba(74,222,128,0.15)'}`,
      borderRadius: 10, marginBottom: 20,
    }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
        What's included in your rate
      </div>
      {isRoomOnly ? (
        <div style={{ fontSize: 12, color: T.amber, lineHeight: 1.6 }}>
          ⚑ This property is priced room-only — meals, drinks and activities are billed separately. Your specialist will provide a full cost breakdown.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 6 }}>
            {includes.filter(k => k !== 'accommodation').map(key => {
              const inc = INCLUSION_DISPLAY[key];
              if (!inc) return null;
              return (
                <span key={key} style={{ fontSize: 11, color: T.green, background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '3px 10px' }}>
                  {inc.icon} {inc.label}
                </span>
              );
            })}
            {malariaFree && (
              <span style={{ fontSize: 11, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
                ✦ Malaria-free
              </span>
            )}
          </div>
          {!includes.includes('premium_drinks') && includes.includes('local_drinks') && (
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
              Premium spirits and wines available on request — not included in the rate.
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Standard:       { color: '#6dc76d', bg: 'rgba(100,200,100,0.1)',  border: 'rgba(100,200,100,0.3)' },
  Premium:        { color: T.gold,   bg: 'rgba(212,175,55,0.12)',  border: 'rgba(212,175,55,0.35)' },
  Family:         { color: T.blue,   bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.3)' },
  Villa:          { color: T.red,    bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)' },
  'Exclusive-Use':{ color: '#b46afa',bg: 'rgba(180,100,250,0.1)', border: 'rgba(180,100,250,0.3)' },
};

export interface PropertyMiniSiteProps {
  hotel: {
    id:           string | number;
    name:         string;
    destination:  string;
    trustScore:   number;
    image:        string;
    funFact?:     string;
    malariaFree?: boolean;
  };
  kbEntries:  any[];
  includes:   string[];
  onClose:    () => void;
}

export function PropertyMiniSite({ hotel, kbEntries, includes, onClose }: PropertyMiniSiteProps) {
  const [rooms,      setRooms]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeImg,  setActiveImg]  = useState(0);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) { setLoading(false); return; }
    fetch(
      `${SUPABASE_URL}/rest/v1/room_types?supplier_id=eq.${hotel.id}&order=name.asc&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
      .then(r => r.json())
      .then((rows: any[]) => {
        if (Array.isArray(rows)) {
          setRooms(rows.map(r => ({
            ...r,
            images: Array.isArray(r.images) ? r.images : (r.images ? (() => { try { return JSON.parse(r.images); } catch { return []; } })() : []),
            reels:  Array.isArray(r.reels)  ? r.reels  : (r.reels  ? (() => { try { return JSON.parse(r.reels);  } catch { return []; } })() : []),
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [hotel.id, SUPABASE_URL, SUPABASE_KEY]);

  useEffect(() => { setActiveImg(0); }, [activeRoom]);

  const propKB = (kbEntries ?? []).filter((e: any) => {
    const name = hotel.name.toLowerCase();
    const isActive  = e.status === 'active' || e.active === true;
    const isNotComm = e.claim_type !== 'commercial';
    const isNotInt  = !e.internal_only;
    const linked    = (e.linkedTo ?? e.linked_name ?? '').toLowerCase().includes(name);
    return isActive && isNotComm && isNotInt && linked;
  });

  const highlights = propKB.flatMap((e: any) => e.highlights ?? []);
  const tips       = propKB.flatMap((e: any) => e.tips ?? []);
  const currentRoom = rooms[activeRoom];
  const roomImages  = currentRoom?.images?.filter((img: any) => img.url && img.status !== 'rejected') ?? [];
  const currentImg  = roomImages[activeImg];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 720, height: '94vh', background: T.bg, border: `0.5px solid ${T.borderGold}`, borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.32s ease' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '16px 20px 14px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.15em', fontWeight: 700, marginBottom: 3 }}>✦ Property detail</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1.2 }}>{hotel.name}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>
              {hotel.destination} · ★ {hotel.trustScore}/100
              {hotel.malariaFree && <span style={{ color: T.gold, marginLeft: 8 }}>✦ Malaria-free</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: `0.5px solid ${T.border}`, color: T.textMid, width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 18, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        {/* Hero */}
        <div style={{ flexShrink: 0, height: 200, position: 'relative', overflow: 'hidden' }}>
          <img src={hotel.image} alt={hotel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
          {hotel.funFact && (
            <div style={{ position: 'absolute', bottom: 14, left: 18, right: 18, fontSize: 12, color: 'rgba(255,255,255,0.88)', fontStyle: 'italic', lineHeight: 1.55, fontFamily: "'Cormorant Garamond',serif" }}>
              "{hotel.funFact}"
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>

          <InclusionStrip includes={includes} malariaFree={hotel.malariaFree} />

          {/* Room types */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>
              Accommodation options
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: T.textDim, fontSize: 12 }}>
                <div className="spinner" style={{ width: 18, height: 18 }} /> Loading room types…
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic', padding: '14px 0', lineHeight: 1.65 }}>
                Detailed room type information will be confirmed by your specialist.
              </div>
            ) : (
              <>
                {/* Room tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
                  {rooms.map((room, i) => {
                    const cat = CATEGORY_STYLE[room.category] ?? CATEGORY_STYLE.Standard;
                    const isSel = i === activeRoom;
                    return (
                      <button key={room.id} onClick={() => setActiveRoom(i)} style={{ padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${isSel ? T.gold : T.border}`, background: isSel ? T.goldDim : 'transparent', color: isSel ? T.gold : T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: isSel ? 600 : 400, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {room.name}
                        {room.category && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: cat.bg, border: `0.5px solid ${cat.border}`, color: cat.color, borderRadius: 20, padding: '1px 6px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                            {room.category}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Active room detail */}
                {currentRoom && (
                  <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 14, overflow: 'hidden' }}>
                    {roomImages.length > 0 ? (
                      <div style={{ position: 'relative', height: 200 }}>
                        <img src={currentImg?.url} alt={currentImg?.caption || currentRoom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {currentImg?.caption && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 14px 10px', background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}>
                            {currentImg.caption}
                          </div>
                        )}
                        {activeImg > 0 && (
                          <button onClick={() => setActiveImg(i => i - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                        )}
                        {activeImg < roomImages.length - 1 && (
                          <button onClick={() => setActiveImg(i => i + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                        )}
                        {roomImages.length > 1 && (
                          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                            {roomImages.map((_: any, i: number) => (
                              <div key={i} onClick={() => setActiveImg(i)} style={{ width: i === activeImg ? 16 : 5, height: 5, borderRadius: 3, background: i === activeImg ? T.gold : 'rgba(255,255,255,0.45)', cursor: 'pointer', transition: 'all 0.2s' }} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg3, color: T.textDim, fontSize: 13, gap: 8 }}>
                        <span style={{ fontSize: 20 }}>🛏</span> Images being added
                      </div>
                    )}
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif" }}>{currentRoom.name}</div>
                        <div style={{ display: 'flex', gap: 10, flexShrink: 0, marginLeft: 12, flexWrap: 'wrap' as const }}>
                          {currentRoom.max_occupancy && <span style={{ fontSize: 11, color: T.textDim }}>👥 {currentRoom.max_occupancy} guests</span>}
                          {currentRoom.bed_type && <span style={{ fontSize: 11, color: T.textDim }}>🛏 {currentRoom.bed_type}</span>}
                          {currentRoom.view && <span style={{ fontSize: 11, color: T.textDim }}>🌅 {currentRoom.view}</span>}
                        </div>
                      </div>
                      {currentRoom.description && (
                        <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 10, fontStyle: 'italic' }}>
                          {currentRoom.description}
                        </div>
                      )}
                      {currentRoom.max_children != null && (
                        <div style={{ fontSize: 11, color: T.textDim, background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${T.border}`, borderRadius: 7, padding: '6px 10px', marginTop: 8 }}>
                          {currentRoom.max_children === 0 ? '⚑ Adults only — children not permitted in this room type' : `Children: up to ${currentRoom.max_children} child${currentRoom.max_children > 1 ? 'ren' : ''} accommodated`}
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
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>Why this property</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {highlights.map((h: string, i: number) => (
                  <span key={i} style={{ fontSize: 12, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 6, padding: '5px 12px', lineHeight: 1.4 }}>{h}</span>
                ))}
              </div>
            </div>
          )}

          {/* KB tips */}
          {tips.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: T.blue, textTransform: 'uppercase' as const, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 10 }}>Specialist tips</div>
              {tips.map((tip: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7, padding: '8px 0', borderBottom: i < tips.length - 1 ? `0.5px solid ${T.border}` : 'none' }}>
                  <span style={{ color: T.blue, marginRight: 6 }}>›</span>{tip}
                </div>
              ))}
            </div>
          )}

          {highlights.length === 0 && tips.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic', padding: '4px 0 20px', lineHeight: 1.65 }}>
              Your specialist will brief you fully on {hotel.name} before travel — including guiding quality, best rooms, and current conditions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Default export — passthrough until full-width layout is built
interface RegionChapterProps { children: React.ReactNode; [key: string]: any; }
export default function RegionChapter({ children }: RegionChapterProps) {
  return <>{children}</>;
}
