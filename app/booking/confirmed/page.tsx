'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Redirect() {
  const params = useSearchParams();
  const ref  = params.get('ref');
  const type = params.get('type'); // 'quote' | 'hold' | undefined (deposit)

  useEffect(() => {
    if (ref) {
      // Redirect to the journey mini-site with the booking reference
      const mode = type === 'quote' || type === 'hold' ? 'quote' : 'confirmed';
      window.location.replace(`/journey/${ref}?mode=${mode}`);
    }
  }, [ref, type]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20,
    }}>
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(200,169,110,0.3)', transform: 'rotate(45deg)', animation: 'spin 4s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 12, background: 'rgba(200,169,110,0.85)', transform: 'rotate(45deg)' }} />
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: '#c8a96e', letterSpacing: '0.1em' }}>
        Opening your journey…
      </div>
      <style>{`@keyframes spin { to { transform: rotate(calc(45deg + 360deg)) } }`}</style>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#c8a96e', fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>Opening your journey…</div>
      </div>
    }>
      <Redirect />
    </Suspense>
  );
}
