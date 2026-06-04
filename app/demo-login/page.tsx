'use client';
import { useState } from 'react';

export default function DemoLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = '/';
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
      <div style={{ textAlign: 'center', width: 320 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #d4af37, #f0c040)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 900, color: '#0a0a0a',
          margin: '0 auto 20px',
        }}>✦</div>

        <p style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22, color: '#d4af37',
          marginBottom: 6, fontWeight: 700,
        }}>The Safari Edition</p>

        <p style={{
          fontSize: 12, color: 'rgba(245,240,232,0.35)',
          letterSpacing: '0.15em', textTransform: 'uppercase',
          marginBottom: 36,
        }}>Private Preview</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter access code"
            autoFocus
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${error ? '#f87171' : 'rgba(212,175,55,0.4)'}`,
              color: '#f5f0e8',
              padding: '13px 18px',
              borderRadius: 10,
              fontSize: 15,
              outline: 'none',
              fontFamily: 'inherit',
              textAlign: 'center',
              letterSpacing: '0.1em',
            }}
          />
          {error && (
            <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>
              Incorrect access code
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              background: password && !loading
                ? 'linear-gradient(135deg, #d4af37, #f0c040)'
                : 'rgba(255,255,255,0.06)',
              color: password && !loading ? '#0a0a0a' : 'rgba(245,240,232,0.3)',
              border: 'none',
              padding: '13px 32px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: password && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '...' : 'Enter →'}
          </button>
        </form>
      </div>
    </div>
  );
}
