'use client';

const STEPS = [
  { n: '01', title: 'Tell us your dream',    sub: '5 questions. 60 seconds.', body: 'Answer five questions about your experience level, preferred destinations, travel dates, group size and budget. Or write us a brief in your own words. The AI reads everything.' },
  { n: '02', title: 'We build your itinerary', sub: 'Under 30 seconds.', body: 'Our AI designs a fully-priced, bookable itinerary using contracted net rates from our lodge partners — 15–27% below what you\'d pay direct. Every recommendation backed by our Knowledge Base.' },
  { n: '03', title: 'You customise',          sub: 'Swipe, adjust, refine.', body: 'Browse lodge options for each destination. Swap properties, adjust nights, add experiences. The total updates live with every change. Ask the AI to make it cheaper, longer, or more adventurous.' },
  { n: '04', title: 'Confirm your journey',   sub: 'Pay a 30% deposit.', body: 'Review every detail — lodges, transfers, dates — before securing with a 30% deposit via PayFast. Your Journey Specialist is introduced within 2 hours of confirmation.' },
  { n: '05', title: 'We handle everything',   sub: 'Before, during & after.',  body: 'From supplier confirmations to disruption management — if your charter is delayed in the Okavango, we know before you do and have alternatives ready. WhatsApp throughout.' },
];

export default function HowItWorksPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Jost','DM Sans',sans-serif", color: '#f5f0e8' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(212,175,55,0.12)', padding: '0 clamp(20px,5vw,64px)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.7)', transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', inset: 6, background: 'rgba(200,169,110,0.85)', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 15, color: 'rgba(200,169,110,0.9)', letterSpacing: '0.06em' }}>The Safari Edition</div>
        </a>
        <a href="/" style={{ fontSize: 11, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none' }}>← Back</a>
      </nav>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,48px)' }}>
        {/* Header */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ fontSize: 10, color: 'rgba(200,169,110,0.7)', letterSpacing: '0.48em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 14 }}>How it works</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(32px,5vw,52px)', color: '#f5f0e8', lineHeight: 1.1, marginBottom: 16 }}>
            From dream to <em style={{ fontStyle: 'italic', color: 'rgba(200,169,110,0.9)' }}>departure</em><br />in under 10 minutes.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(245,240,232,0.45)', lineHeight: 1.8, fontWeight: 300, maxWidth: 520 }}>
            A process that used to take 39 emails and 3 weeks now takes 60 seconds and a swipe.
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {STEPS.map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: 28, paddingBottom: 40, marginBottom: 40, borderBottom: i < STEPS.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
              {/* Number + line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 44, height: 44, border: '0.5px solid rgba(200,169,110,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 15, color: 'rgba(200,169,110,0.8)', letterSpacing: '0.06em' }}>{step.n}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ width: 0.5, flex: 1, background: 'rgba(200,169,110,0.12)', marginTop: 12 }} />}
              </div>

              {/* Content */}
              <div style={{ paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: 'rgba(200,169,110,0.6)', letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 8 }}>{step.sub}</div>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 400, fontSize: 24, color: '#f5f0e8', marginBottom: 12, lineHeight: 1.2 }}>{step.title}</h2>
                <p style={{ fontSize: 14, color: 'rgba(245,240,232,0.48)', lineHeight: 1.85, fontWeight: 300, margin: 0, maxWidth: 560 }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ paddingTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/" style={{ display: 'inline-block', padding: '14px 32px', background: 'linear-gradient(135deg,#d4af37,#f0c040)', borderRadius: 4, color: '#0a0a0a', fontSize: 13, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.1em', fontFamily: "'Jost',sans-serif" }}>
            ✦ Plan My Journey
          </a>
          <a href="/contact" style={{ display: 'inline-block', padding: '14px 32px', border: '0.5px solid rgba(255,255,255,0.14)', borderRadius: 4, color: 'rgba(245,240,232,0.6)', fontSize: 13, fontWeight: 300, textDecoration: 'none', letterSpacing: '0.1em', fontFamily: "'Jost',sans-serif" }}>
            Speak to a specialist
          </a>
        </div>
      </div>
    </div>
  )
}
