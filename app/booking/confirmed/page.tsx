'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const T = {
  bg: '#0a0a0a', surface: '#1a1a1a',
  gold: '#d4af37', goldLight: '#f0c040',
  goldDim: 'rgba(212,175,55,0.12)', borderGold: 'rgba(212,175,55,0.28)',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)', green: '#4ade80',
}

function ConfirmedContent() {
  const params = useSearchParams()
  const ref    = params.get('ref')
  const [copied, setCopied]   = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(t)
  }, [])

  const journeyUrl = ref ? `${typeof window !== 'undefined' ? window.location.origin : ''}/journey/${ref}` : null

  const handleCopyLink = () => {
    if (!journeyUrl) return
    navigator.clipboard.writeText(journeyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const NEXT_STEPS = [
    { icon: '✦', time: 'Within 2 hours',   text: 'Your Journey Specialist will introduce themselves and confirm every detail.' },
    { icon: '✉',  time: 'Shortly',          text: 'Full booking confirmation sent to your email with all supplier details.' },
    { icon: '📋', time: 'Within 24 hours',  text: 'Suppliers notified and availability locked. Nothing left to chance.' },
    { icon: '💬', time: 'Anytime',          text: 'WhatsApp your specialist before, during, and after your journey.' },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px 80px' }}>

      {/* Animated diamond success mark */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <div style={{ position: 'absolute', inset: 0, border: `1.5px solid rgba(200,169,110,0.3)`, borderRadius: 4, transform: 'rotate(45deg)', animation: 'spin 8s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 10, border: `1px solid rgba(200,169,110,0.7)`, borderRadius: 3, transform: 'rotate(45deg)', animation: 'spin 5s linear infinite reverse' }} />
          <div style={{ position: 'absolute', inset: 22, background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, borderRadius: 2, transform: 'rotate(45deg)', animation: 'glow 2.5s ease-in-out infinite' }} />
        </div>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center', marginBottom: 32, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.7s ease' }}>
        <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.44em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 12 }}>
          Booking confirmed
        </div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(32px,5vw,48px)', color: T.text, lineHeight: 1.1, marginBottom: 10 }}>
          Your journey<br /><em style={{ color: T.gold, fontStyle: 'italic' }}>is secured.</em>
        </div>
        <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.75, letterSpacing: '0.04em' }}>
          Deposit received. Journey confirmed.<br />
          A full confirmation is on its way to your inbox.
        </div>
      </div>

      {/* Booking reference */}
      {ref && (
        <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 14, padding: '20px 22px', marginBottom: 16, opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.15s' }}>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.36em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 8 }}>
            Booking reference
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300, color: T.text, letterSpacing: '0.14em', marginBottom: 4 }}>
            {ref}
          </div>
          <div style={{ fontSize: 11, color: T.textDim, letterSpacing: '0.08em' }}>
            Quote this in all correspondence with your specialist
          </div>
        </div>
      )}

      {/* Mini-site link */}
      {journeyUrl && (
        <div style={{ background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 14, padding: '18px 22px', marginBottom: 20, opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.25s' }}>
          <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.36em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 8 }}>
            ✦ Your journey page
          </div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.65, marginBottom: 14 }}>
            Your personal journey page is live — share it with travel companions, check your itinerary, and track your balance any time.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`/journey/${ref}`} style={{ flex: 1, minWidth: 130, display: 'block', padding: '11px 18px', background: `linear-gradient(135deg,${T.gold},${T.goldLight})`, borderRadius: 7, color: '#0a0a0a', fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center', fontFamily: "'Jost',sans-serif", letterSpacing: '0.04em' }}>
              View My Journey →
            </a>
            <button onClick={handleCopyLink} style={{ flex: 1, minWidth: 130, padding: '11px 18px', background: 'transparent', border: `0.5px solid ${T.borderGold}`, borderRadius: 7, color: T.gold, fontSize: 13, fontWeight: 400, cursor: 'pointer', fontFamily: "'Jost',sans-serif", letterSpacing: '0.04em' }}>
              {copied ? '✓ Link copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {/* Journey Specialist card */}
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'flex-start', opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.35s' }}>
        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80" alt="Journey Specialist"
          style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `1.5px solid ${T.borderGold}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 17, color: T.gold, marginBottom: 2 }}>Sarah Mitchell</div>
          <div style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Senior Safari Specialist</div>
          <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.65, fontStyle: 'italic' }}>
            "I'm personally reviewing your journey right now. I'll be in touch within 2 hours to confirm every detail."
          </div>
          <a href="https://wa.me/27000000000" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '7px 14px', background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.25)', borderRadius: 6, color: T.green, fontSize: 11, fontWeight: 500, textDecoration: 'none', fontFamily: "'Jost',sans-serif", letterSpacing: '0.08em' }}>
            WhatsApp your specialist
          </a>
        </div>
      </div>

      {/* What happens next */}
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', marginBottom: 20, opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.45s' }}>
        <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.36em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 18 }}>
          What happens next
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {NEXT_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i < NEXT_STEPS.length - 1 ? 16 : 0, borderBottom: i < NEXT_STEPS.length - 1 ? `0.5px solid ${T.border}` : 'none', marginBottom: i < NEXT_STEPS.length - 1 ? 16 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.gold }}>
                  {step.icon}
                </div>
                {i < NEXT_STEPS.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 6, background: 'rgba(212,175,55,0.12)' }} />}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 10, color: T.gold, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{step.time}</div>
                <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.65 }}>{step.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer links */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.55s' }}>
        <a href="/" style={{ fontSize: 11, color: T.textDim, textDecoration: 'none', letterSpacing: '0.1em' }}>Plan another journey →</a>
        <a href="mailto:journeys@thesafariedition.com" style={{ fontSize: 11, color: T.textDim, textDecoration: 'none', letterSpacing: '0.1em' }}>journeys@thesafariedition.com</a>
      </div>
    </div>
  )
}

export default function ConfirmedPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Jost','DM Sans',sans-serif", color: '#f5f0e8' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin  { to { transform: rotate(calc(45deg + 360deg)) } }
        @keyframes glow  { 0%,100%{box-shadow:0 0 0 rgba(212,175,55,0)} 50%{box-shadow:0 0 24px rgba(212,175,55,0.5)} }
      `}</style>
      <div style={{ background: 'rgba(10,10,10,0.97)', borderBottom: '0.5px solid rgba(212,175,55,0.15)', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.7)', transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', inset: 6, background: 'rgba(200,169,110,0.85)', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 15, color: 'rgba(200,169,110,0.9)', letterSpacing: '0.06em' }}>The Safari Edition</div>
        </a>
        <div style={{ fontSize: 10, color: 'rgba(74,222,128,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>✓ Confirmed</div>
      </div>
      <Suspense fallback={<div style={{ color: '#d4af37', textAlign: 'center', padding: 60, fontFamily: "'Cormorant Garamond',serif" }}>Loading…</div>}>
        <ConfirmedContent />
      </Suspense>
    </div>
  )
}
