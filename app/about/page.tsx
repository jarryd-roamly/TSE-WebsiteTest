'use client';

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Jost','DM Sans',sans-serif", color: '#f5f0e8' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
        .about-fade { opacity: 0; transform: translateY(18px); animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes fadeUp { to { opacity:1; transform:translateY(0); } }
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

      {/* Hero */}
      <div style={{ position: 'relative', height: 380, overflow: 'hidden', marginBottom: 0 }}>
        <img src="https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1400&q=80" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%', filter: 'saturate(0.8)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,10,10,0.3) 0%, rgba(10,10,10,0.85) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 'clamp(32px,5vw,64px)', maxWidth: 900 }}>
          <div className="about-fade" style={{ fontSize: 10, color: 'rgba(200,169,110,0.8)', letterSpacing: '0.48em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 12, animationDelay: '0.1s' }}>About us</div>
          <h1 className="about-fade" style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(32px,5vw,56px)', color: '#f5f0e8', lineHeight: 1.1, margin: 0, animationDelay: '0.25s' }}>
            A different kind<br />of <em style={{ fontStyle: 'italic', color: 'rgba(200,169,110,0.9)' }}>safari company.</em>
          </h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 840, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,64px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48, marginBottom: 64 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(200,169,110,0.7)', letterSpacing: '0.36em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 16 }}>The platform</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 26, color: '#f5f0e8', marginBottom: 16, lineHeight: 1.25 }}>Built for the specialist, not the algorithm.</h2>
            <p style={{ fontSize: 14, color: 'rgba(245,240,232,0.52)', lineHeight: 1.85, fontWeight: 300 }}>
              The Safari Edition is the first deployment of The Travel Collection — a platform that combines specialist knowledge with software speed. We don't compete with OTAs. We replace the 39-email DMC process with something that takes 60 seconds.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(200,169,110,0.7)', letterSpacing: '0.36em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 16 }}>The difference</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 26, color: '#f5f0e8', marginBottom: 16, lineHeight: 1.25 }}>Contracted rates. Specialist knowledge. Instant confirmation.</h2>
            <p style={{ fontSize: 14, color: 'rgba(245,240,232,0.52)', lineHeight: 1.85, fontWeight: 300 }}>
              Our rates are contracted directly with Africa's finest lodges — 15–27% below what you'd pay booking direct. Every recommendation is backed by a specialist who has been there. Not a language model guessing at it.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 2, marginBottom: 64 }}>
          {[
            { n: '90+',  l: 'Curated properties' },
            { n: '27%',  l: 'Average saving vs direct' },
            { n: '3',    l: 'Source markets' },
            { n: '4.9★', l: 'Guest satisfaction' },
          ].map(s => (
            <div key={s.l} style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 40, color: 'rgba(200,169,110,0.9)', lineHeight: 1, marginBottom: 8 }}>{s.n}</div>
              <div style={{ fontSize: 10, color: 'rgba(245,240,232,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 200 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <a href="/" style={{ display: 'inline-block', padding: '14px 32px', background: 'linear-gradient(135deg,#d4af37,#f0c040)', borderRadius: 4, color: '#0a0a0a', fontSize: 13, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.1em', fontFamily: "'Jost',sans-serif" }}>
            Plan My Journey →
          </a>
        </div>
      </div>
    </div>
  )
}
