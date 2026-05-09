'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const T = {
  bg: '#080818',
  bg2: '#0f0f1f',
  surface: '#1a1a2e',
  gold: '#d4af37',
  borderGold: 'rgba(212,175,55,0.3)',
  goldDim: 'rgba(212,175,55,0.15)',
  text: '#f5f0e8',
  textMid: 'rgba(245,240,232,0.6)',
  textDim: 'rgba(245,240,232,0.35)',
  border: 'rgba(255,255,255,0.08)',
  green: '#4ade80',
};

function ConfirmedContent() {
  const params = useSearchParams();
  const ref = params.get('ref');

  return (
    <div
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {/* Success icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(74,222,128,0.12)',
          border: '2px solid rgba(74,222,128,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 32,
        }}
      >
        ✓
      </div>

      <div
        style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: 32,
          fontWeight: 700,
          color: T.gold,
          marginBottom: 8,
        }}
      >
        You're booked.
      </div>

      <div
        style={{
          fontSize: 15,
          color: T.textMid,
          marginBottom: 28,
          lineHeight: 1.7,
        }}
      >
        Your deposit has been received.
        <br />
        Your journey is confirmed.
        <br />A confirmation has been sent to your email.
      </div>

      {/* Booking reference */}
      {ref && (
        <div
          style={{
            background: 'rgba(74,222,128,0.08)',
            border: '0.5px solid rgba(74,222,128,0.3)',
            borderRadius: 12,
            padding: '20px',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: T.green,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            Booking Reference
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: T.text,
              letterSpacing: '0.12em',
              fontFamily: 'monospace',
            }}
          >
            {ref}
          </div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 8 }}>
            Keep this reference for all correspondence
          </div>
        </div>
      )}

      {/* What happens next */}
      <div
        style={{
          background: T.surface,
          border: `0.5px solid ${T.border}`,
          borderRadius: 12,
          padding: '20px',
          marginBottom: 28,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: T.gold,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 14,
          }}
        >
          What happens next
        </div>
        {[
          {
            icon: '👋',
            text: 'Your Journey Specialist will introduce themselves within 2 hours',
          },
          {
            icon: '✉️',
            text: 'A full booking confirmation will be emailed to you shortly',
          },
          {
            icon: '📋',
            text: 'Your suppliers will be notified and arrangements confirmed',
          },
          {
            icon: '💬',
            text: "WhatsApp us anytime — we're here before, during, and after your trip",
          },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <a
          href="https://wa.me/27000000000"
          style={{
            background: 'rgba(74,222,128,0.1)',
            border: '0.5px solid rgba(74,222,128,0.3)',
            color: T.green,
            padding: '12px 24px',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          WhatsApp your specialist
        </a>
        <a
          href="/"
          style={{
            background: T.goldDim,
            border: `0.5px solid ${T.borderGold}`,
            color: T.gold,
            padding: '12px 24px',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Plan another journey
        </a>
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.6 }}>
        Questions? Email us at{' '}
        <a
          href="mailto:journeys@thesafariedition.com"
          style={{ color: T.gold, textDecoration: 'none' }}
        >
          journeys@thesafariedition.com
        </a>
      </div>
    </div>
  );
}

export default function ConfirmedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080818',
        fontFamily: 'Arial,sans-serif',
        color: '#f5f0e8',
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');`}</style>

      {/* Header */}
      <div
        style={{
          background: '#0f0f1f',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          padding: '16px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display',serif",
            fontSize: 20,
            color: '#d4af37',
            fontWeight: 700,
          }}
        >
          ✦ The Safari Edition
        </div>
      </div>

      <Suspense
        fallback={
          <div style={{ color: '#d4af37', textAlign: 'center', padding: 40 }}>
            Loading…
          </div>
        }
      >
        <ConfirmedContent />
      </Suspense>
    </div>
  );
}
