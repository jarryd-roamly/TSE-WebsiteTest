'use client';
import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '', type: 'general' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) return
    setSending(true)
    // Route to your email — replace with a proper API route if needed
    await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'contact_form', ...form }),
    }).catch(() => {})
    setSending(false)
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Jost','DM Sans',sans-serif", color: '#f5f0e8' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
        textarea { resize: vertical; }
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

      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(48px,7vw,80px) clamp(20px,5vw,48px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 64 }}>

          {/* Left: contact info */}
          <div>
            <div style={{ fontSize: 10, color: 'rgba(200,169,110,0.7)', letterSpacing: '0.48em', textTransform: 'uppercase', fontWeight: 200, marginBottom: 14 }}>Get in touch</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(28px,4vw,42px)', color: '#f5f0e8', lineHeight: 1.15, marginBottom: 20 }}>
              We're here.<br />Tell us <em style={{ fontStyle: 'italic', color: 'rgba(200,169,110,0.9)' }}>everything.</em>
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(245,240,232,0.42)', lineHeight: 1.85, fontWeight: 300, marginBottom: 32 }}>
              Our Journey Specialists respond within 2 hours during business hours. For complex itineraries, just send us your brief and we'll handle it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: 'Email', value: 'journeys@thesafariedition.com', href: 'mailto:journeys@thesafariedition.com' },
                { label: 'WhatsApp', value: '+27 11 200 5555', href: 'https://wa.me/27726150582' },
                { label: 'Hours', value: 'Mon–Fri 08:00–18:00 SAST', href: null },
              ].map(c => (
                <div key={c.label}>
                  <div style={{ fontSize: 9, color: 'rgba(200,169,110,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                  {c.href
                    ? <a href={c.href} style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)', textDecoration: 'none', letterSpacing: '0.04em' }}>{c.value}</a>
                    : <span style={{ fontSize: 13, color: 'rgba(245,240,232,0.6)', letterSpacing: '0.04em' }}>{c.value}</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div>
            {sent ? (
              <div style={{ background: 'rgba(212,175,55,0.06)', border: '0.5px solid rgba(212,175,55,0.25)', borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 300, color: 'rgba(200,169,110,0.9)', marginBottom: 10 }}>Message received.</div>
                <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.45)', lineHeight: 1.75 }}>We'll be in touch within 2 hours. If it's urgent, WhatsApp us directly.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Type selector */}
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(200,169,110,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Enquiry type</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['general', 'quote', 'existing'].map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                        style={{ flex: 1, padding: '8px 0', border: `0.5px solid ${form.type === t ? 'rgba(200,169,110,0.5)' : 'rgba(255,255,255,0.08)'}`, background: form.type === t ? 'rgba(200,169,110,0.08)' : 'transparent', color: form.type === t ? 'rgba(200,169,110,0.9)' : 'rgba(245,240,232,0.35)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.08em' }}>
                        {t === 'general' ? 'General' : t === 'quote' ? 'New quote' : 'Existing booking'}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Your name" type="text" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Full name" />
                <Field label="Email address" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="name@example.com" />

                {/* Message */}
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(200,169,110,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Your message</div>
                  <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us about your dream safari, travel dates, group size, budget…" rows={5}
                    style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f5f0e8', fontSize: 13, outline: 'none', fontFamily: 'inherit', lineHeight: 1.65 }} />
                </div>

                <button onClick={handleSubmit} disabled={sending || !form.name || !form.email || !form.message}
                  style={{ padding: '14px 0', background: form.name && form.email && form.message && !sending ? 'linear-gradient(135deg,#d4af37,#f0c040)' : 'rgba(212,175,55,0.2)', border: 'none', borderRadius: 6, color: '#0a0a0a', fontSize: 13, fontWeight: 600, cursor: form.name && form.email && form.message && !sending ? 'pointer' : 'not-allowed', fontFamily: "'Jost',sans-serif", letterSpacing: '0.1em' }}>
                  {sending ? 'Sending…' : 'Send message →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'rgba(200,169,110,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#f5f0e8', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
    </div>
  )
}
