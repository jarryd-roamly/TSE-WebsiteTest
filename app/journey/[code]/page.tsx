'use client'

// ─────────────────────────────────────────────────────────────────────────────
// app/journey/[code]/page.tsx
// Journey mini-site — shareable post-booking page for the traveller.
// Styling: Cormorant Garamond + Jost · #0a0a0a background · consistent with
// checkout, confirmed, and landing pages. Fonts loaded globally by layout.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

// ── Design tokens — matches app/lib/theme.ts exactly ─────────────────────────
const T = {
  bg:         '#0a0a0a',
  bg2:        '#111111',
  bg3:        '#181818',
  surface:    '#1a1a1a',
  gold:       '#d4af37',
  goldLight:  '#f0c040',
  goldDim:    'rgba(212,175,55,0.12)',
  borderGold: 'rgba(212,175,55,0.28)',
  text:       '#f5f0e8',
  textMid:    'rgba(245,240,232,0.58)',
  textDim:    'rgba(245,240,232,0.32)',
  border:     'rgba(255,255,255,0.07)',
  green:      '#4ade80',
  red:        '#f87171',
  blue:       '#60a5fa',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number)       { return `R ${Math.round(n).toLocaleString()}` }
function daysUntil(d: string) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-ZA', { day:'numeric', month:'long', year:'numeric' })
}
function balanceDueDate(travelDate: string) {
  if (!travelDate) return null
  const d = new Date(travelDate)
  d.setDate(d.getDate() - 30)
  return fmtDate(d.toISOString())
}
function getHeadline(itinerary: any, booking: any, days: number | null) {
  const name = booking?.lead_traveller_snapshot?.name
  const first = name?.split(' ')[0]
  if (days === 0)       return first ? `Today is ${first}'s day. ✦` : 'Today is the day. ✦'
  if (days && days > 0) return first ? `${days} days until ${first}'s African adventure` : `${days} days until your African adventure`
  return first ? `${first}'s African Journey` : 'Your African Journey'
}
function pillarLabel(p: string) {
  return ({ hotel:'Lodge', lodge:'Lodge', flight:'Flight', charter:'Charter flight', transfer:'Transfer', activity:'Experience', spa:'Spa' }[p] || p)
}

// ── AI Chat ───────────────────────────────────────────────────────────────────
function AiChat({ itinerary, onClose }: { itinerary: any; onClose: () => void }) {
  const [msgs,    setMsgs]    = useState([{ role:'assistant', text:`Welcome! I'm here for any questions about your ${itinerary?.title||'safari'}. Ask anything — packing, what to expect, visas.` }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [hoff,    setHoff]    = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs])

  const TRIGGERS = ['are you human','real person','speak to someone','talk to someone','human agent','call me','phone','escalate']

  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim(); setInput('')
    if (TRIGGERS.some(t => msg.toLowerCase().includes(t))) {
      setMsgs(m => [...m, { role:'user', text:msg }, { role:'handoff', text:"Connecting you with your Journey Specialist on WhatsApp now." }])
      setHoff(true); return
    }
    setMsgs(m => [...m, { role:'user', text:msg }]); setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          model:'claude-haiku-4-5-20251001', max_tokens:300,
          system:`You are a safari specialist for The Safari Edition. Help with questions about the traveller's journey: ${JSON.stringify({ title:itinerary?.title, nights:itinerary?.nights })}. Be warm, specific, under 80 words. Direct complaints/price changes to their specialist.`,
          messages:[...msgs.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({ role:m.role, content:m.text })), { role:'user', content:msg }]
        })
      })
      const d = await res.json()
      setMsgs(m => [...m, { role:'assistant', text: d.content?.[0]?.text || "Let me check that with your specialist — shall I connect you?" }])
    } catch { setMsgs(m => [...m, { role:'assistant', text:"Having trouble connecting. Please WhatsApp your specialist directly." }]) }
    finally   { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', bottom:80, right:16, width:320, maxHeight:440, background:T.bg2, border:`0.5px solid ${T.borderGold}`, borderRadius:16, boxShadow:'0 16px 48px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', zIndex:1000, fontFamily:"'Jost',sans-serif" }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', borderBottom:`0.5px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:14, fontWeight:400, color:T.gold }}>✦ Journey Assistant</div>
          <div style={{ fontSize:10, color:T.textDim, marginTop:1 }}>Instant · Human specialist &lt;2 hours</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:T.textDim, cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
      </div>
      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'86%', padding:'8px 12px', borderRadius:10, fontSize:12, lineHeight:1.55,
              background: m.role==='user' ? T.goldDim : m.role==='handoff' ? 'rgba(74,222,128,0.08)' : T.surface,
              border: m.role==='handoff' ? '0.5px solid rgba(74,222,128,0.25)' : 'none',
              color: m.role==='handoff' ? T.green : T.text }}>
              {m.text}
              {m.role==='handoff' && (
                <a href="https://wa.me/27000000000" style={{ display:'block', marginTop:8, background:'rgba(74,222,128,0.12)', border:'0.5px solid rgba(74,222,128,0.25)', color:T.green, padding:'6px 12px', borderRadius:7, fontSize:11, textDecoration:'none', textAlign:'center' as const }}>
                  Open WhatsApp →
                </a>
              )}
            </div>
          </div>
        ))}
        {loading && <div style={{ display:'flex', justifyContent:'flex-start' }}><div style={{ background:T.surface, padding:'8px 14px', borderRadius:10, fontSize:12, color:T.textDim }}>Thinking…</div></div>}
        <div ref={endRef} />
      </div>
      {/* Input */}
      {!hoff && (
        <div style={{ padding:'10px 12px', borderTop:`0.5px solid ${T.border}`, display:'flex', gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
            placeholder="Ask anything about your journey…"
            style={{ flex:1, background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:7, padding:'8px 10px', color:T.text, fontSize:12, outline:'none', fontFamily:'inherit' }} />
          <button onClick={send} disabled={loading||!input.trim()}
            style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', borderRadius:7, padding:'8px 12px', color:'#0a0a0a', fontSize:13, fontWeight:600, cursor:'pointer' }}>→</button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JourneyPage() {
  const params = useParams()
  const code   = params.code as string
  const [itinerary, setItinerary] = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [timeLeft,  setTimeLeft]  = useState('')
  const [copied,    setCopied]    = useState(false)
  const [chatOpen,  setChatOpen]  = useState(false)

  useEffect(() => {
    if (!code) return
    fetch(`/api/itinerary?code=${code}`)
      .then(r => r.json())
      .then(d => { if (d.success) setItinerary(d.itinerary); else setError('Journey not found') })
      .catch(() => setError('Could not load journey'))
      .finally(() => setLoading(false))
  }, [code])

  useEffect(() => {
    if (!itinerary?.quote_expires_at || itinerary.status==='confirmed') return
    const tick = () => {
      const diff = new Date(itinerary.quote_expires_at).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Expired'); return }
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000)
      setTimeLeft(`${h}h ${m}m ${s}s`)
    }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [itinerary])

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Jost',sans-serif" }}>
      <div style={{ textAlign:'center' as const }}>
        <div style={{ width:10, height:10, border:`1.5px solid rgba(212,175,55,0.5)`, transform:'rotate(45deg)', margin:'0 auto 16px', animation:'glow 2s ease-in-out infinite' }} />
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:20, color:T.gold, letterSpacing:'0.06em' }}>
          Loading your journey…
        </div>
      </div>
    </div>
  )

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !itinerary) return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:24, fontFamily:"'Jost',sans-serif" }}>
      <div style={{ fontSize:24, color:T.gold }}>✦</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:24, color:T.gold }}>Journey not found</div>
      <div style={{ fontSize:13, color:T.textDim, textAlign:'center' as const, maxWidth:320 }}>
        The link may have expired or the reference is incorrect.
      </div>
      <a href="/" style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, padding:'10px 22px', borderRadius:6, fontSize:13, textDecoration:'none', letterSpacing:'0.04em' }}>
        Plan a new journey →
      </a>
    </div>
  )

  // ── Derived data ──────────────────────────────────────────────────────────
  const days        = daysUntil(itinerary.date_from)
  const isConfirmed = itinerary.status === 'confirmed'
  const components  = itinerary.components || []
  const booking     = itinerary.booking
  const total       = itinerary.total_display_zar || 0
  const deposit     = Math.round(total * 0.30)
  const balanceDue  = balanceDueDate(itinerary.date_from)
  const headline    = getHeadline(itinerary, booking, days)
  const travName    = booking?.lead_traveller_snapshot?.name

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:"'Jost',sans-serif", color:T.text }}>
      <style suppressHydrationWarning>{`
        * { box-sizing:border-box; }
        @keyframes glow { 0%,100%{box-shadow:0 0 0 rgba(212,175,55,0)} 50%{box-shadow:0 0 20px rgba(212,175,55,0.5)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width:2px; }
        ::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.25); border-radius:2px; }
      `}</style>

      {/* ── Sticky nav ─────────────────────────────────────────────────────── */}
      <div style={{ background:'rgba(10,10,10,0.97)', backdropFilter:'blur(20px)', borderBottom:`0.5px solid rgba(212,175,55,0.12)`, padding:'0 20px', height:58, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:9, textDecoration:'none' }}>
          <div style={{ position:'relative', width:20, height:20, flexShrink:0 }}>
            <div style={{ position:'absolute', inset:0, border:'1.5px solid rgba(200,169,110,0.7)', transform:'rotate(45deg)' }} />
            <div style={{ position:'absolute', inset:5, background:'rgba(200,169,110,0.85)', transform:'rotate(45deg)' }} />
          </div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:15, color:'rgba(200,169,110,0.9)', letterSpacing:'0.06em' }}>
            The Safari Edition
          </div>
        </a>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleCopy} style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, padding:'6px 13px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.08em' }}>
            {copied ? '✓ Copied' : 'Share'}
          </button>
          <a href={`https://wa.me/?text=My safari journey: ${typeof window!=='undefined'?window.location.href:''}`}
            target="_blank" rel="noopener noreferrer"
            style={{ background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.22)', color:T.green, padding:'6px 13px', borderRadius:6, fontSize:11, textDecoration:'none', letterSpacing:'0.08em' }}>
            WhatsApp
          </a>
        </div>
      </div>

      <div style={{ maxWidth:620, margin:'0 auto', padding:'28px 18px 100px' }}>

        {/* ── Status banner ─────────────────────────────────────────────── */}
        {isConfirmed ? (
          <div style={{ background:'rgba(74,222,128,0.06)', border:'0.5px solid rgba(74,222,128,0.22)', borderRadius:12, padding:'14px 18px', marginBottom:24, display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(74,222,128,0.12)', border:'0.5px solid rgba(74,222,128,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:13, color:T.green }}>✓</div>
            <div>
              <div style={{ fontSize:11, color:T.green, fontWeight:500, letterSpacing:'0.12em', textTransform:'uppercase' as const }}>Booking confirmed</div>
              <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>All suppliers notified. Your Journey Specialist has been briefed.</div>
            </div>
          </div>
        ) : (
          <div style={{ background:'rgba(212,175,55,0.05)', border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'14px 18px', marginBottom:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' as const, gap:10 }}>
              <div>
                <div style={{ fontSize:10, color:T.gold, fontWeight:400, letterSpacing:'0.28em', textTransform:'uppercase' as const }}>Quote — awaiting deposit</div>
                {timeLeft && <div style={{ fontSize:11, color:T.textDim, marginTop:3 }}>Valid for: <strong style={{ color:T.text, fontWeight:400 }}>{timeLeft}</strong></div>}
              </div>
              <a href={`/checkout?id=${itinerary.id}`} style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, color:'#0a0a0a', padding:'10px 20px', borderRadius:6, fontSize:12, fontWeight:600, textDecoration:'none', letterSpacing:'0.04em', fontFamily:"'Jost',sans-serif" }}>
                Confirm & Pay →
              </a>
            </div>
          </div>
        )}

        {/* ── Headline + countdown ───────────────────────────────────────── */}
        <div style={{ textAlign:'center' as const, marginBottom:32, padding:'12px 0' }}>
          {days !== null && days > 0 && (
            <>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:clamp(56,64), color:T.gold, lineHeight:1, marginBottom:4 }}>
                {days}
              </div>
              <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.36em', textTransform:'uppercase' as const, marginBottom:12 }}>Days to go</div>
            </>
          )}
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:clamp(20,26), color:days===0?T.gold:T.text, lineHeight:1.2, padding:'0 12px' }}>
            {headline}
          </div>
          {travName && <div style={{ fontSize:11, color:T.textDim, marginTop:8, letterSpacing:'0.1em' }}>Welcome, {travName} ✦</div>}
        </div>

        {/* ── Journey summary ───────────────────────────────────────────── */}
        <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:13, padding:'18px 20px', marginBottom:18 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:400, fontSize:20, color:T.text, marginBottom:10 }}>
            {itinerary.title || 'Safari Journey'}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap' as const, gap:14 }}>
            {itinerary.date_from && (
              <div style={{ fontSize:12, color:T.textMid }}>
                <span style={{ color:T.textDim, marginRight:4, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>From</span>
                {fmtDate(itinerary.date_from)}{itinerary.date_to && ` — ${fmtDate(itinerary.date_to)}`}
              </div>
            )}
            {itinerary.nights && (
              <div style={{ fontSize:12, color:T.textMid }}>
                <span style={{ color:T.textDim, marginRight:4, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>Nights</span>
                {itinerary.nights}
              </div>
            )}
            {itinerary.adults && (
              <div style={{ fontSize:12, color:T.textMid }}>
                <span style={{ color:T.textDim, marginRight:4, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>Guests</span>
                {itinerary.adults + (itinerary.infants || 0)}
              </div>
            )}
          </div>
        </div>

        {/* ── Itinerary components ──────────────────────────────────────── */}
        {components.length > 0 && (
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.36em', textTransform:'uppercase' as const, fontWeight:400, marginBottom:14 }}>
              Your itinerary
            </div>
            {components.map((c: any, i: number) => {
              const sup = c.suppliers || {}
              return (
                <div key={i} style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:13, padding:'16px 18px', marginBottom:10, overflow:'hidden' }}>
                  {/* Pillar header */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div style={{ fontSize:9, color:T.gold, letterSpacing:'0.28em', textTransform:'uppercase' as const, fontWeight:400 }}>
                      {pillarLabel(c.pillar)}
                    </div>
                    {c.display_rate_zar > 0 && (
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, fontWeight:300, color:T.green }}>
                        {fmt(c.display_rate_zar)}
                      </div>
                    )}
                  </div>

                  {/* Property name */}
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:400, fontSize:18, color:T.text, marginBottom:4 }}>
                    {sup.name || c.notes || '—'}
                  </div>

                  {/* Destination */}
                  {sup.destination && (
                    <div style={{ fontSize:12, color:T.textMid, marginBottom:8 }}>
                      {sup.destination}{sup.country ? `, ${sup.country}` : ''}
                    </div>
                  )}

                  {/* Tagline */}
                  {sup.tagline && (
                    <div style={{ fontSize:12, color:T.textDim, fontStyle:'italic', marginBottom:10, lineHeight:1.55 }}>
                      "{sup.tagline}"
                    </div>
                  )}

                  {/* Details */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:10 }}>
                    {c.pillar === 'hotel' || c.pillar === 'lodge' ? (
                      <>
                        <div style={{ background:T.bg3, borderRadius:7, padding:'8px 10px' }}>
                          <div style={{ fontSize:9, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:2 }}>Room</div>
                          <div style={{ fontSize:12, color:T.text }}>{c.selected_tier || 'Standard Suite'}</div>
                        </div>
                        <div style={{ background:T.bg3, borderRadius:7, padding:'8px 10px' }}>
                          <div style={{ fontSize:9, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:2 }}>Basis</div>
                          <div style={{ fontSize:12, color:T.text }}>All-inclusive</div>
                        </div>
                      </>
                    ) : c.pillar === 'flight' || c.pillar === 'charter' ? (
                      <>
                        <div style={{ background:T.bg3, borderRadius:7, padding:'8px 10px' }}>
                          <div style={{ fontSize:9, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:2 }}>Operator</div>
                          <div style={{ fontSize:12, color:T.text }}>{sup.name || '—'}</div>
                        </div>
                        <div style={{ background:T.bg3, borderRadius:7, padding:'8px 10px' }}>
                          <div style={{ fontSize:9, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:2 }}>Type</div>
                          <div style={{ fontSize:12, color:T.text }}>{c.pillar==='charter' ? 'Private charter' : 'Scheduled'}</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ background:T.bg3, borderRadius:7, padding:'8px 10px', gridColumn:'1/-1' }}>
                        <div style={{ fontSize:12, color:T.textMid }}>{sup.description_short || c.notes || 'Included in your journey'}</div>
                      </div>
                    )}
                  </div>

                  {/* Trust score bar */}
                  {sup.trust_score && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                        <div style={{ width:`${sup.trust_score}%`, height:'100%', background:sup.trust_score>=85?T.green:T.gold, borderRadius:2 }} />
                      </div>
                      <span style={{ fontSize:10, color:T.textDim }}>Trust {Math.round(sup.trust_score)}/100</span>
                    </div>
                  )}

                  {/* Media links */}
                  {(sup.hero_video_url || sup.hero_image_url) && (
                    <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' as const }}>
                      {sup.hero_video_url && (
                        <a href={sup.hero_video_url} target="_blank" rel="noopener noreferrer"
                          style={{ background:'rgba(96,165,250,0.08)', border:'0.5px solid rgba(96,165,250,0.22)', color:T.blue, padding:'5px 10px', borderRadius:6, fontSize:11, textDecoration:'none' }}>
                          ▶ Property video
                        </a>
                      )}
                      {sup.hero_image_url && (
                        <a href={sup.hero_image_url} target="_blank" rel="noopener noreferrer"
                          style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, padding:'5px 10px', borderRadius:6, fontSize:11, textDecoration:'none' }}>
                          Gallery
                        </a>
                      )}
                    </div>
                  )}

                  {/* Cancellation policy */}
                  {sup.cancellation_policy && (
                    <div style={{ marginTop:10, background:'rgba(248,113,113,0.05)', border:'0.5px solid rgba(248,113,113,0.14)', borderRadius:7, padding:'8px 10px' }}>
                      <div style={{ fontSize:9, color:'rgba(248,113,113,0.75)', letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:2 }}>Cancellation</div>
                      <div style={{ fontSize:11, color:T.textMid, lineHeight:1.5 }}>{sup.cancellation_policy}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── What's included ───────────────────────────────────────────── */}
        <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:13, padding:'18px 20px', marginBottom:14 }}>
          <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.36em', textTransform:'uppercase' as const, fontWeight:400, marginBottom:14 }}>
            What's included
          </div>
          {[
            'Lodge accommodation in selected suite',
            'All meals and premium beverages',
            'Twice-daily game drives with expert rangers',
            'Airport and airstrip transfers',
            'Park fees and conservation levy',
            '24/7 Journey Specialist support',
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
              <span style={{ color:T.green, fontSize:11, flexShrink:0, marginTop:1, fontWeight:500 }}>✓</span>
              <span style={{ fontSize:13, color:T.textMid }}>{item}</span>
            </div>
          ))}
        </div>

        {/* ── Planning tips ─────────────────────────────────────────────── */}
        <div style={{ background:T.surface, border:`0.5px solid ${T.border}`, borderRadius:13, padding:'18px 20px', marginBottom:14 }}>
          <div style={{ fontSize:10, color:T.gold, letterSpacing:'0.36em', textTransform:'uppercase' as const, fontWeight:400, marginBottom:14 }}>
            Planning tips
          </div>
          {[
            { tip:'What to pack',          desc:'Light, neutral colours. Layers for early mornings. Binoculars essential.' },
            { tip:'Health',                desc:'Malaria prophylaxis recommended for bush destinations. Consult your GP 6 weeks before travel.' },
            { tip:'Currency',              desc:'ZAR at lodges. Credit cards accepted in Cape Town. Tip in ZAR.' },
            { tip:'Getting there',         desc:'Most international flights via OR Tambo (JNB). Allow 3+ hours for connections.' },
          ].map((t, i) => (
            <div key={i} style={{ marginBottom:12, paddingBottom:12, borderBottom:i<3?`0.5px solid ${T.border}`:'none' }}>
              <div style={{ fontSize:12, fontWeight:400, color:T.text, marginBottom:3 }}>{t.tip}</div>
              <div style={{ fontSize:11, color:T.textDim, lineHeight:1.6 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Journey Specialist ─────────────────────────────────────────── */}
        <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:13, padding:'18px 20px', marginBottom:14, display:'flex', gap:16, alignItems:'flex-start' }}>
          <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80" alt="Journey Specialist"
            style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:`1.5px solid ${T.borderGold}` }} />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:400, fontSize:17, color:T.gold, marginBottom:2 }}>
              Your Journey Specialist
            </div>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.1em', marginBottom:8 }}>
              12 years · Southern Africa specialist
            </div>
            <div style={{ fontSize:12, color:T.textMid, fontStyle:'italic', lineHeight:1.65, marginBottom:12 }}>
              "I personally know every property on your itinerary. I'm here before, during, and after."
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
              <a href="https://wa.me/27000000000" style={{ background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.22)', color:T.green, padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:400, textDecoration:'none', letterSpacing:'0.06em' }}>
                WhatsApp
              </a>
              <a href="mailto:journeys@thesafariedition.com" style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, color:T.gold, padding:'7px 14px', borderRadius:6, fontSize:11, fontWeight:400, textDecoration:'none', letterSpacing:'0.06em' }}>
                Email
              </a>
            </div>
          </div>
        </div>

        {/* ── Price & payment ───────────────────────────────────────────── */}
        {total > 0 && (
          <div style={{ background:T.surface, border:`0.5px solid ${T.borderGold}`, borderRadius:13, padding:'22px', marginBottom:14, textAlign:'center' as const }}>
            <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.36em', textTransform:'uppercase' as const, marginBottom:8 }}>
              Total journey investment
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:42, color:T.gold, lineHeight:1, marginBottom:4 }}>
              {fmt(total)}
            </div>
            <div style={{ fontSize:11, color:T.textDim, marginBottom:20 }}>
              All-inclusive · {itinerary.adults || 2} guests
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:isConfirmed?0:18 }}>
              <div style={{ background:T.bg3, borderRadius:9, padding:'14px 12px' }}>
                <div style={{ fontSize:9, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:4 }}>Deposit (30%)</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:20, color:T.gold }}>{fmt(deposit)}</div>
              </div>
              <div style={{ background:T.bg3, borderRadius:9, padding:'14px 12px' }}>
                <div style={{ fontSize:9, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const, marginBottom:4 }}>Balance due</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:20, color:T.textMid }}>{fmt(total - deposit)}</div>
                <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{balanceDue ? `By ${balanceDue}` : '30 days before travel'}</div>
              </div>
            </div>
            {!isConfirmed && (
              <a href={`/checkout?id=${itinerary.id}`}
                style={{ display:'block', padding:'16px', background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, color:'#0a0a0a', borderRadius:8, fontSize:14, fontWeight:600, textDecoration:'none', fontFamily:"'Jost',sans-serif", letterSpacing:'0.06em' }}>
                Confirm & Pay Deposit {fmt(deposit)} →
              </a>
            )}
          </div>
        )}

        {/* ── Reference + footer ───────────────────────────────────────── */}
        <div style={{ textAlign:'center' as const, marginBottom:24 }}>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:'0.2em', textTransform:'uppercase' as const }}>
            Journey reference: {String(code).toUpperCase()}
          </div>
        </div>
        <div style={{ textAlign:'center' as const, paddingTop:20, borderTop:`0.5px solid ${T.border}` }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:16, color:T.gold, letterSpacing:'0.1em' }}>
            ✦ The Safari Edition
          </div>
          <div style={{ fontSize:10, color:T.textDim, marginTop:3, letterSpacing:'0.16em', textTransform:'uppercase' as const }}>
            Sub-Saharan Africa · Curated
          </div>
        </div>
      </div>

      {/* ── Floating Ask Now ──────────────────────────────────────────────── */}
      <div style={{ position:'fixed', bottom:16, right:16, zIndex:999 }}>
        {chatOpen && <AiChat itinerary={itinerary} onClose={() => setChatOpen(false)} />}
        <button onClick={() => setChatOpen(o => !o)}
          style={{ background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', borderRadius:50, padding:'13px 20px', fontSize:13, fontWeight:600, color:'#0a0a0a', cursor:'pointer', boxShadow:'0 4px 20px rgba(212,175,55,0.35)', display:'flex', alignItems:'center', gap:8, fontFamily:"'Jost',sans-serif", letterSpacing:'0.04em' }}>
          {chatOpen ? '✕ Close' : '✦ Ask now'}
        </button>
      </div>
    </div>
  )
}

// ── Tiny responsive clamp helper (avoids CSS clamp in inline styles) ──────────
function clamp(min: number, max: number) {
  return `clamp(${min}px,4vw,${max}px)` as any
}
