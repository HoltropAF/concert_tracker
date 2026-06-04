import { useState } from 'react'

export default function AuthScreen({ onSignIn, onGuest }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await onSignIn(email.trim())
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0c0c14',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#e2e0ff', lineHeight: 1 }}>
            settracker
          </div>
          <div style={{ fontSize: 13, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 6 }}>
            your personal concert log
          </div>
        </div>

        {!sent ? (
          <>
            <div style={{ fontSize: 13, color: '#c4c2f0', marginBottom: 20, lineHeight: 1.5 }}>
              Enter your email to get a magic link — no password needed.
            </div>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="your@email.com"
              autoFocus
              style={{
                width: '100%', background: '#13131f', border: '1px solid #2e2e50',
                borderRadius: 10, color: '#e2e0ff', padding: '12px 16px',
                fontFamily: "'DM Sans', sans-serif", fontSize: 15,
                boxSizing: 'border-box', marginBottom: 12, outline: 'none'
              }}
            />

            {error && (
              <div style={{ fontSize: 12, color: '#f472b6', marginBottom: 12 }}>{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !email.trim()}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, fontSize: 14,
                fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                background: email.trim() ? '#a78bfa' : '#1a1a30',
                color: email.trim() ? '#0c0c14' : '#4a4870',
                border: 'none', fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>

            {onGuest && (
              <button
                onClick={onGuest}
                style={{
                  width: '100%', padding: '13px', borderRadius: 10, fontSize: 14,
                  cursor: 'pointer', background: 'none', marginTop: 10,
                  border: '1px solid #1f1f35', color: '#6b6a8f',
                  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s'
                }}
              >
                Continue as guest
              </button>
            )}
          </>
        ) : (
          <div style={{
            background: '#13131f', border: '1px solid #1f1f35', borderRadius: 12, padding: '24px'
          }}>
            <div style={{ fontSize: 22, marginBottom: 12 }}>📬</div>
            <div style={{ fontSize: 14, color: '#e2e0ff', fontWeight: 600, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 13, color: '#6b6a8f', lineHeight: 1.5 }}>
              We sent a magic link to <span style={{ color: '#a78bfa' }}>{email}</span>.<br />
              Click it to sign in — works on any device.
            </div>
            <button
              onClick={() => setSent(false)}
              style={{
                marginTop: 16, background: 'none', border: 'none',
                color: '#6b6a8f', fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Mono', monospace", textDecoration: 'underline'
              }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
