'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Design tokens — matching the main site exactly ─────────────────────────
const T = {
  bg: '#0a0a0a', bg2: '#111111', surface: '#1a1a1a',
  gold: '#d4af37', goldLight: '#f0c040',
  goldDim: 'rgba(212,175,55,0.12)', borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)', green: '#4ade80', red: '#f87171',
}

function fmtR(n: number) { return `R ${Math.round(n).toLocaleString()}` }

const INTEREST_RATE = 0.075

function calcFloatSaving(extra: number, travelDate: string) {
  if (!travelDate || extra <= 0) return 0
  const days = Math.max(0, Math.ceil((new Date(travelDate).getTime() - Date.now()) / 86400000))
  const balanceDays = Math.max(0, days - 30)
  return Math.round(extra * (INTEREST_RATE / 365) * balanceDays)
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function balanceDueLabel(travelDate: string, depositPct: number) {
  if (!travelDate) return '30 days before travel'
  if (depositPct >= 100) return 'Paid in full — no balance due'
  const d = new Date(travelDate)
  d.setDate(d.getDate() - 30)
  return `Due ${formatDate(d.toISOString())}`
}

const NATIONALITIES = ['Afghan','Albanian','Algerian','American','Andorran','Angolan','Argentine','Armenian','Australian','Austrian','Azerbaijani','Bahraini','Bangladeshi','Belarusian','Belgian','Belizean','Brazilian','British','Bruneian','Bulgarian','Cambodian','Cameroonian','Canadian','Chilean','Chinese','Colombian','Costa Rican','Croatian','Cuban','Czech','Danish','Dutch','Egyptian','Emirati','Estonian','Ethiopian','Finnish','French','Georgian','German','Ghanaian','Greek','Hungarian','Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian','Japanese','Jordanian','Kazakh','Kenyan','Korean','Kuwaiti','Latvian','Lebanese','Lithuanian','Malaysian','Maltese','Mauritian','Mexican','Mongolian','Moroccan','Namibian','Nepalese','New Zealander','Nigerian','Norwegian','Pakistani','Peruvian','Filipino','Polish','Portuguese','Romanian','Russian','Rwandan','Saudi','Singaporean','South African','Spanish','Sri Lankan','Sudanese','Swedish','Swiss','Tanzanian','Thai','Turkish','Ugandan','Ukrainian','Venezuelan','Vietnamese','Zambian','Zimbabwean']

function CheckoutForm() {
  const params       = useSearchParams()
  const itineraryId  = params.get('id')
  const [itinerary,  setItinerary]  = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [form,       setForm]       = useState({ name: '', email: '', phone: '', nationality: '' })
  const [emailError, setEmailError] = useState('')
  const [natSearch,  setNatSearch]  = useState('')
  const [showDrop,   setShowDrop]   = useState(false)
  const [filteredNat,setFilteredNat]= useState<string[]>([])
  const [depositPct, setDepositPct] = useState(30)

  useEffect(() => {
    if (!itineraryId) { setLoading(false); setError('No journey ID — please go back and try again.'); return }
    fetch(`/api/itinerary?id=${itineraryId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setItinerary(d.itinerary); else setError('Journey not found — please go back.') })
      .catch(() => setError('Could not load journey — please try again.'))
      .finally(() => setLoading(false))
  }, [itineraryId])

  useEffect(() => {
    if (natSearch.length > 0) {
      setFilteredNat(NATIONALITIES.filter(n => n.toLowerCase().startsWith(natSearch.toLowerCase())))
      setShowDrop(true)
    } else { setFilteredNat([]); setShowDrop(false) }
  }, [natSearch])

  const validateEmail = (e: string) => {
    if (!e) return 'Email address is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address'
    return ''
  }

  const handlePay = async () => {
    const emailErr = validateEmail(form.email)
    if (!form.name)        { setError('Please enter your full name'); return }
    if (emailErr)          { setEmailError(emailErr); setError('Please fix the errors above'); return }
    if (!form.nationality) { setError('Please select your nationality'); return }
    if (!itinerary?.id)    { setError('Journey not loaded — please go back'); return }
    setSubmitting(true); setError('')
    try {
      const res  = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itinerary_id:    itinerary.id,
          traveller_email: form.email,
          traveller_name:  form.name,
          deposit_pct:     depositPct,
        }),
      })
      const data = await res.json()
      if (data.success && data.payfast_url) { window.location.href = data.payfast_url }
      else setError(data.error || 'Could not process payment — please try again')
    } catch { setError('Connection error — please try again') }
    finally   { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ color: T.gold, textAlign: 'center', padding: 80, fontFamily: "'Cormorant Garamond',serif", fontSize: 20, letterSpacing: '0.08em' }}>
      Loading your journey…
    </div>
  )

  const total      = itinerary?.total_display_zar || 0
  const depositAmt = Math.round(total * depositPct / 100)
  const balanceAmt = total - depositAmt
  const travelDate = itinerary?.check_in || itinerary?.date_from || ''
  const extraPaid  = depositAmt - Math.round(total * 0.30)
  const floatSave  = calcFloatSaving(extraPaid, travelDate)
  const payingMore = depositPct > 30
  const payingFull = depositPct >= 100

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 80px' }}>

      {/* Journey title */}
      {itinerary?.title && (
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.44em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 10 }}>
            Your Journey
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(22px,4vw,32px)', color: T.text, lineHeight: 1.15, marginBottom: 6 }}>
            {itinerary.title}
          </div>
          {(itinerary.nights || itinerary.adults) && (
            <div style={{ fontSize: 12, color: T.textDim, letterSpacing: '0.12em' }}>
              {itinerary.nights && `${itinerary.nights} nights`}
              {itinerary.nights && itinerary.adults && ' · '}
              {itinerary.adults && `${itinerary.adults} traveller${itinerary.adults !== 1 ? 's' : ''}`}
              {travelDate && ` · ${formatDate(travelDate)}`}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{ flex: 1, height: '0.5px', background: 'rgba(200,169,110,0.15)' }} />
        <div style={{ width: 6, height: 6, border: '1px solid rgba(200,169,110,0.5)', transform: 'rotate(45deg)' }} />
        <div style={{ flex: 1, height: '0.5px', background: 'rgba(200,169,110,0.15)' }} />
      </div>

      {/* Price summary */}
      <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
          <span style={{ fontSize: 12, color: T.textMid, letterSpacing: '0.08em' }}>Total journey value</span>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 300, color: T.text }}>
            {total > 0 ? fmtR(total) : <span style={{ fontSize: 14, color: T.textDim }}>Loading…</span>}
          </span>
        </div>

        {/* Deposit slider */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: T.textMid, letterSpacing: '0.08em' }}>Pay today</span>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 300, color: T.gold }}>
              {fmtR(depositAmt)}
            </span>
          </div>
          <input type="range" min={30} max={100} step={5} value={depositPct}
            onChange={e => setDepositPct(Number(e.target.value))}
            style={{ width: '100%', accentColor: T.gold, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.1em' }}>Minimum 30%</span>
            <span style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.1em' }}>Pay in full</span>
          </div>
        </div>

        {/* Float saving nudge */}
        {payingMore && floatSave > 0 && (
          <div style={{ background: 'rgba(74,222,128,0.06)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: T.green, fontWeight: 500, marginBottom: 3 }}>
              ✦ {payingFull ? 'Paying in full' : 'Paying more now'} — save {fmtR(floatSave)}
            </div>
            <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.55 }}>
              {payingFull
                ? `Your full payment today saves ${fmtR(floatSave)} in early payment benefits — passed directly to you.`
                : `Paying ${fmtR(extraPaid)} more today saves ${fmtR(floatSave)} in early payment benefits.`}
            </div>
          </div>
        )}

        {/* Balance */}
        {!payingFull && (
          <div style={{ borderTop: `0.5px solid ${T.border}`, paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: T.textMid }}>Balance remaining</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, letterSpacing: '0.06em' }}>{balanceDueLabel(travelDate, depositPct)}</div>
              </div>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 300, color: T.textMid }}>{fmtR(balanceAmt)}</span>
            </div>
          </div>
        )}
        {payingFull && (
          <div style={{ borderTop: `0.5px solid ${T.border}`, paddingTop: 12, textAlign: 'center' as const }}>
            <span style={{ fontSize: 12, color: T.green }}>✓ Paid in full — no balance due</span>
          </div>
        )}
      </div>

      {/* Form */}
      <div style={{ marginBottom: 20 }}>
        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: T.gold, fontWeight: 400, textTransform: 'uppercase' as const, letterSpacing: '0.24em', marginBottom: 7 }}>Full name</label>
          <input type="text" placeholder="As on your passport" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ width: '100%', padding: '13px 16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: T.gold, fontWeight: 400, textTransform: 'uppercase' as const, letterSpacing: '0.24em', marginBottom: 7 }}>Email address</label>
          <input type="email" placeholder="name@example.com" value={form.email}
            onChange={e => { setForm(f => ({ ...f, email: e.target.value })); if (emailError) setEmailError(validateEmail(e.target.value)) }}
            onBlur={() => setEmailError(validateEmail(form.email))}
            style={{ width: '100%', padding: '13px 16px', background: T.surface, border: `0.5px solid ${emailError ? T.red : T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          {emailError && <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>{emailError}</div>}
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, color: T.gold, fontWeight: 400, textTransform: 'uppercase' as const, letterSpacing: '0.24em', marginBottom: 7 }}>Mobile number</label>
          <input type="tel" placeholder="+27 or international format" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            style={{ width: '100%', padding: '13px 16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
        </div>

        {/* Nationality */}
        <div style={{ marginBottom: 14, position: 'relative' as const }}>
          <label style={{ display: 'block', fontSize: 10, color: T.gold, fontWeight: 400, textTransform: 'uppercase' as const, letterSpacing: '0.24em', marginBottom: 7 }}>Nationality</label>
          <input type="text" placeholder="Type to search (e.g. South African)" value={natSearch}
            onChange={e => { setNatSearch(e.target.value); setForm(f => ({ ...f, nationality: '' })) }}
            onFocus={() => { if (natSearch.length > 0) setShowDrop(true) }}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            style={{ width: '100%', padding: '13px 16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          {showDrop && filteredNat.length > 0 && (
            <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1a1a1a', border: `0.5px solid ${T.borderGold}`, borderRadius: 9, zIndex: 100, maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              {filteredNat.map(n => (
                <div key={n} onMouseDown={() => { setForm(f => ({ ...f, nationality: n })); setNatSearch(n); setShowDrop(false) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: T.text, borderBottom: `0.5px solid ${T.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {n}
                </div>
              ))}
            </div>
          )}
          {natSearch.length > 0 && filteredNat.length === 0 && (
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>No match — try a different spelling</div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.28)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: T.red, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {/* Security note */}
      <div style={{ fontSize: 11, color: T.textDim, textAlign: 'center' as const, marginBottom: 20, letterSpacing: '0.08em', lineHeight: 1.6 }}>
        🔒 Secure payment via PayFast · South African Rands · ASATA registered
      </div>

      {/* Pay button */}
      <button onClick={handlePay} disabled={submitting || !itinerary || total === 0}
        style={{ width: '100%', padding: '17px', background: submitting || !itinerary || total === 0 ? 'rgba(212,175,55,0.3)' : `linear-gradient(135deg,${T.gold},${T.goldLight})`, color: '#0a0a0a', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: submitting || !itinerary || total === 0 ? 'not-allowed' : 'pointer', fontFamily: "'Jost',sans-serif", letterSpacing: '0.06em', transition: 'opacity 0.2s' }}>
        {submitting ? 'Processing…' : total > 0 ? `Pay ${payingFull ? 'in Full' : 'Deposit'} ${fmtR(depositAmt)} →` : 'Loading journey…'}
      </button>

      <div style={{ textAlign: 'center' as const, marginTop: 14, fontSize: 11, color: T.textDim, letterSpacing: '0.08em' }}>
        You will be redirected to PayFast's secure payment page
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Jost','DM Sans',sans-serif", color: '#f5f0e8' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:#d4af37; cursor:pointer; border:2px solid #0a0a0a; }
        input[type=range] { -webkit-appearance:none; height:2px; border-radius:1px; background:rgba(255,255,255,0.1); outline:none; }
        ::-webkit-scrollbar { width:2px; }
        ::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.3); }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(10,10,10,0.97)', borderBottom: '0.5px solid rgba(212,175,55,0.15)', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.7)', transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', inset: 6, background: 'rgba(200,169,110,0.85)', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 15, color: 'rgba(200,169,110,0.9)', letterSpacing: '0.06em' }}>
            The Safari Edition
          </div>
        </a>
        <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.28)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          Secure Checkout
        </div>
      </div>

      <Suspense fallback={
        <div style={{ color: '#d4af37', textAlign: 'center', padding: 60, fontFamily: "'Cormorant Garamond',serif", fontSize: 20 }}>
          Loading your journey…
        </div>
      }>
        <CheckoutForm />
      </Suspense>
    </div>
  )
}
