'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

const T = {
  bg:'#080818', bg2:'#0f0f1f', surface:'#1a1a2e',
  gold:'#d4af37', goldDim:'rgba(212,175,55,0.15)', borderGold:'rgba(212,175,55,0.3)',
  text:'#f5f0e8', textMid:'rgba(245,240,232,0.6)', textDim:'rgba(245,240,232,0.35)',
  border:'rgba(255,255,255,0.08)', green:'#4ade80', red:'#f87171', blue:'#60a5fa',
}

function fmt(n) { return `R ${Math.round(n).toLocaleString()}` }

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000*60*60*24))
  return diff
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-ZA', {day:'numeric', month:'long', year:'numeric'})
}

function balanceDueDate(travelDate) {
  if (!travelDate) return null
  const d = new Date(travelDate)
  d.setDate(d.getDate() - 30)
  return formatDate(d.toISOString())
}

function getPersonalHeadline(itinerary, booking, days) {
  const name = booking?.lead_traveller_snapshot?.name
  const daysStr = days !== null && days > 0 ? `${days} days` : days === 0 ? 'Today is the day' : null
  if (name) {
    const firstName = name.split(' ')[0]
    if (daysStr && days > 0) return `${daysStr} until ${firstName}'s unforgettable African adventure`
    if (days === 0) return `Today is ${firstName}'s day. ✦`
    return `${firstName}'s African Journey`
  }
  if (daysStr && days > 0) return `${daysStr} until your unforgettable African adventure`
  if (days === 0) return 'Today is the day. ✦'
  return 'Your African Journey'
}

function pillarIcon(pillar) {
  const icons = { hotel:'🏕️', lodge:'🏕️', flight:'✈️', charter:'🛩️', transfer:'🚗', activity:'🌿', spa:'💆' }
  return icons[pillar] || '✦'
}

function pillarLabel(pillar) {
  const labels = { hotel:'Lodge / Hotel', lodge:'Lodge', flight:'Flight', charter:'Charter Flight', transfer:'Transfer', activity:'Activity', spa:'Spa' }
  return labels[pillar] || pillar
}

// AI Chat Component
function AiChat({ itinerary, onClose }) {
  const [messages, setMessages] = useState([
    { role:'assistant', text:`Welcome! I'm here to help with any questions about your ${itinerary?.title||'safari journey'}. Ask me anything — from packing tips to what to expect on arrival.` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [handedOff, setHandedOff] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

  const HUMAN_TRIGGERS = ['are you human','real person','speak to someone','talk to someone','human agent','call me','phone','escalate']

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')

    // Check for human handoff trigger
    const lower = userMsg.toLowerCase()
    if (HUMAN_TRIGGERS.some(t => lower.includes(t))) {
      setMessages(m => [...m,
        { role:'user', text:userMsg },
        { role:'handoff', text:"I'm connecting you with your Journey Specialist right now. They'll be with you shortly on WhatsApp." }
      ])
      setHandedOff(true)
      return
    }

    setMessages(m => [...m, { role:'user', text:userMsg }])
    setLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:400,
          system:`You are a friendly, knowledgeable safari journey specialist for The Safari Edition. 
You are helping a traveller with their booking. Journey details: ${JSON.stringify({
  title: itinerary?.title,
  nights: itinerary?.nights,
  destination: itinerary?.components?.[0]?.suppliers?.destination || 'Southern Africa',
  dates: itinerary?.date_from ? `${formatDate(itinerary.date_from)} to ${formatDate(itinerary.date_to)}` : 'dates TBC'
})}.
Answer questions helpfully and concisely. For complex changes or complaints, suggest they speak to their Journey Specialist directly via WhatsApp.
Never discuss pricing changes — direct to specialist. Keep responses under 100 words.`,
          messages:[
            ...messages.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({ role:m.role, content:m.text })),
            { role:'user', content:userMsg }
          ]
        })
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || "I'll need to check that with your specialist — shall I connect you?"
      setMessages(m => [...m, { role:'assistant', text:reply }])
    } catch(e) {
      setMessages(m => [...m, { role:'assistant', text:"I'm having trouble connecting right now. Please WhatsApp your specialist directly." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{position:'fixed',bottom:80,right:16,width:320,maxHeight:440,background:T.bg2,border:`0.5px solid ${T.borderGold}`,borderRadius:16,boxShadow:'0 16px 48px rgba(0,0,0,0.6)',display:'flex',flexDirection:'column',zIndex:1000}}>
      <div style={{padding:'12px 16px',borderBottom:`0.5px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:T.gold}}>✦ Journey Assistant</div>
          <div style={{fontSize:10,color:T.textDim}}>Typical response: instant · Human: &lt;2 hours</div>
        </div>
        <button onClick={onClose} style={{background:'transparent',border:'none',color:T.textDim,cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
        {messages.map((m,i) => (
          <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            <div style={{
              maxWidth:'85%',padding:'8px 12px',borderRadius:10,fontSize:12,lineHeight:1.5,
              background: m.role==='user' ? T.goldDim :
                         m.role==='handoff' ? 'rgba(74,222,128,0.1)' : T.surface,
              border: m.role==='handoff' ? '0.5px solid rgba(74,222,128,0.3)' : 'none',
              color: m.role==='handoff' ? T.green : T.text
            }}>
              {m.text}
              {m.role==='handoff' && (
                <a href="https://wa.me/27000000000"
                  style={{display:'block',marginTop:8,background:'rgba(74,222,128,0.15)',border:'0.5px solid rgba(74,222,128,0.3)',color:T.green,padding:'6px 12px',borderRadius:7,fontSize:11,textDecoration:'none',textAlign:'center'}}>
                  Open WhatsApp →
                </a>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:'flex',justifyContent:'flex-start'}}>
            <div style={{background:T.surface,padding:'8px 14px',borderRadius:10,fontSize:12,color:T.textDim}}>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {!handedOff && (
        <div style={{padding:'10px 12px',borderTop:`0.5px solid ${T.border}`,display:'flex',gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&sendMessage()}
            placeholder="Ask anything about your journey…"
            style={{flex:1,background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:8,padding:'8px 10px',color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
          <button onClick={sendMessage} disabled={loading||!input.trim()}
            style={{background:T.gold,border:'none',borderRadius:8,padding:'8px 12px',color:'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            →
          </button>
        </div>
      )}
    </div>
  )
}

export default function JourneyPage() {
  const params = useParams()
  const code = params.code
  const [itinerary, setItinerary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

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
      if (diff<=0) { setTimeLeft('Expired'); return }
      const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000)
      setTimeLeft(`${h}h ${m}m ${s}s`)
    }
    tick(); const iv=setInterval(tick,1000); return ()=>clearInterval(iv)
  }, [itinerary])

  const handleCopy = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  if (loading) return (
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:T.gold,fontFamily:"'Playfair Display',serif",fontSize:18}}>Loading your journey…</div>
    </div>
  )

  if (error||!itinerary) return (
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,padding:24}}>
      <div style={{fontSize:32,color:T.gold}}>✦</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:T.gold}}>Journey not found</div>
      <div style={{fontSize:13,color:T.textDim,textAlign:'center'}}>The link may have expired or the reference is incorrect.</div>
      <a href="/" style={{background:T.goldDim,border:`0.5px solid ${T.borderGold}`,color:T.gold,padding:'10px 24px',borderRadius:9,fontSize:13,textDecoration:'none'}}>Plan a new journey →</a>
    </div>
  )

  const days = daysUntil(itinerary.date_from)
  const isConfirmed = itinerary.status==='confirmed'
  const components = itinerary.components || []
  const booking = itinerary.booking
  const total = itinerary.total_display_zar || 0
  const deposit = Math.round(total*0.30)
  const balanceDue = balanceDueDate(itinerary.date_from)
  const headline = getPersonalHeadline(itinerary, booking, days)
  const travName = booking?.lead_traveller_snapshot?.name

  return (
    <div style={{minHeight:'100vh',background:T.bg,fontFamily:"'DM Sans',Arial,sans-serif",color:T.text}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;600&display=swap');* { box-sizing:border-box }`}</style>

      {/* Header */}
      <div style={{background:T.bg2,borderBottom:`0.5px solid ${T.border}`,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:50}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:T.gold,fontWeight:700}}>✦ The Safari Edition</div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={handleCopy} style={{background:T.goldDim,border:`0.5px solid ${T.borderGold}`,color:T.gold,padding:'6px 12px',borderRadius:8,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
            {copied?'✓ Copied!':'Share'}
          </button>
          <a href={`https://wa.me/?text=My safari journey: ${typeof window!=='undefined'?window.location.href:''}`} target="_blank" rel="noopener noreferrer"
            style={{background:'rgba(74,222,128,0.1)',border:'0.5px solid rgba(74,222,128,0.3)',color:T.green,padding:'6px 12px',borderRadius:8,fontSize:11,textDecoration:'none'}}>
            WhatsApp
          </a>
        </div>
      </div>

      <div style={{maxWidth:640,margin:'0 auto',padding:'24px 16px 100px'}}>

        {/* Status */}
        {isConfirmed ? (
          <div style={{background:'rgba(74,222,128,0.08)',border:'0.5px solid rgba(74,222,128,0.25)',borderRadius:12,padding:'14px 18px',marginBottom:24,display:'flex',gap:10,alignItems:'center'}}>
            <span style={{fontSize:22,color:T.green}}>✓</span>
            <div>
              <div style={{fontSize:13,color:T.green,fontWeight:700}}>BOOKING CONFIRMED</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Your journey is fully confirmed. All suppliers have been notified.</div>
            </div>
          </div>
        ) : (
          <div style={{background:'rgba(212,175,55,0.06)',border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:'14px 18px',marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
              <div>
                <div style={{fontSize:11,color:T.gold,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>Quote — awaiting confirmation</div>
                {timeLeft&&<div style={{fontSize:11,color:T.textDim,marginTop:3}}>Valid for: <strong style={{color:T.text}}>{timeLeft}</strong></div>}
              </div>
              <a href={`/checkout?id=${itinerary.id}`} style={{background:`linear-gradient(135deg,${T.gold},#f0c040)`,color:'#0a0a0a',padding:'10px 18px',borderRadius:9,fontSize:13,fontWeight:700,textDecoration:'none'}}>
                Confirm & Pay →
              </a>
            </div>
          </div>
        )}

        {/* Personal headline + countdown */}
        <div style={{textAlign:'center',marginBottom:28,padding:'20px 0'}}>
          {days!==null&&days>0&&(
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:64,fontWeight:700,color:T.gold,lineHeight:1,marginBottom:8}}>{days}</div>
          )}
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:days!==null&&days>0?18:24,color:days===0?T.gold:T.text,fontWeight:600,lineHeight:1.3,padding:'0 16px'}}>
            {headline}
          </div>
          {travName&&(
            <div style={{fontSize:12,color:T.textDim,marginTop:6}}>Welcome, {travName} ✦</div>
          )}
        </div>

        {/* Journey summary */}
        <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:'16px 18px',marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:T.text,marginBottom:8}}>{itinerary.title||'Safari Journey'}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
            {itinerary.date_from&&<div style={{fontSize:12,color:T.textMid}}>📅 {formatDate(itinerary.date_from)}{itinerary.date_to&&` — ${formatDate(itinerary.date_to)}`}</div>}
            {itinerary.nights&&<div style={{fontSize:12,color:T.textMid}}>🌙 {itinerary.nights} nights</div>}
            {itinerary.adults&&<div style={{fontSize:12,color:T.textMid}}>👥 {itinerary.adults+(itinerary.infants||0)} guests</div>}
          </div>
        </div>

        {/* Components */}
        {components.length>0&&(
          <div style={{marginBottom:24}}>
            <div style={{fontSize:11,color:T.gold,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700,marginBottom:12}}>Your Itinerary</div>
            {components.map((c,i)=>{
              const sup = c.suppliers || {}
              return (
                <div key={i} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,padding:'16px',marginBottom:12,overflow:'hidden'}}>
                  {/* Pillar label */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:16}}>{pillarIcon(c.pillar)}</span>
                      <span style={{fontSize:10,color:T.gold,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>{pillarLabel(c.pillar)}</span>
                    </div>
                    {c.display_rate_zar>0&&(
                      <div style={{fontSize:13,fontWeight:700,color:T.green}}>{fmt(c.display_rate_zar)}</div>
                    )}
                  </div>

                  {/* Property name */}
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:T.text,marginBottom:4}}>
                    {sup.name||c.notes||'—'}
                  </div>

                  {/* Destination */}
                  {sup.destination&&(
                    <div style={{fontSize:12,color:T.textMid,marginBottom:8}}>📍 {sup.destination}{sup.country?`, ${sup.country}`:''}</div>
                  )}

                  {/* Tagline */}
                  {sup.tagline&&(
                    <div style={{fontSize:12,color:T.textDim,fontStyle:'italic',marginBottom:10,lineHeight:1.4}}>"{sup.tagline}"</div>
                  )}

                  {/* Details grid */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                    {c.pillar==='hotel'||c.pillar==='lodge' ? (
                      <>
                        <div style={{background:T.bg,borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>ROOM TYPE</div>
                          <div style={{fontSize:12,color:T.text}}>{c.selected_tier||'Standard Suite'}</div>
                        </div>
                        <div style={{background:T.bg,borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>MEAL BASIS</div>
                          <div style={{fontSize:12,color:T.text}}>All-inclusive</div>
                        </div>
                      </>
                    ) : c.pillar==='flight'||c.pillar==='charter' ? (
                      <>
                        <div style={{background:T.bg,borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>OPERATOR</div>
                          <div style={{fontSize:12,color:T.text}}>{sup.name||'—'}</div>
                        </div>
                        <div style={{background:T.bg,borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:10,color:T.textDim,marginBottom:2}}>TYPE</div>
                          <div style={{fontSize:12,color:T.text}}>{c.pillar==='charter'?'Private charter':'Scheduled flight'}</div>
                        </div>
                      </>
                    ) : (
                      <div style={{background:T.bg,borderRadius:8,padding:'8px 10px',gridColumn:'1/-1'}}>
                        <div style={{fontSize:12,color:T.textMid}}>{sup.description_short||c.notes||'Included in your journey'}</div>
                      </div>
                    )}
                  </div>

                  {/* Cancellation policy */}
                  {sup.cancellation_policy&&(
                    <div style={{background:'rgba(248,113,113,0.06)',border:'0.5px solid rgba(248,113,113,0.15)',borderRadius:8,padding:'8px 10px',marginBottom:10}}>
                      <div style={{fontSize:10,color:'rgba(248,113,113,0.8)',fontWeight:700,marginBottom:2}}>CANCELLATION POLICY</div>
                      <div style={{fontSize:11,color:T.textMid,lineHeight:1.4}}>{sup.cancellation_policy}</div>
                    </div>
                  )}

                  {/* Trust score */}
                  {sup.trust_score&&(
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.1)',overflow:'hidden'}}>
                        <div style={{width:`${sup.trust_score}%`,height:'100%',background:sup.trust_score>=85?T.green:T.gold,borderRadius:2}}/>
                      </div>
                      <span style={{fontSize:10,color:T.textDim}}>Trust score: {Math.round(sup.trust_score)}/100</span>
                    </div>
                  )}

                  {/* Media links */}
                  {(sup.hero_video_url||sup.hero_image_url)&&(
                    <div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}>
                      {sup.hero_video_url&&(
                        <a href={sup.hero_video_url} target="_blank" rel="noopener noreferrer"
                          style={{background:'rgba(96,165,250,0.1)',border:'0.5px solid rgba(96,165,250,0.3)',color:T.blue,padding:'5px 10px',borderRadius:7,fontSize:11,textDecoration:'none'}}>
                          ▶ Watch property video
                        </a>
                      )}
                      {sup.hero_image_url&&(
                        <a href={sup.hero_image_url} target="_blank" rel="noopener noreferrer"
                          style={{background:T.goldDim,border:`0.5px solid ${T.borderGold}`,color:T.gold,padding:'5px 10px',borderRadius:7,fontSize:11,textDecoration:'none'}}>
                          📷 View gallery
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* What's included */}
        <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:'16px 18px',marginBottom:16}}>
          <div style={{fontSize:11,color:T.gold,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:10}}>What's Included</div>
          {['Lodge accommodation in selected suite','All meals and premium beverages','Twice-daily game drives with expert rangers','Airport and airstrip transfers','Park fees and conservation levy','24/7 Journey Specialist support'].map((item,i)=>(
            <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:6}}>
              <span style={{color:T.green,fontSize:12,flexShrink:0,marginTop:1}}>✓</span>
              <span style={{fontSize:12,color:T.textMid}}>{item}</span>
            </div>
          ))}
        </div>

        {/* Planning tips */}
        <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:'16px 18px',marginBottom:16}}>
          <div style={{fontSize:11,color:T.gold,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:10}}>Planning Tips</div>
          {[
            {tip:'What to pack', url:'#', desc:'Light, neutral colours. Layers for early mornings. Binoculars essential.'},
            {tip:'Health & vaccinations', url:'#', desc:'Malaria prophylaxis recommended. Yellow fever certificate may be required.'},
            {tip:'Currency & payments', url:'#', desc:'ZAR accepted at most lodges. Credit cards widely accepted in Cape Town.'},
            {tip:'Getting there', url:'#', desc:'Most international flights arrive at OR Tambo (JNB). Allow 3+ hours connection.'},
          ].map((t,i)=>(
            <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:i<3?`0.5px solid ${T.border}`:'none'}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:2}}>{t.tip}</div>
              <div style={{fontSize:11,color:T.textDim,lineHeight:1.5}}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Journey Specialist card */}
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:'16px 18px',marginBottom:16}}>
          <div style={{fontSize:11,color:T.gold,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:12}}>Your Journey Specialist</div>
          <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
            <div style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg,${T.gold},#f0c040)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>✦</div>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:2}}>Your Safari Specialist</div>
              <div style={{fontSize:11,color:T.textDim,marginBottom:6}}>12 years experience · Southern Africa specialist</div>
              <div style={{fontSize:11,color:T.textMid,fontStyle:'italic',marginBottom:10,lineHeight:1.5}}>"I personally know every property on your itinerary. I'm here before, during, and after your journey."</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <a href="https://wa.me/27000000000"
                  style={{background:'rgba(74,222,128,0.1)',border:'0.5px solid rgba(74,222,128,0.3)',color:T.green,padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none'}}>
                  WhatsApp
                </a>
                <a href="mailto:journeys@thesafariedition.com"
                  style={{background:T.goldDim,border:`0.5px solid ${T.borderGold}`,color:T.gold,padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:600,textDecoration:'none'}}>
                  Email
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Price and payment */}
        {total>0&&(
          <div style={{background:T.bg2,border:`1px solid ${T.borderGold}`,borderRadius:14,padding:'20px',marginBottom:16,textAlign:'center'}}>
            <div style={{fontSize:11,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Total Journey Investment</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:38,fontWeight:700,color:T.gold,marginBottom:4}}>{fmt(total)}</div>
            <div style={{fontSize:11,color:T.textDim,marginBottom:16}}>All-inclusive · {itinerary.adults||2} guests</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:isConfirmed?0:16}}>
              <div style={{background:T.surface,borderRadius:10,padding:'12px'}}>
                <div style={{fontSize:10,color:T.textDim,marginBottom:4}}>DEPOSIT DUE NOW</div>
                <div style={{fontSize:18,fontWeight:700,color:T.gold}}>{fmt(deposit)}</div>
                <div style={{fontSize:10,color:T.textDim,marginTop:2}}>30% to confirm</div>
              </div>
              <div style={{background:T.surface,borderRadius:10,padding:'12px'}}>
                <div style={{fontSize:10,color:T.textDim,marginBottom:4}}>BALANCE DUE</div>
                <div style={{fontSize:18,fontWeight:700,color:T.text}}>{fmt(total-deposit)}</div>
                <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{balanceDue?`By ${balanceDue}`:'30 days before travel'}</div>
              </div>
            </div>
            {!isConfirmed&&(
              <a href={`/checkout?id=${itinerary.id}`}
                style={{display:'block',padding:'16px',background:`linear-gradient(135deg,${T.gold},#f0c040)`,color:'#0a0a0a',borderRadius:11,fontSize:15,fontWeight:700,textDecoration:'none'}}>
                Confirm & Pay Deposit {fmt(deposit)} →
              </a>
            )}
          </div>
        )}

        {/* Reference */}
        <div style={{textAlign:'center',fontSize:11,color:T.textDim,marginBottom:24}}>
          Journey reference: {String(code).toUpperCase()}
        </div>

        {/* Footer */}
        <div style={{textAlign:'center',paddingTop:20,borderTop:`0.5px solid ${T.border}`}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:T.gold,marginBottom:4}}>✦ The Safari Edition</div>
          <div style={{fontSize:10,color:T.textDim}}>Curated luxury African travel</div>
        </div>
      </div>

      {/* Floating Ask Now button */}
      <div style={{position:'fixed',bottom:16,right:16,zIndex:999}}>
        {chatOpen&&<AiChat itinerary={itinerary} onClose={()=>setChatOpen(false)}/>}
        <button onClick={()=>setChatOpen(o=>!o)}
          style={{background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:50,padding:'14px 20px',fontSize:14,fontWeight:700,color:'#0a0a0a',cursor:'pointer',boxShadow:'0 4px 20px rgba(212,175,55,0.4)',display:'flex',alignItems:'center',gap:8}}>
          {chatOpen?'✕ Close':'✦ Ask now'}
        </button>
      </div>
    </div>
  )
}
