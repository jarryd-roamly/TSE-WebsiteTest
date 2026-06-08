'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function balanceDueDate(travelDate: string) {
  if (!travelDate) return '30 days before travel'
  const d = new Date(travelDate)
  d.setDate(d.getDate() - 30)
  return formatDate(d.toISOString())
}
function nightsLabel(n: number) { return `${n} night${n !== 1 ? 's' : ''}` }

// Type icons for components
function ComponentIcon({ type }: { type: string }) {
  const t = (type || '').toLowerCase()
  if (t.includes('flight') || t.includes('air')) return <span>✈</span>
  if (t.includes('transfer')) return <span>🚐</span>
  if (t.includes('activity') || t.includes('trek') || t.includes('gorilla')) return <span>🦁</span>
  if (t.includes('lodge') || t.includes('hotel') || t.includes('accommodation') || t.includes('camp')) return <span>🏕</span>
  return <span>✦</span>
}

const NATIONALITIES = ['Afghan','Albanian','Algerian','American','Andorran','Angolan','Argentine','Armenian','Australian','Austrian','Azerbaijani','Bahraini','Bangladeshi','Belarusian','Belgian','Belizean','Brazilian','British','Bruneian','Bulgarian','Cambodian','Cameroonian','Canadian','Chilean','Chinese','Colombian','Costa Rican','Croatian','Cuban','Czech','Danish','Dutch','Egyptian','Emirati','Estonian','Ethiopian','Finnish','French','Georgian','German','Ghanaian','Greek','Hungarian','Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian','Japanese','Jordanian','Kazakh','Kenyan','Korean','Kuwaiti','Latvian','Lebanese','Lithuanian','Malaysian','Maltese','Mauritian','Mexican','Mongolian','Moroccan','Namibian','Nepalese','New Zealander','Nigerian','Norwegian','Pakistani','Peruvian','Filipino','Polish','Portuguese','Romanian','Russian','Rwandan','Saudi','Singaporean','South African','Spanish','Sri Lankan','Sudanese','Swedish','Swiss','Tanzanian','Thai','Turkish','Ugandan','Ukrainian','Venezuelan','Vietnamese','Zambian','Zimbabwean']

// ─── Component renderers ──────────────────────────────────────────────────────

function TransferStrip({ comp }: { comp: any }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 18px', margin: '8px 0',
      background: 'rgba(200,169,110,0.04)',
      border: `0.5px solid rgba(200,169,110,0.15)`,
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 16, opacity: 0.7 }}>✈</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: T.textMid, letterSpacing: '0.06em' }}>
          {comp.name || comp.description || `Transfer to ${comp.destination || comp.to || 'next destination'}`}
        </div>
        {comp.duration && (
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{comp.duration}</div>
        )}
      </div>
      <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
        {comp.confirmation_status === 'confirmed' ? 'Confirmed' :
         comp.confirmation_status === 'specialist' ? 'Confirmed by specialist' :
         comp.price_display_usd ? fmtUSD(comp.price_display_usd) : 'Included'}
      </div>
    </div>
  )
}

function FlightCard({ comp }: { comp: any }) {
  return (
    <div style={{
      padding: '16px 18px', margin: '8px 0',
      background: T.surface,
      border: `0.5px solid ${T.goldBorder}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>✈</span>
        <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.22em', textTransform: 'uppercase' as const }}>
          {comp.is_international ? 'International Flight' : 'Charter / Regional Flight'}
        </div>
      </div>
      <div style={{ fontSize: 14, color: T.text, marginBottom: 4 }}>
        {comp.name || comp.route || comp.description || 'Flight details to be confirmed'}
      </div>
      {comp.airline && <div style={{ fontSize: 12, color: T.textDim }}>{comp.airline}</div>}
      {comp.departure_date && (
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 6 }}>
          {formatDateShort(comp.departure_date)}
          {comp.departure_time && ` · Departs ${comp.departure_time}`}
          {comp.arrival_time && ` · Arrives ${comp.arrival_time}`}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${T.border}` }}>
        <div style={{ fontSize: 10, color: T.amber, letterSpacing: '0.12em', background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, padding: '3px 8px', borderRadius: 4 }}>
          Price valid 48hrs · may change
        </div>
        {comp.price_display_usd && (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.text }}>
            {fmtUSD(comp.price_display_usd)}
            <span style={{ fontSize: 11, color: T.textDim, marginLeft: 4 }}>/ person</span>
          </div>
        )}
      </div>
    </div>
  )
}

function LodgeCard({ comp, isLast }: { comp: any; isLast: boolean }) {
  const nights = comp.nights || comp.duration_nights || 0
  const img = comp.hero_image_url || comp.image_url || comp.images?.[0]

  return (
    <div style={{
      borderRadius: 12,
      overflow: 'hidden',
      border: `0.5px solid ${T.goldBorder}`,
      marginBottom: isLast ? 0 : 8,
      background: T.surface,
    }}>
      {/* Hero image */}
      {img && (
        <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
          <img src={img} alt={comp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: T.text }}>
              {comp.destination || comp.region}
            </div>
            {nights > 0 && (
              <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.22em', textTransform: 'uppercase' as const, marginTop: 2 }}>
                {nightsLabel(nights)}
              </div>
            )}
          </div>
          {comp.price_display_usd && (
            <div style={{ position: 'absolute', top: 14, right: 14, textAlign: 'right' as const }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.text }}>
                {fmtUSD(comp.price_display_usd)}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.55)', letterSpacing: '0.1em' }}>lodge total</div>
            </div>
          )}
        </div>
      )}

      {/* Lodge detail */}
      <div style={{ padding: '14px 18px' }}>
        {/* Dates strip */}
        {(comp.check_in || comp.date_from) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 12, color: T.textMid }}>
            <span>● Arrive <strong style={{ color: T.text }}>{formatDateShort(comp.check_in || comp.date_from)}</strong></span>
            <span style={{ color: T.textDim }}>·</span>
            <span>Depart <strong style={{ color: T.text }}>{formatDateShort(comp.check_out || comp.date_to)}</strong></span>
          </div>
        )}

        {/* Lodge name + price row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {comp.thumbnail_url && (
            <img src={comp.thumbnail_url} alt={comp.name} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 500, marginBottom: 2 }}>
              {comp.name || comp.property_name}
            </div>
            <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.06em' }}>
              {[comp.location, comp.country].filter(Boolean).join(' · ')}
            </div>
            {comp.room_type && (
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 3 }}>{comp.room_type}</div>
            )}
            {comp.meal_basis && (
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{comp.meal_basis}</div>
            )}
          </div>
          {comp.price_per_night_usd && (
            <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: T.text }}>
                {fmtUSD(comp.price_per_night_usd)}
              </div>
              <div style={{ fontSize: 10, color: T.textDim }}>per night</div>
            </div>
          )}
        </div>

        {/* Trust score */}
        {comp.trust_score && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 10, color: T.textDim }}>Trust score</div>
            <div style={{ flex: 1, height: 2, background: T.border, borderRadius: 1 }}>
              <div style={{ width: `${comp.trust_score}%`, height: '100%', background: T.gold, borderRadius: 1 }} />
            </div>
            <div style={{ fontSize: 10, color: T.gold }}>{comp.trust_score}/100</div>
          </div>
        )}

        {/* Inclusions */}
        {comp.inclusions?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Included</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {comp.inclusions.slice(0, 5).map((inc: string, i: number) => (
                <span key={i} style={{ fontSize: 10, color: T.textMid, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.border}`, padding: '3px 8px', borderRadius: 4 }}>
                  {inc}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Activities */}
        {comp.activities?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Activities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {comp.activities.map((act: string, i: number) => (
                <span key={i} style={{ fontSize: 10, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.goldBorder}`, padding: '3px 8px', borderRadius: 4 }}>
                  {act}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Checkout Form ────────────────────────────────────────────────────────
function CheckoutForm() {
  const params = useSearchParams()
  const itineraryId = params.get('id')

  const [itinerary, setItinerary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'deposit' | 'hold' | 'quote'>('deposit')
  const [depositPct, setDepositPct] = useState(30)
  const [form, setForm] = useState({ name: '', email: '', phone: '', nationality: '' })
  const [emailError, setEmailError] = useState('')
  const [natSearch, setNatSearch] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [filteredNat, setFilteredNat] = useState<string[]>([])
  const [scrolled, setScrolled] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!itineraryId) { setLoading(false); setError('No journey ID — please go back and try again.'); return }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itinerary_id: itinerary.id,
          traveller_email: form.email,
          traveller_name: form.name,
          traveller_phone: form.phone,
          traveller_nationality: form.nationality,
          deposit_pct: depositPct,
          action: mode, // 'deposit', 'hold', or 'quote'
        }),
      })
      const data = await res.json()
      if (mode === 'quote') {
        // redirect to confirmed page with quote flag
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
        <div style={{ position: 'absolute', inset: 0, border: `1.5px solid rgba(200,169,110,0.3)`, transform: 'rotate(45deg)', animation: 'spin 4s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 10, border: `1px solid rgba(200,169,110,0.6)`, transform: 'rotate(45deg)', animation: 'spin 2.5s linear infinite reverse' }} />
        <div style={{ position: 'absolute', inset: 20, background: T.gold, transform: 'rotate(45deg)' }} />
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: T.gold, letterSpacing: '0.1em' }}>
        Loading your journey…
      </div>
    </div>
  )

  if (error && !itinerary) return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', textAlign: 'center' as const }}>
      <div style={{ color: T.red, fontSize: 14, marginBottom: 20 }}>{error}</div>
      <a href="/plan" style={{ color: T.gold, fontSize: 12, letterSpacing: '0.1em' }}>← Back to journey planner</a>
    </div>
  )

  // ── Parse itinerary data ────────────────────────────────────────────────────
  const components: any[] = itinerary?.components || []
  const total = itinerary?.total_display_zar || 0
  const totalUSD = itinerary?.total_display_usd || Math.round(total / 18.5) // fallback FX
  const nights = itinerary?.nights || 0
  const adults = itinerary?.adults || 2
  const checkIn = itinerary?.check_in || itinerary?.date_from || ''
  const checkOut = itinerary?.check_out || itinerary?.date_to || ''

  // Separate flights from lodges from transfers
  const flights = components.filter(c => {
    const t = (c.type || c.component_type || '').toLowerCase()
    return t.includes('flight') || t.includes('air') || c.is_flight
  })
  const transfers = components.filter(c => {
    const t = (c.type || c.component_type || '').toLowerCase()
    return (t.includes('transfer') || t === 'transport') && !t.includes('flight')
  })
  const lodges = components.filter(c => {
    const t = (c.type || c.component_type || '').toLowerCase()
    return t.includes('lodge') || t.includes('hotel') || t.includes('camp') || t.includes('accommodation') || t.includes('property')
  })
  // Fallback: if no categorised components, treat all as mixed
  const mixed = (flights.length + transfers.length + lodges.length === 0) ? components : []

  // Payment maths
  const flightTotal = flights.reduce((s: number, c: any) => s + (c.price_display_zar || 0), 0)
  const transferTotal = transfers.reduce((s: number, c: any) => s + (c.price_display_zar || 0), 0)
  const landTotal = total - flightTotal - transferTotal
  const depositPctOf = depositPct / 100
  const depositOnLand = Math.round(landTotal * depositPctOf)
  const depositOnFlights = flightTotal // flights always paid in full upfront
  const depositOnTransfers = transferTotal // transfers always paid in full upfront
  const depositTotal = depositOnLand + depositOnFlights + depositOnTransfers
  const balance = total - depositTotal
  const travelDate = checkIn

  return (
    <div style={{ fontFamily: "'Jost', 'DM Sans', sans-serif" }}>

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center' as const,
        padding: '56px 24px 40px',
        borderBottom: `0.5px solid ${T.border}`,
        position: 'relative',
      }}>
        <div style={{
          fontSize: 10, color: T.gold, letterSpacing: '0.5em', textTransform: 'uppercase' as const,
          fontWeight: 200, marginBottom: 14,
        }}>
          Confirming your journey
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif", fontWeight: 300,
          fontSize: 'clamp(32px, 5vw, 52px)', color: T.text,
          margin: '0 0 12px', lineHeight: 1.1,
        }}>
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

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px 120px' }}>

        {/* ── Journey Specialist card ─────────────────────────────────────── */}
        <div style={{
          margin: '32px 0',
          background: T.surface,
          border: `0.5px solid ${T.goldBorder}`,
          borderRadius: 14,
          padding: '20px 22px',
          display: 'flex', gap: 16, alignItems: 'flex-start',
        }}>
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80"
            alt="Journey Specialist"
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${T.goldBorder}` }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: T.gold, marginBottom: 1 }}>
              Sarah Mitchell
            </div>
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              Senior Safari Specialist · {nightsLabel(nights)}{checkIn ? ` · ${itinerary?.title || 'Your Safari'}` : ''}
            </div>
            <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.65, fontStyle: 'italic' }}>
              "I'll personally review your journey before your deposit is processed and confirm every lodge and transfer detail with you within 2 hours."
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
              <span style={{ fontSize: 11, color: T.green, letterSpacing: '0.08em' }}>Available now · WhatsApp & email</span>
            </div>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <Divider />

        {/* ── Flight components ────────────────────────────────────────────── */}
        {flights.length > 0 && (
          <Section label="Flights">
            <div style={{ background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: T.amber, lineHeight: 1.55 }}>
              ⚠ Flight prices are held for 48 hours and may change. Flights are charged in full at time of booking.
            </div>
            {flights.map((c, i) => <FlightCard key={i} comp={c} />)}
          </Section>
        )}

        {/* ── Journey — lodges with transfers woven in ─────────────────────── */}
        {(lodges.length > 0 || transfers.length > 0) && (
          <Section label="Your Journey">
            {buildJourneySequence(lodges, transfers).map((item: any, i: number) => (
              item._isTransfer
                ? <TransferStrip key={i} comp={item} />
                : <LodgeCard key={i} comp={item} isLast={i === buildJourneySequence(lodges, transfers).length - 1} />
            ))}
          </Section>
        )}

        {/* Fallback: show mixed components generically */}
        {mixed.length > 0 && (
          <Section label="Your Journey">
            {mixed.map((c: any, i: number) => {
              const t = (c.type || c.component_type || '').toLowerCase()
              if (t.includes('transfer')) return <TransferStrip key={i} comp={c} />
              return <LodgeCard key={i} comp={c} isLast={i === mixed.length - 1} />
            })}
          </Section>
        )}

        <Divider />

        {/* ── Availability notice ───────────────────────────────────────────── */}
        <div style={{
          background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, borderRadius: 10,
          padding: '14px 18px', marginBottom: 28,
        }}>
          <div style={{ fontSize: 12, color: T.amber, fontWeight: 500, marginBottom: 4 }}>
            ⚠ Availability & Price Notice
          </div>
          <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.75)', lineHeight: 1.65 }}>
            Property availability cannot be guaranteed until confirmed by your Journey Specialist. Flight prices are live and may change within 48 hours. Your specialist will confirm every detail before any charge is applied.
          </div>
        </div>

        {/* ── Payment summary ───────────────────────────────────────────────── */}
        <Section label="Payment Summary">
          <div style={{ background: T.surface, border: `0.5px solid ${T.goldBorder}`, borderRadius: 14, overflow: 'hidden' }}>
            
            {/* Total value */}
            <div style={{ padding: '20px 22px', borderBottom: `0.5px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: T.textMid, letterSpacing: '0.08em' }}>Total journey value</span>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, color: T.text }}>
                    {fmtUSD(totalUSD)}
                  </div>
                  {total > 0 && <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{fmtZAR(total)} ZAR</div>}
                </div>
              </div>
            </div>

            {/* Breakdown */}
            {(flightTotal > 0 || transferTotal > 0) && (
              <div style={{ padding: '14px 22px', borderBottom: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
                  Charged in full today (flights & transfers)
                </div>
                {flightTotal > 0 && (
                  <PayRow label="Flights" usd={Math.round(flightTotal / 18.5)} zar={flightTotal} note="Full amount" />
                )}
                {transferTotal > 0 && (
                  <PayRow label="Transfers" usd={Math.round(transferTotal / 18.5)} zar={transferTotal} note="Full amount" />
                )}
              </div>
            )}

            {/* Deposit slider on accommodation */}
            {landTotal > 0 && (
              <div style={{ padding: '16px 22px', borderBottom: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
                  Accommodation & experiences — deposit
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: T.textMid }}>Pay {depositPct}% today</span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: T.gold }}>
                    {fmtUSD(Math.round(depositOnLand / 18.5))}
                  </span>
                </div>
                <input type="range" min={30} max={100} step={5} value={depositPct}
                  onChange={e => setDepositPct(Number(e.target.value))}
                  style={{ width: '100%', accentColor: T.gold, cursor: 'pointer', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: T.textDim }}>Minimum 30%</span>
                  <span style={{ fontSize: 10, color: T.textDim }}>Pay in full</span>
                </div>
              </div>
            )}

            {/* Total due today */}
            <div style={{ padding: '18px 22px', background: T.goldDim, borderBottom: `0.5px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 12, color: T.gold, letterSpacing: '0.08em' }}>Due today</div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Flights + transfers in full, {depositPct}% on accommodation</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: T.gold }}>
                    {fmtUSD(Math.round(depositTotal / 18.5))}
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{fmtZAR(depositTotal)}</div>
                </div>
              </div>
            </div>

            {/* Balance row */}
            {depositPct < 100 && balance > 0 && (
              <div style={{ padding: '14px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.textMid }}>Balance remaining</div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                      Due {balanceDueDate(travelDate)} — 30 days before travel
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: T.textMid }}>
                    {fmtUSD(Math.round(balance / 18.5))}
                  </div>
                </div>
              </div>
            )}
            {depositPct >= 100 && (
              <div style={{ padding: '14px 22px', textAlign: 'center' as const }}>
                <span style={{ fontSize: 12, color: T.green }}>✓ Paid in full — no balance due</span>
              </div>
            )}
          </div>
        </Section>

        {/* ── Action mode tabs ───────────────────────────────────────────────── */}
        <Section label="How would you like to proceed?">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {[
              { key: 'deposit', label: 'Pay Deposit', sub: 'Secure your journey now', icon: '✦' },
              { key: 'hold', label: 'Hold for 48hrs', sub: 'Lock dates, no payment yet', icon: '⏳' },
              { key: 'quote', label: 'Email Quote', sub: 'Receive full quote by email', icon: '✉' },
            ].map(opt => (
              <button key={opt.key}
                onClick={() => setMode(opt.key as any)}
                style={{
                  padding: '14px 12px', border: `0.5px solid ${mode === opt.key ? T.goldBorderBright : T.border}`,
                  borderRadius: 10, background: mode === opt.key ? T.goldDim : T.surface,
                  color: mode === opt.key ? T.gold : T.textMid,
                  cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.2s',
                  fontFamily: "'Jost', sans-serif",
                }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{opt.sub}</div>
              </button>
            ))}
          </div>

          {mode === 'hold' && (
            <div style={{ background: T.amberDim, border: `0.5px solid ${T.amberBorder}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.amber, lineHeight: 1.65 }}>
              ⚠ A 48-hour hold reserves your dates but does <strong>not</strong> guarantee availability. Property availability cannot be confirmed until a deposit is paid. Flight prices will change. Your specialist will contact you within 2 hours.
            </div>
          )}
          {mode === 'quote' && (
            <div style={{ background: 'rgba(96,165,250,0.06)', border: '0.5px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.blue, lineHeight: 1.65 }}>
              ✉ A full PDF quote with pricing breakdown will be sent to your email. Prices are valid for 48 hours. Your Journey Specialist will follow up within 2 hours to answer any questions.
            </div>
          )}
        </Section>

        {/* ── Traveller details ─────────────────────────────────────────────── */}
        <Section label="Your Details">
          <div ref={formRef} style={{ display: 'grid', gap: 14 }}>
            <FormField label="Full name" placeholder="As it appears on your passport"
              value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <FormField label="Email address" type="email" placeholder="name@example.com"
              value={form.email} error={emailError}
              onChange={v => { setForm(f => ({ ...f, email: v })); if (emailError) setEmailError(validateEmail(v)) }}
              onBlur={() => setEmailError(validateEmail(form.email))} />
            <FormField label="Mobile number" type="tel" placeholder="+44, +1, +27 — international format"
              value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />

            {/* Nationality autocomplete */}
            <div style={{ position: 'relative' as const }}>
              <label style={labelStyle}>Nationality</label>
              <input type="text" placeholder="Type to search (e.g. British)"
                value={natSearch}
                onChange={e => { setNatSearch(e.target.value); setForm(f => ({ ...f, nationality: '' })) }}
                onFocus={() => { if (natSearch.length > 0) setShowDrop(true) }}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                style={inputStyle(false)} />
              {showDrop && filteredNat.length > 0 && (
                <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1c1c1c', border: `0.5px solid ${T.goldBorder}`, borderRadius: 9, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                  {filteredNat.map(n => (
                    <div key={n}
                      onMouseDown={() => { setForm(f => ({ ...f, nationality: n })); setNatSearch(n); setShowDrop(false) }}
                      style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: T.text, borderBottom: `0.5px solid ${T.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,169,110,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {n}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ background: T.redDim, border: `0.5px solid ${T.redBorder}`, borderRadius: 9, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: T.red, lineHeight: 1.55 }}>
            {error}
          </div>
        )}

        {/* ── Security note ────────────────────────────────────────────────── */}
        <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center' as const, marginBottom: 20, letterSpacing: '0.08em', lineHeight: 1.7 }}>
          🔒 Secure payment via PayFast · South African Rands · ASATA registered · SSL encrypted
        </div>

        {/* ── CTA button ───────────────────────────────────────────────────── */}
        <button
          onClick={handleAction}
          disabled={submitting || !itinerary || total === 0}
          style={{
            width: '100%', padding: '18px',
            background: submitting || !itinerary || total === 0
              ? 'rgba(200,169,110,0.25)'
              : mode === 'quote'
              ? 'transparent'
              : `linear-gradient(135deg, ${T.goldBright}, ${T.goldLight})`,
            border: mode === 'quote' ? `0.5px solid ${T.goldBorder}` : 'none',
            borderRadius: 10, color: mode === 'quote' ? T.gold : '#0a0a0a',
            fontSize: 15, fontWeight: 600,
            cursor: submitting || !itinerary || total === 0 ? 'not-allowed' : 'pointer',
            fontFamily: "'Jost', sans-serif", letterSpacing: '0.06em',
            transition: 'all 0.2s',
          }}>
          {submitting ? 'Processing…' :
           mode === 'quote' ? '✉ Send me this quote →' :
           mode === 'hold' ? `⏳ Hold my journey →` :
           total > 0 ? `Pay ${depositPct >= 100 ? 'in Full' : 'Deposit'} ${fmtUSD(Math.round(depositTotal / 18.5))} →` :
           'Loading journey…'}
        </button>

        <div style={{ textAlign: 'center' as const, marginTop: 14, fontSize: 11, color: T.textDim, letterSpacing: '0.08em' }}>
          {mode === 'deposit' ? 'You will be redirected to PayFast\'s secure payment page' :
           mode === 'hold' ? 'No payment taken · Your specialist will be in touch within 2 hours' :
           'Quote sent to your email · Valid for 48 hours'}
        </div>

      </div>

      {/* ── Sticky bottom bar (mobile) ─────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(10,10,10,0.97)',
        borderTop: `0.5px solid ${T.goldBorder}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
        transform: scrolled ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
        display: typeof window !== 'undefined' && window.innerWidth > 768 ? 'none' : 'flex',
      }}>
        <div>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.1em' }}>
            {mode === 'deposit' ? 'Deposit due today' : mode === 'hold' ? '48-hour hold' : 'Full quote'}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: T.gold }}>
            {mode === 'deposit' ? fmtUSD(Math.round(depositTotal / 18.5)) : mode === 'hold' ? 'No charge' : 'Free'}
          </div>
        </div>
        <button
          onClick={handleAction}
          disabled={submitting}
          style={{
            padding: '12px 24px',
            background: mode === 'quote' ? 'transparent' : `linear-gradient(135deg, ${T.goldBright}, ${T.goldLight})`,
            border: mode === 'quote' ? `0.5px solid ${T.goldBorder}` : 'none',
            borderRadius: 8, color: mode === 'quote' ? T.gold : '#0a0a0a',
            fontSize: 13, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: "'Jost', sans-serif", letterSpacing: '0.06em',
          }}>
          {submitting ? '…' :
           mode === 'quote' ? 'Send quote →' :
           mode === 'hold' ? 'Hold →' :
           'Pay now →'}
        </button>
      </div>

    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function buildJourneySequence(lodges: any[], transfers: any[]) {
  // Interleave transfers between lodges based on order/index
  const result: any[] = []
  lodges.forEach((lodge, i) => {
    result.push(lodge)
    // Insert transfer after lodge if there's one matching this position
    const transfer = transfers[i]
    if (transfer) result.push({ ...transfer, _isTransfer: true })
  })
  // Any remaining transfers at the start (first mile)
  if (transfers.length > lodges.length) {
    transfers.slice(lodges.length).forEach(t => result.push({ ...t, _isTransfer: true }))
  }
  return result
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 10, color: T.gold, letterSpacing: '0.4em', textTransform: 'uppercase' as const,
        fontWeight: 200, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
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
      <div style={{ width: 5, height: 5, border: `0.5px solid rgba(200,169,110,0.4)`, transform: 'rotate(45deg)' }} />
      <div style={{ flex: 1, height: '0.5px', background: 'rgba(200,169,110,0.12)' }} />
    </div>
  )
}

function PayRow({ label, usd, zar, note }: { label: string; usd: number; zar: number; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div>
        <span style={{ fontSize: 12, color: T.textMid }}>{label}</span>
        {note && <span style={{ fontSize: 10, color: T.textDim, marginLeft: 8 }}>{note}</span>}
      </div>
      <div style={{ textAlign: 'right' as const }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: T.text }}>{fmtUSD(usd)}</span>
        <span style={{ fontSize: 10, color: T.textDim, marginLeft: 6 }}>{fmtZAR(zar)}</span>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, color: T.gold, fontWeight: 400,
  textTransform: 'uppercase', letterSpacing: '0.24em', marginBottom: 7,
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '13px 16px',
  background: T.surface, border: `0.5px solid ${hasError ? T.red : T.border}`,
  borderRadius: 8, color: T.text, fontSize: 14, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
})

function FormField({ label, type = 'text', placeholder, value, onChange, onBlur, error }: any) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        style={inputStyle(!!error)} />
      {error && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
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
      `}</style>

      {/* Header */}
      <div style={{
        background: 'rgba(10,10,10,0.97)', borderBottom: '0.5px solid rgba(200,169,110,0.15)',
        padding: '0 24px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.7)', transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', inset: 6, background: 'rgba(200,169,110,0.85)', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 15, color: 'rgba(200,169,110,0.9)', letterSpacing: '0.06em' }}>
            The Safari Edition
          </div>
        </a>
        <a href="/plan" style={{ fontSize: 11, color: 'rgba(245,240,232,0.32)', textDecoration: 'none', letterSpacing: '0.14em' }}>
          ← Back to journey
        </a>
      </div>

      <Suspense fallback={
        <div style={{ color: '#d4af37', textAlign: 'center', padding: 80, fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>
          Loading your journey…
        </div>
      }>
        <CheckoutForm />
      </Suspense>
    </div>
  )
}
