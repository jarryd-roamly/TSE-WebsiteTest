'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#0a0a0a', bg2: '#0f0f0f', surface: '#141414', surfaceUp: '#1a1a1a',
  gold: '#c8a96e', goldBright: '#d4af37', goldLight: '#f0c040',
  goldDim: 'rgba(200,169,110,0.10)', goldBorder: 'rgba(200,169,110,0.22)',
  goldBorderBright: 'rgba(200,169,110,0.40)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.60)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.06)', borderMid: 'rgba(255,255,255,0.10)',
  green: '#4ade80', greenDim: 'rgba(74,222,128,0.08)', greenBorder: 'rgba(74,222,128,0.22)',
  red: '#f87171', redDim: 'rgba(248,113,113,0.08)', redBorder: 'rgba(248,113,113,0.28)',
  amber: '#fbbf24', amberDim: 'rgba(251,191,36,0.08)', amberBorder: 'rgba(251,191,36,0.25)',
  blue: '#60a5fa',
  sideCol: '#0d0d0d',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtUSD(n: number) { return `$${Math.round(n).toLocaleString()}` }
function fmtZAR(n: number) { return `R ${Math.round(n).toLocaleString()}` }
function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatDateShort(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDayDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
function balanceDueDate(travelDate: string) {
  if (!travelDate) return '30 days before travel'
  const d = new Date(travelDate); d.setDate(d.getDate() - 30)
  return formatDate(d.toISOString())
}
function nightsLabel(n: number) { return `${n} night${n !== 1 ? 's' : ''}` }
function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr); d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function durFromMins(mins: number) {
  if (!mins) return ''
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

const NATIONALITIES = ['Afghan','Albanian','Algerian','American','Andorran','Angolan','Argentine','Armenian','Australian','Austrian','Azerbaijani','Bahraini','Bangladeshi','Belarusian','Belgian','Belizean','Brazilian','British','Bruneian','Bulgarian','Cambodian','Cameroonian','Canadian','Chilean','Chinese','Colombian','Costa Rican','Croatian','Cuban','Czech','Danish','Dutch','Egyptian','Emirati','Estonian','Ethiopian','Finnish','French','Georgian','German','Ghanaian','Greek','Hungarian','Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian','Japanese','Jordanian','Kazakh','Kenyan','Korean','Kuwaiti','Latvian','Lebanese','Lithuanian','Malaysian','Maltese','Mauritian','Mexican','Mongolian','Moroccan','Namibian','Nepalese','New Zealander','Nigerian','Norwegian','Pakistani','Peruvian','Filipino','Polish','Portuguese','Romanian','Russian','Rwandan','Saudi','Singaporean','South African','Spanish','Sri Lankan','Sudanese','Swedish','Swiss','Tanzanian','Thai','Turkish','Ugandan','Ukrainian','Venezuelan','Vietnamese','Zambian','Zimbabwean']

// ─── Luxury inclusion formatting ──────────────────────────────────────────────
function formatInclusion(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/\bAll\b/g, 'All')
    .replace(/\bPer\b/g, 'per')
}

// ─── Chronological sequence builder ──────────────────────────────────────────
function buildChronologicalSequence(components: any[]) {
  const isIntlFlight   = (c: any) => c.is_international && !c.is_return && (c.type === 'flight' || c.pillar === 'flight')
  const isReturnFlight = (c: any) => c.is_international && c.is_return  && (c.type === 'flight' || c.pillar === 'flight')
  const isCharterFlight= (c: any) => (c.type === 'flight' || c.pillar === 'flight') && !c.is_international
  const isHotel        = (c: any) => {
    const t = (c.type || c.component_type || c.pillar || '').toLowerCase()
    return t.includes('hotel') || t.includes('lodge') || t.includes('camp') || t.includes('accommodation') || c.pillar === 'hotel'
  }
  const isTransfer     = (c: any) => {
    const t = (c.type || c.component_type || c.pillar || '').toLowerCase()
    return (t.includes('transfer') || t === 'transport' || c.pillar === 'transfer') && !t.includes('flight')
  }
  const isActivity     = (c: any) => {
    const t = (c.type || c.component_type || c.pillar || '').toLowerCase()
    return t.includes('activity') || t.includes('trek') || c.pillar === 'activity'
  }

  const intlOut   = components.filter(isIntlFlight)
  const intlRet   = components.filter(isReturnFlight)
  const charters  = components.filter(isCharterFlight)
  const hotels    = components.filter(isHotel)
  const transfers = components.filter(isTransfer)
  const activities= components.filter(isActivity)

  const sequence: any[] = []
  const usedTransfer = new Set<number>()
  const usedCharter  = new Set<number>()

  // 1. Outbound international flight + arrival transfer
  intlOut.forEach(f => sequence.push({ ...f, _seq: 'intl-flight', _dir: 'outbound' }))

  // 2. First-mile arrival transfer (is_arrival flag)
  const arrivalTransfers = transfers.filter(t => t.is_arrival)
  arrivalTransfers.forEach((t, ti) => {
    sequence.push({ ...t, _seq: 'transfer' })
    usedTransfer.add(transfers.indexOf(t))
  })

  // 3. Hotels with connecting transfers/charters between them
  hotels.forEach((hotel, hi) => {
    if (hi > 0) {
      // Charter flight into this region
      const charIdx = charters.findIndex((c, ci) =>
        !usedCharter.has(ci) && (
          (c.to_region && hotel.region_slug && c.to_region === hotel.region_slug) ||
          !usedCharter.has(ci)
        )
      )
      if (charIdx >= 0) {
        sequence.push({ ...charters[charIdx], _seq: 'charter' })
        usedCharter.add(charIdx)
      }

      // Inter-region transfer
      const transIdx = transfers.findIndex((t, ti) =>
        !usedTransfer.has(ti) && !t.is_arrival && !t.is_departure && (
          (t.to_region && hotel.region_slug && t.to_region === hotel.region_slug) ||
          (t.from_region && hotels[hi - 1]?.region_slug && t.from_region === hotels[hi - 1]?.region_slug)
        )
      )
      if (transIdx >= 0) {
        sequence.push({ ...transfers[transIdx], _seq: 'transfer' })
        usedTransfer.add(transIdx)
      } else {
        // fallback: any unused non-arrival/departure transfer
        const fallback = transfers.findIndex((t, ti) => !usedTransfer.has(ti) && !t.is_arrival && !t.is_departure)
        if (fallback >= 0) {
          sequence.push({ ...transfers[fallback], _seq: 'transfer' })
          usedTransfer.add(fallback)
        }
      }
    }

    // The hotel itself — collect activities for its region
    const hotelActs = activities.filter(a =>
      !a.region_slug || !hotel.region_slug || a.region_slug === hotel.region_slug
    )
    sequence.push({ ...hotel, _seq: 'hotel', _activities: hotelActs })
  })

  // 4. Departure transfer (last mile) + return flight
  const departureTransfers = transfers.filter(t => t.is_departure)
  departureTransfers.forEach(t => {
    sequence.push({ ...t, _seq: 'transfer' })
  })
  intlRet.forEach(f => sequence.push({ ...f, _seq: 'intl-flight', _dir: 'return' }))

  // 5. Any unused charter flights
  charters.forEach((c, ci) => {
    if (!usedCharter.has(ci)) sequence.push({ ...c, _seq: 'charter' })
  })

  // 6. Unclassified fallback
  const classified = new Set([...intlOut, ...intlRet, ...charters, ...hotels, ...transfers, ...activities])
  components.filter(c => !classified.has(c)).forEach(c => sequence.push({ ...c, _seq: 'mixed' }))

  return sequence
}

// ─── ExpandModal ──────────────────────────────────────────────────────────────
function ExpandModal({
  images, propertyName, roomType, initialIndex, onClose
}: {
  images: { url: string; label?: string | null }[]
  propertyName: string
  roomType?: string
  initialIndex: number
  onClose: () => void
}) {
  const [current, setCurrent] = useState(initialIndex)
  const stripRef = useRef<HTMLDivElement>(null)
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  useEffect(() => {
    const strip = stripRef.current; if (!strip) return
    const thumb = strip.children[current] as HTMLElement
    if (thumb) thumb.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }, [current])

  if (!images.length) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0, borderBottom: `0.5px solid ${T.border}` }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.text }}>{propertyName}</div>
          {roomType && <div style={{ fontSize: 11, color: T.gold, letterSpacing: '0.14em', marginTop: 2 }}>{roomType}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 11, color: T.textDim }}>{current + 1} / {images.length}</div>
          <button onClick={onClose} style={{ background: 'none', border: `0.5px solid ${T.border}`, color: T.text, width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '0 60px' }}>
        <img src={images[current].url} alt={propertyName} style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
        {images[current].label && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: T.textMid, background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 4, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{images[current].label}</div>
        )}
        {images.length > 1 && (
          <>
            <button onClick={prev} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.08)', border: `0.5px solid ${T.border}`, color: T.text, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <button onClick={next} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.08)', border: `0.5px solid ${T.border}`, color: T.text, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div ref={stripRef} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '14px 24px', flexShrink: 0, scrollbarWidth: 'none', borderTop: `0.5px solid ${T.border}` }}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{ flexShrink: 0, padding: 0, border: `2px solid ${i === current ? T.gold : 'transparent'}`, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: 'none', opacity: i === current ? 1 : 0.45, transition: 'all 0.2s', width: 72, height: 50 }}>
              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ImageCarousel ─────────────────────────────────────────────────────────────
function ImageCarousel({ images, propertyName, onExpand }: { images: { url: string; label?: string | null }[]; propertyName: string; onExpand: (i: number) => void }) {
  const [current, setCurrent] = useState(0)
  const [dragStartX, setDragStartX] = useState<number | null>(null)
  const [didDrag, setDidDrag] = useState(false)
  if (!images.length) return null
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrent(i => (i - 1 + images.length) % images.length) }
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setCurrent(i => (i + 1) % images.length) }
  return (
    <div style={{ position: 'relative', borderRadius: '12px 12px 0 0', overflow: 'hidden', userSelect: 'none' }}>
      <div style={{ position: 'relative', height: 280, overflow: 'hidden', cursor: 'zoom-in' }}
        onPointerDown={e => { setDragStartX(e.clientX); setDidDrag(false) }}
        onPointerUp={e => {
          if (dragStartX !== null) {
            const dx = e.clientX - dragStartX
            if (Math.abs(dx) > 40) { setCurrent(i => dx < 0 ? (i + 1) % images.length : (i - 1 + images.length) % images.length); setDidDrag(true) }
            setDragStartX(null)
          }
        }}
        onClick={() => !didDrag && onExpand(current)}>
        <img src={images[current].url} alt={propertyName} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.2s' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)' }} />
        <button onClick={e => { e.stopPropagation(); onExpand(current) }} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: `0.5px solid rgba(255,255,255,0.15)`, borderRadius: 6, color: T.text, padding: '5px 11px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>⤢</span> View all
        </button>
        {images.length > 1 && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: `0.5px solid rgba(255,255,255,0.12)`, borderRadius: 4, padding: '3px 8px', fontSize: 10, color: T.textMid, letterSpacing: '0.1em' }}>
            {current + 1} / {images.length}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, pointerEvents: 'none' }}>
          {images.map((_, i) => (
            <div key={i} style={{ width: i === current ? 18 : 5, height: 5, borderRadius: 3, background: i === current ? T.gold : 'rgba(255,255,255,0.45)', transition: 'all 0.25s' }} />
          ))}
        </div>
      )}
      {images.length > 1 && (
        <>
          <button onClick={prev} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: `0.5px solid rgba(255,255,255,0.12)`, color: T.text, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={next} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', border: `0.5px solid rgba(255,255,255,0.12)`, color: T.text, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </>
      )}
    </div>
  )
}

// ─── LodgeCard ─────────────────────────────────────────────────────────────────
function LodgeCard({ comp, onExpand }: { comp: any; onExpand: (images: any[], name: string, rt: string, idx: number) => void }) {
  const nights = comp.nights || comp.duration_nights || 0
  const allImages: { url: string; label?: string | null }[] = []
  if (comp.hero_image_url) allImages.push({ url: comp.hero_image_url, label: 'Property' })
  if (Array.isArray(comp.images)) {
    comp.images.forEach((img: any) => {
      const url = typeof img === 'string' ? img : img?.url
      if (url && url !== comp.hero_image_url) allImages.push({ url, label: img?.label || null })
    })
  }
  const checkInDate  = comp.check_in  || comp.date_from
  const checkOutDate = comp.check_out || comp.date_to
  const inclusions: string[] = (comp.inclusions || []).slice(0, 10)

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `0.5px solid ${T.goldBorder}`, background: T.surface, marginBottom: 4 }}>
      {allImages.length > 0
        ? <ImageCarousel images={allImages} propertyName={comp.name || 'Property'} onExpand={idx => onExpand(allImages, comp.name || 'Property', comp.room_type || '', idx)} />
        : (
          <div style={{ height: 72, background: T.goldDim, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: `0.5px solid ${T.goldBorder}` }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: T.gold }}>{comp.destination || comp.region || 'Lodge'}</span>
          </div>
        )
      }

      <div style={{ padding: '18px 20px' }}>
        {/* Destination + nights pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, color: T.gold, letterSpacing: '0.32em', textTransform: 'uppercase' as const }}>
            {comp.destination || comp.region || comp.location}
          </span>
          {nights > 0 && (
            <span style={{ fontSize: 10, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.goldBorder}`, padding: '3px 12px', borderRadius: 20, letterSpacing: '0.14em' }}>
              {nightsLabel(nights)}
            </span>
          )}
        </div>

        {/* Property name */}
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 300, color: T.text, marginBottom: 4, lineHeight: 1.15 }}>
          {comp.name || comp.property_name}
        </div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: comp.room_type ? 4 : 14 }}>
          {[comp.location, comp.country].filter(Boolean).join(' · ')}
        </div>
        {comp.room_type && (
          <div style={{ fontSize: 12, color: T.textMid, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: T.gold, fontSize: 9, letterSpacing: '0.1em' }}>ROOM</span>
            <span style={{ color: T.textDim, fontSize: 10 }}>·</span>
            {comp.room_type}
          </div>
        )}
        {comp.meal_basis && (
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 14, letterSpacing: '0.06em' }}>{comp.meal_basis}</div>
        )}

        {/* Dates */}
        {(checkInDate || checkOutDate) && (
          <div style={{ display: 'flex', alignItems: 'center', background: T.goldDim, border: `0.5px solid ${T.goldBorder}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 3 }}>Check in</div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{formatDateShort(checkInDate)}</div>
            </div>
            <div style={{ width: 1, height: 32, background: T.goldBorder, margin: '0 14px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 3 }}>Check out</div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{formatDateShort(checkOutDate)}</div>
            </div>
          </div>
        )}

        {/* Trust score */}
        {comp.trust_score && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 9, color: T.textDim, minWidth: 64, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Trust</div>
            <div style={{ flex: 1, height: 1, background: T.border, borderRadius: 1 }}>
              <div style={{ width: `${comp.trust_score}%`, height: '100%', background: `linear-gradient(90deg, ${T.gold}, ${T.goldLight})`, borderRadius: 1 }} />
            </div>
            <div style={{ fontSize: 10, color: T.gold, minWidth: 40, textAlign: 'right' as const }}>{comp.trust_score}/100</div>
          </div>
        )}

        {/* ── Luxe inclusions ── */}
        {inclusions.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.28em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Included</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 0 }}>
              {inclusions.map((inc, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 600, letterSpacing: '0.03em' }}>
                    {formatInclusion(inc)}
                  </span>
                  {i < inclusions.length - 1 && (
                    <span style={{ color: T.goldBorder, margin: '0 8px', fontSize: 10 }}>·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Activities */}
        {comp._activities?.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.28em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Selected Experiences</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 0 }}>
              {comp._activities.map((act: any, i: number) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>{act.name}</span>
                  {i < comp._activities.length - 1 && (
                    <span style={{ color: T.goldBorder, margin: '0 8px', fontSize: 10 }}>·</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {comp.malaria_free && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.green, background: T.greenDim, border: `0.5px solid ${T.greenBorder}`, padding: '3px 9px', borderRadius: 4, letterSpacing: '0.08em' }}>
            Malaria-Free Area
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TransferCard ──────────────────────────────────────────────────────────────
function TransferCard({ comp }: { comp: any }) {
  const from = comp.from_label || comp.from_region || ''
  const to   = comp.to_label   || comp.to_region   || comp.destination || ''
  const [expanded, setExpanded] = useState(false)
  // The description / aiNote often has the richest info
  const detail = comp.description || comp.ai_note || comp.aiNote || ''
  const provider = comp.provider || ''
  const isArrival = comp.is_arrival
  const isDeparture = comp.is_departure
  const label = isArrival ? 'Arrival Transfer' : isDeparture ? 'Departure Transfer' : 'Transfer'

  return (
    <div style={{ padding: '0', margin: '4px 0', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 10, borderLeft: `2px solid ${T.goldBorder}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: isArrival ? 'rgba(74,222,128,0.08)' : isDeparture ? 'rgba(96,165,250,0.08)' : T.goldDim, border: `0.5px solid ${isArrival ? T.greenBorder : isDeparture ? 'rgba(96,165,250,0.3)' : T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {provider.toLowerCase().includes('air') || provider.toLowerCase().includes('fly') ? '🛩' : provider.toLowerCase().includes('boat') ? '⛵' : '🚐'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: isArrival ? T.green : isDeparture ? T.blue : T.gold, letterSpacing: '0.28em', textTransform: 'uppercase' as const, marginBottom: 5 }}>{label}</div>
          {from && to && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{from}</span>
              <span style={{ color: T.gold, fontSize: 14 }}>→</span>
              <span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{to}</span>
            </div>
          )}
          {/* Provider as styled detail */}
          {provider && (
            <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'Jost', sans-serif", lineHeight: 1.55, marginBottom: detail ? 4 : 0 }}>
              {provider}
            </div>
          )}
          {/* Collapsed detail: show a preview of the aiNote */}
          {detail && !expanded && (
            <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {detail.length > 80 ? detail.slice(0, 80) + '…' : detail}
            </div>
          )}
          {detail && expanded && (
            <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6, marginTop: 6, background: T.goldDim, border: `0.5px solid ${T.goldBorder}`, borderRadius: 6, padding: '8px 12px' }}>
              {detail}
            </div>
          )}
          {detail && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.gold, fontSize: 10, padding: '4px 0 0', letterSpacing: '0.08em', fontFamily: 'inherit' }}>
              {expanded ? '▲ Less' : '▼ Full route details'}
            </button>
          )}
        </div>
        <div style={{ textAlign: 'right' as const, flexShrink: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontSize: 9, color: T.amber, letterSpacing: '0.1em', background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' as const }}>
            To confirm
          </div>
          {comp.duration && <div style={{ fontSize: 10, color: T.textDim }}>{comp.duration}</div>}
          {comp.price_display_zar > 0 && <div style={{ fontSize: 11, color: T.textMid }}>{fmtZAR(comp.price_display_zar)}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── FlightCard ───────────────────────────────────────────────────────────────
function FlightCard({ comp }: { comp: any }) {
  const isReturn  = comp.is_return
  const isCharter = !comp.is_international
  const theme = isReturn ? T.blue : isCharter ? T.gold : T.gold
  const stops = comp.stops ?? 0
  const dur = comp.total_duration_minutes ? durFromMins(comp.total_duration_minutes) : ''

  return (
    <div style={{ padding: '16px 18px', margin: '4px 0', background: T.surface, border: `0.5px solid ${isReturn ? 'rgba(96,165,250,0.3)' : T.goldBorder}`, borderRadius: 10 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {comp.airline_logo
            ? <img src={comp.airline_logo} alt={comp.airline} style={{ height: 28, maxWidth: 80, objectFit: 'contain', background: '#fff', borderRadius: 4, padding: '2px 5px' }} />
            : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: isReturn ? 'rgba(96,165,250,0.1)' : T.goldDim, border: `0.5px solid ${isReturn ? 'rgba(96,165,250,0.3)' : T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {isCharter ? '🛩' : '✈'}
              </div>
            )
          }
          <div>
            <div style={{ fontSize: 9, color: theme, letterSpacing: '0.28em', textTransform: 'uppercase' as const }}>
              {isReturn ? 'Return Flight' : isCharter ? 'Charter Flight' : 'International Flight'}
            </div>
            {comp.airline && <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{comp.airline}</div>}
          </div>
        </div>
        {!isReturn && (
          <div style={{ fontSize: 9, color: T.amber, letterSpacing: '0.08em', background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase' as const }}>
            Price valid 48hrs
          </div>
        )}
      </div>

      {/* Route block */}
      {comp.from && comp.to ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: T.goldDim, border: `0.5px solid ${T.goldBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
          <div style={{ textAlign: 'center' as const, minWidth: 60 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: T.text, lineHeight: 1 }}>{comp.from}</div>
            {comp.departure_time && <div style={{ fontSize: 12, color: T.gold, marginTop: 3 }}>{comp.departure_time}</div>}
            {comp.departure_date && <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{formatDateShort(comp.departure_date)}</div>}
          </div>
          <div style={{ flex: 1, textAlign: 'center' as const }}>
            <div style={{ position: 'relative', height: 1, background: T.goldBorder }}>
              <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 11, color: T.gold, background: T.surface, padding: '0 6px' }}>✈</span>
            </div>
            {dur && <div style={{ fontSize: 10, color: T.textDim, marginTop: 5 }}>{dur}</div>}
            {stops === 0 ? <div style={{ fontSize: 9, color: T.green, marginTop: 2, letterSpacing: '0.1em' }}>DIRECT</div>
              : <div style={{ fontSize: 9, color: T.amber, marginTop: 2, letterSpacing: '0.1em' }}>{stops} STOP{stops > 1 ? 'S' : ''}</div>}
          </div>
          <div style={{ textAlign: 'center' as const, minWidth: 60 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: T.text, lineHeight: 1 }}>{comp.to}</div>
            {comp.arrival_time && <div style={{ fontSize: 12, color: T.gold, marginTop: 3 }}>{comp.arrival_time}</div>}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: T.text, marginBottom: 10 }}>{comp.name || 'Flight details to be confirmed'}</div>
      )}

      {comp.price_display_usd > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: `0.5px solid ${T.border}` }}>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: T.text }}>{fmtUSD(comp.price_display_usd)}</div>
            <div style={{ fontSize: 10, color: T.textDim }}>per person · incl. taxes</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Day Divider ──────────────────────────────────────────────────────────────
function DayMarker({ date, dayNum, label }: { date?: string; dayNum: number; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0 12px' }}>
      <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: `0.5px solid ${T.goldBorder}`, background: T.goldDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: T.gold }}>
        {dayNum}
      </div>
      <div>
        {date && <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{formatDayDate(date)}</div>}
        {!date && label && <div style={{ fontSize: 12, color: T.textDim, letterSpacing: '0.1em' }}>{label}</div>}
        {!date && !label && <div style={{ fontSize: 12, color: T.textDim, letterSpacing: '0.1em' }}>Day {dayNum}</div>}
      </div>
      <div style={{ flex: 1, height: '0.5px', background: T.border }} />
    </div>
  )
}

// ─── Side column content ──────────────────────────────────────────────────────
function LeftColumn({ components }: { components: any[] }) {
  const hotels = components.filter(c => c.pillar === 'hotel' || c.type === 'accommodation')
  if (!hotels.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
      <div style={{ fontSize: 8, color: T.textDim, letterSpacing: '0.38em', textTransform: 'uppercase' as const, marginBottom: 20, paddingBottom: 12, borderBottom: `0.5px solid ${T.border}` }}>
        Your Destinations
      </div>
      {hotels.map((hotel, i) => {
        const dest = hotel.destination || hotel.region || hotel.region_label || ''
        const nights = hotel.nights || hotel.duration_nights || 0
        const fact = hotel.fun_fact || ''
        return (
          <div key={i} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: i < hotels.length - 1 ? `0.5px solid ${T.border}` : 'none' }}>
            {/* Destination */}
            <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.24em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              {dest}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: T.text, lineHeight: 1.3, marginBottom: 4 }}>
              {hotel.name}
            </div>
            {nights > 0 && (
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: fact ? 8 : 0 }}>{nightsLabel(nights)}</div>
            )}
            {fact && (
              <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6, fontStyle: 'italic' }}>
                "{fact.length > 100 ? fact.slice(0, 100) + '…' : fact}"
              </div>
            )}
            {hotel.malaria_free && (
              <div style={{ marginTop: 6, fontSize: 9, color: T.green, letterSpacing: '0.12em' }}>Malaria-Free</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RightColumn({ components }: { components: any[] }) {
  const activities = components.filter(c => c.pillar === 'activity' || c.type === 'activity')
  const hotels     = components.filter(c => c.pillar === 'hotel' || c.type === 'accommodation')
  // Collect inclusions from all hotels as experience highlights
  const allInclusions = [...new Set(
    hotels.flatMap(h => (h.inclusions || []) as string[])
  )].slice(0, 12)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
      <div style={{ fontSize: 8, color: T.textDim, letterSpacing: '0.38em', textTransform: 'uppercase' as const, marginBottom: 20, paddingBottom: 12, borderBottom: `0.5px solid ${T.border}` }}>
        Your Experiences
      </div>

      {activities.length > 0 && (
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Selected</div>
          {activities.map((act, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 1.5, height: 12, background: T.gold, flexShrink: 0, marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.3 }}>{act.name}</div>
                {act.region_label && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{act.region_label}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {allInclusions.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Always Included</div>
          {allInclusions.map((inc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 3, height: 3, background: T.gold, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: T.textMid }}>{formatInclusion(inc)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Checkout Form ────────────────────────────────────────────────────────
function CheckoutForm() {
  const params      = useSearchParams()
  const itineraryId = params.get('id')

  const [itinerary,   setItinerary]   = useState<any>(null)
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [mode,        setMode]        = useState<'deposit' | 'hold' | 'quote'>('deposit')
  const [depositPct,  setDepositPct]  = useState(30)
  const [form,        setForm]        = useState({ name: '', email: '', phone: '', nationality: '' })
  const [emailError,  setEmailError]  = useState('')
  const [natSearch,   setNatSearch]   = useState('')
  const [showDrop,    setShowDrop]    = useState(false)
  const [filteredNat, setFilteredNat] = useState<string[]>([])
  const [scrolled,    setScrolled]    = useState(false)
  const [expandModal, setExpandModal] = useState<{ images: { url: string; label?: string | null }[]; propertyName: string; roomType: string; index: number } | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!itineraryId) { setLoading(false); setError('No journey ID — please go back.'); return }
    fetch(`/api/itinerary?id=${itineraryId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setItinerary(d.itinerary); else setError('Journey not found.') })
      .catch(() => setError('Could not load journey.'))
      .finally(() => setLoading(false))
  }, [itineraryId])

  useEffect(() => {
    if (natSearch.length > 0) {
      setFilteredNat(NATIONALITIES.filter(n => n.toLowerCase().startsWith(natSearch.toLowerCase())))
      setShowDrop(true)
    } else { setFilteredNat([]); setShowDrop(false) }
  }, [natSearch])

  const validateEmail = (e: string) => {
    if (!e) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email'
    return ''
  }

  const handleAction = async () => {
    const emailErr = validateEmail(form.email)
    if (!form.name) { setError('Please enter your full name'); return }
    if (emailErr) { setEmailError(emailErr); setError('Please fix the errors above'); return }
    if (!form.nationality) { setError('Please select your nationality'); return }
    if (!itinerary?.id) { setError('Journey not loaded — please go back'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary_id: itinerary.id, traveller_email: form.email, traveller_name: form.name, traveller_phone: form.phone, traveller_nationality: form.nationality, deposit_pct: depositPct, action: mode }),
      })
      const data = await res.json()
      if (mode === 'quote') {
        if (data.success) window.location.href = `/booking/confirmed?ref=${data.booking_ref}&type=quote`
        else setError(data.error || 'Could not send quote')
      } else if (mode === 'hold') {
        if (data.success) window.location.href = `/booking/confirmed?ref=${data.booking_ref}&type=hold`
        else setError(data.error || 'Could not hold booking')
      } else {
        if (data.success && data.payfast_url) window.location.href = data.payfast_url
        else setError(data.error || 'Could not process payment — please try again')
      }
    } catch { setError('Connection error — please try again') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.3)', transform: 'rotate(45deg)', animation: 'spin 4s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 20, background: T.gold, transform: 'rotate(45deg)' }} />
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: T.gold }}>Loading your journey…</div>
    </div>
  )

  if (error && !itinerary) return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' as const }}>
      <div style={{ color: T.red, fontSize: 14, marginBottom: 20 }}>{error}</div>
      <a href="/plan" style={{ color: T.gold, fontSize: 12 }}>← Back to journey planner</a>
    </div>
  )

  const components: any[] = itinerary?.components || []
  const total    = itinerary?.total_display_zar || 0
  const totalUSD = itinerary?.total_display_usd || Math.round(total / 18.5)
  const nights   = itinerary?.nights || 0
  const adults   = itinerary?.adults || 2
  const checkIn  = itinerary?.check_in || itinerary?.date_from || ''
  const checkOut = itinerary?.check_out || itinerary?.date_to  || ''

  const sequence = buildChronologicalSequence(components)

  const flights    = components.filter(c => c.type === 'flight' || c.pillar === 'flight')
  const transfers  = components.filter(c => { const t = (c.type || c.component_type || c.pillar || '').toLowerCase(); return (t.includes('transfer') || t === 'transport') && !t.includes('flight') })
  const flightTotal   = flights.reduce((s, c) => s + (c.price_display_zar || 0), 0)
  const transferTotal = transfers.reduce((s, c) => s + (c.price_display_zar || 0), 0)
  const landTotal     = total - flightTotal - transferTotal
  const depositOnLand = Math.round(landTotal * (depositPct / 100))
  const depositTotal  = depositOnLand + flightTotal + transferTotal
  const balance       = total - depositTotal

  // Assign day numbers
  let dayCounter = 1
  const sequenceWithDays = sequence.map(item => {
    if (item._seq === 'hotel') {
      const d = dayCounter
      dayCounter += (item.nights || item.duration_nights || 1)
      return { ...item, _dayStart: d }
    }
    return item
  })

  return (
    <div style={{ fontFamily: "'Jost', 'DM Sans', sans-serif" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '56px 24px 36px', borderBottom: `0.5px solid ${T.border}`, textAlign: 'center' as const }}>
        <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.5em', textTransform: 'uppercase' as const, fontWeight: 200, marginBottom: 14 }}>
          Review &amp; Confirm Your Journey
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 'clamp(30px,5vw,50px)', color: T.text, margin: '0 0 12px', lineHeight: 1.1 }}>
          Your <em style={{ color: T.gold, fontStyle: 'italic' }}>{nightsLabel(nights)}</em> journey
        </h1>
        {(checkIn || adults) && (
          <div style={{ fontSize: 13, color: T.textDim, letterSpacing: '0.1em' }}>
            {checkIn && checkOut && `${formatDateShort(checkIn)} — ${formatDateShort(checkOut)}`}
            {checkIn && checkOut && adults ? ' · ' : ''}
            {adults ? `${adults} traveller${adults !== 1 ? 's' : ''}` : ''}
          </div>
        )}
      </div>

      {/* ── 3-column layout wrapper ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'clamp(160px,16vw,200px) 1fr clamp(160px,16vw,200px)', maxWidth: 1200, margin: '0 auto' }}>

        {/* LEFT COLUMN */}
        <div style={{ background: T.sideCol, borderRight: `0.5px solid ${T.border}`, padding: '40px 20px', minHeight: '100%' }}
          className="side-col-hide">
          <LeftColumn components={components} />
        </div>

        {/* CENTER COLUMN */}
        <div style={{ padding: '0 28px 120px' }}>

          {/* Journey Specialist */}
          <div style={{ margin: '32px 0', background: T.surface, border: `0.5px solid ${T.goldBorder}`, borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80" alt="Specialist" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${T.goldBorder}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: T.gold, marginBottom: 1 }}>Sarah Mitchell</div>
              <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                Senior Safari Specialist · {itinerary?.title || 'Your Safari'}
              </div>
              <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.65, fontStyle: 'italic' }}>
                "I'll personally review your journey before your deposit is processed and confirm every lodge and transfer detail with you within 2 hours."
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
                <span style={{ fontSize: 11, color: T.green, letterSpacing: '0.08em' }}>Available now · WhatsApp &amp; email</span>
              </div>
            </div>
          </div>

          <Divider />

          {/* ── Chronological Journey ──────────────────────────────────── */}
          {sequenceWithDays.length > 0 && (
            <Section label="Your Journey — Day by Day">
              {sequenceWithDays.map((item, i) => {
                if (item._seq === 'intl-flight') {
                  const isLast = item._dir === 'return'
                  return (
                    <div key={i}>
                      {isLast && <DayMarker label="Homeward Journey" dayNum={nightsLabel(nights).replace(' nights','').replace(' night','') as any} />}
                      <FlightCard comp={item} />
                    </div>
                  )
                }
                if (item._seq === 'hotel') {
                  const checkInDate = item.check_in || item.date_from || (checkIn && item._dayStart ? addDays(checkIn, item._dayStart - 1) : '')
                  return (
                    <div key={i}>
                      <DayMarker date={checkInDate} dayNum={item._dayStart || i + 1} />
                      <LodgeCard comp={item} onExpand={(imgs, name, rt, idx) => setExpandModal({ images: imgs, propertyName: name, roomType: rt, index: idx })} />
                    </div>
                  )
                }
                if (item._seq === 'transfer') {
                  return <TransferCard key={i} comp={item} />
                }
                if (item._seq === 'charter') {
                  return <div key={i} style={{ margin: '8px 0' }}><FlightCard comp={item} /></div>
                }
                return (
                  <div key={i} style={{ padding: '12px 16px', margin: '4px 0', background: T.surface, borderRadius: 8, border: `0.5px solid ${T.border}`, fontSize: 13, color: T.textMid }}>
                    {item.name || item.description || 'Journey component'}
                  </div>
                )
              })}
            </Section>
          )}

          <Divider />

          {/* Availability notice */}
          <div style={{ background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, borderRadius: 10, padding: '14px 18px', marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: T.amber, fontWeight: 500, marginBottom: 4 }}>Availability &amp; Price Notice</div>
            <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.75)', lineHeight: 1.65 }}>
              Property availability cannot be guaranteed until confirmed by your Journey Specialist. Flight prices are live and may change within 48 hours. Your specialist confirms every detail before any charge is applied.
            </div>
          </div>

          {/* Payment Summary */}
          <Section label="Payment Summary">
            <div style={{ background: T.surface, border: `0.5px solid ${T.goldBorder}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '20px 22px', borderBottom: `0.5px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: T.textMid }}>Total journey value</span>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, color: T.text }}>{fmtUSD(totalUSD)}</div>
                    {total > 0 && <div style={{ fontSize: 11, color: T.textDim }}>{fmtZAR(total)} ZAR</div>}
                  </div>
                </div>
              </div>
              {(flightTotal > 0 || transferTotal > 0) && (
                <div style={{ padding: '14px 22px', borderBottom: `0.5px solid ${T.border}` }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Charged in full today</div>
                  {flightTotal > 0 && <PayRow label="Flights" usd={Math.round(flightTotal / 18.5)} zar={flightTotal} note="Full amount" />}
                  {transferTotal > 0 && <PayRow label="Transfers" usd={Math.round(transferTotal / 18.5)} zar={transferTotal} note="Full amount" />}
                </div>
              )}
              {landTotal > 0 && (
                <div style={{ padding: '16px 22px', borderBottom: `0.5px solid ${T.border}` }}>
                  <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.2em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Accommodation &amp; experiences — deposit</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: T.textMid }}>Pay {depositPct}% today</span>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: T.gold }}>{fmtUSD(Math.round(depositOnLand / 18.5))}</span>
                  </div>
                  <input type="range" min={30} max={100} step={5} value={depositPct} onChange={e => setDepositPct(Number(e.target.value))} style={{ width: '100%', accentColor: T.gold, cursor: 'pointer', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: T.textDim }}>Minimum 30%</span>
                    <span style={{ fontSize: 10, color: T.textDim }}>Pay in full</span>
                  </div>
                </div>
              )}
              <div style={{ padding: '18px 22px', background: T.goldDim, borderBottom: `0.5px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.gold }}>Due today</div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Flights + transfers in full, {depositPct}% on accommodation</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: T.gold }}>{fmtUSD(Math.round(depositTotal / 18.5))}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{fmtZAR(depositTotal)}</div>
                  </div>
                </div>
              </div>
              {depositPct < 100 && balance > 0 && (
                <div style={{ padding: '14px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: T.textMid }}>Balance remaining</div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Due {balanceDueDate(checkIn)} — 30 days before travel</div>
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.textMid }}>{fmtUSD(Math.round(balance / 18.5))}</div>
                  </div>
                </div>
              )}
              {depositPct >= 100 && (
                <div style={{ padding: '14px 22px', textAlign: 'center' as const }}>
                  <span style={{ fontSize: 12, color: T.green }}>Paid in full — no balance due</span>
                </div>
              )}
            </div>
          </Section>

          {/* Action tabs */}
          <Section label="How would you like to proceed?">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {[
                { key: 'deposit', label: 'Pay Deposit',    sub: 'Secure your journey now',    icon: '✦' },
                { key: 'hold',    label: 'Hold for 48hrs', sub: 'Lock dates, no payment yet',  icon: '⏳' },
                { key: 'quote',   label: 'Email Quote',    sub: 'Receive full quote by email', icon: '✉' },
              ].map(opt => (
                <button key={opt.key} onClick={() => setMode(opt.key as any)} style={{ padding: '14px 12px', border: `0.5px solid ${mode === opt.key ? T.goldBorderBright : T.border}`, borderRadius: 10, background: mode === opt.key ? T.goldDim : T.surface, color: mode === opt.key ? T.gold : T.textMid, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.2s', fontFamily: "'Jost', sans-serif" }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{opt.sub}</div>
                </button>
              ))}
            </div>
            {mode === 'hold' && (
              <div style={{ background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.amber, lineHeight: 1.65 }}>
                A 48-hour hold reserves your dates but does <strong>not</strong> guarantee availability. Flight prices will change. Your specialist will contact you within 2 hours.
              </div>
            )}
            {mode === 'quote' && (
              <div style={{ background: 'rgba(96,165,250,0.06)', border: '0.5px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.blue, lineHeight: 1.65 }}>
                A full PDF quote with pricing breakdown will be sent to your email. Prices are valid for 48 hours. Your Journey Specialist will follow up within 2 hours.
              </div>
            )}
          </Section>

          {/* Traveller Details */}
          <Section label="Your Details">
            <div ref={formRef} style={{ display: 'grid', gap: 14 }}>
              <FormField label="Full name" placeholder="As it appears on your passport" value={form.name} onChange={(v: string) => setForm(f => ({ ...f, name: v }))} />
              <FormField label="Email address" type="email" placeholder="name@example.com" value={form.email} error={emailError} onChange={(v: string) => { setForm(f => ({ ...f, email: v })); if (emailError) setEmailError(validateEmail(v)) }} onBlur={() => setEmailError(validateEmail(form.email))} />
              <FormField label="Mobile number" type="tel" placeholder="+44, +1, +27 — international format" value={form.phone} onChange={(v: string) => setForm(f => ({ ...f, phone: v }))} />
              <div style={{ position: 'relative' as const }}>
                <label style={labelStyle}>Nationality</label>
                <input type="text" placeholder="Type to search (e.g. British)" value={natSearch} onChange={e => { setNatSearch(e.target.value); setForm(f => ({ ...f, nationality: '' })) }} onFocus={() => { if (natSearch.length > 0) setShowDrop(true) }} onBlur={() => setTimeout(() => setShowDrop(false), 150)} style={inputStyle(false)} />
                {showDrop && filteredNat.length > 0 && (
                  <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1c1c1c', border: `0.5px solid ${T.goldBorder}`, borderRadius: 9, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                    {filteredNat.map(n => (
                      <div key={n} onMouseDown={() => { setForm(f => ({ ...f, nationality: n })); setNatSearch(n); setShowDrop(false) }} style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: T.text, borderBottom: `0.5px solid ${T.border}` }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,110,0.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{n}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {error && (
            <div style={{ background: T.redDim, border: `0.5px solid ${T.redBorder}`, borderRadius: 9, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: T.red, lineHeight: 1.55 }}>{error}</div>
          )}

          <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center' as const, marginBottom: 20, letterSpacing: '0.08em', lineHeight: 1.7 }}>
            Secure payment via PayFast · South African Rands · ASATA registered · SSL encrypted
          </div>

          <button onClick={handleAction} disabled={submitting || !itinerary || total === 0} style={{ width: '100%', padding: '18px', background: submitting || !itinerary || total === 0 ? 'rgba(200,169,110,0.25)' : mode === 'quote' ? 'transparent' : `linear-gradient(135deg, ${T.goldBright}, ${T.goldLight})`, border: mode === 'quote' ? `0.5px solid ${T.goldBorder}` : 'none', borderRadius: 10, color: mode === 'quote' ? T.gold : '#0a0a0a', fontSize: 15, fontWeight: 600, cursor: submitting || !itinerary || total === 0 ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif", letterSpacing: '0.06em', transition: 'all 0.2s' }}>
            {submitting ? 'Processing…' : mode === 'quote' ? '✉ Send me this quote →' : mode === 'hold' ? '⏳ Hold my journey →' : total > 0 ? `Pay ${depositPct >= 100 ? 'in Full' : 'Deposit'} ${fmtUSD(Math.round(depositTotal / 18.5))} →` : 'Loading journey…'}
          </button>

          <div style={{ textAlign: 'center' as const, marginTop: 14, fontSize: 11, color: T.textDim, letterSpacing: '0.08em' }}>
            {mode === 'deposit' ? "You will be redirected to PayFast's secure payment page" : mode === 'hold' ? 'No payment taken · Your specialist will be in touch within 2 hours' : 'Quote sent to your email · Valid for 48 hours'}
          </div>

        </div>{/* end center column */}

        {/* RIGHT COLUMN */}
        <div style={{ background: T.sideCol, borderLeft: `0.5px solid ${T.border}`, padding: '40px 20px', minHeight: '100%' }}
          className="side-col-hide">
          <RightColumn components={components} />
        </div>

      </div>{/* end 3-col grid */}

      {/* ── Sticky bottom bar — info only, no duplicate CTA ──────────────── */}
      {scrolled && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(10,10,10,0.97)', borderTop: `0.5px solid ${T.goldBorder}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(12px)', zIndex: 40 }}>
          <div>
            <div style={{ fontSize: 9, color: T.textDim, letterSpacing: '0.16em', textTransform: 'uppercase' as const }}>
              {mode === 'deposit' ? 'Deposit due today' : mode === 'hold' ? '48-hour hold · no charge' : 'Email quote · free'}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: T.gold, marginTop: 1 }}>
              {mode === 'deposit' ? fmtUSD(Math.round(depositTotal / 18.5)) : mode === 'hold' ? 'No charge' : 'Free'}
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.textDim, textAlign: 'right' as const }}>
            <div>Scroll down to confirm</div>
            <div style={{ color: T.gold, marginTop: 2 }}>↓</div>
          </div>
        </div>
      )}

      {/* ── Expand modal ─────────────────────────────────────────────────── */}
      {expandModal && (
        <ExpandModal images={expandModal.images} propertyName={expandModal.propertyName} roomType={expandModal.roomType} initialIndex={expandModal.index} onClose={() => setExpandModal(null)} />
      )}

    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 9, color: T.gold, letterSpacing: '0.4em', textTransform: 'uppercase' as const, fontWeight: 200, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{label}</span>
        <div style={{ flex: 1, height: '0.5px', background: T.goldBorder }} />
      </div>
      {children}
    </div>
  )
}
function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '32px 0' }}>
      <div style={{ flex: 1, height: '0.5px', background: 'rgba(200,169,110,0.12)' }} />
      <div style={{ width: 5, height: 5, border: '0.5px solid rgba(200,169,110,0.4)', transform: 'rotate(45deg)' }} />
      <div style={{ flex: 1, height: '0.5px', background: 'rgba(200,169,110,0.12)' }} />
    </div>
  )
}
function PayRow({ label, usd, zar, note }: { label: string; usd: number; zar: number; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div><span style={{ fontSize: 12, color: T.textMid }}>{label}</span>{note && <span style={{ fontSize: 10, color: T.textDim, marginLeft: 8 }}>{note}</span>}</div>
      <div style={{ textAlign: 'right' as const }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: T.text }}>{fmtUSD(usd)}</span>
        <span style={{ fontSize: 10, color: T.textDim, marginLeft: 6 }}>{fmtZAR(zar)}</span>
      </div>
    </div>
  )
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 9, color: T.gold, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.28em', marginBottom: 7 }
const inputStyle = (hasError: boolean): React.CSSProperties => ({ width: '100%', padding: '13px 16px', background: T.surface, border: `0.5px solid ${hasError ? T.red : T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' })
function FormField({ label, type = 'text', placeholder, value, onChange, onBlur, error }: any) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} style={inputStyle(!!error)} />
      {error && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// ─── Page wrapper ──────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Jost', 'DM Sans', sans-serif", color: T.text }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(calc(45deg + 360deg)) } }
        input[type=range] { -webkit-appearance: none; height: 2px; border-radius: 1px; background: rgba(255,255,255,0.1); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #d4af37; cursor: pointer; border: 2px solid #0a0a0a; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(200,169,110,0.3); }
        @media (max-width: 900px) { .side-col-hide { display: none !important; } }
      `}</style>

      <div style={{ background: 'rgba(10,10,10,0.97)', borderBottom: '0.5px solid rgba(200,169,110,0.15)', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.7)', transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', inset: 6, background: 'rgba(200,169,110,0.85)', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 15, color: 'rgba(200,169,110,0.9)', letterSpacing: '0.06em' }}>The Safari Edition</div>
        </a>
        <a href="/plan" style={{ fontSize: 11, color: 'rgba(245,240,232,0.32)', textDecoration: 'none', letterSpacing: '0.14em' }}>← Back to journey</a>
      </div>

      <Suspense fallback={<div style={{ color: '#d4af37', textAlign: 'center', padding: 80, fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>Loading your journey…</div>}>
        <CheckoutForm />
      </Suspense>
    </div>
  )
}
