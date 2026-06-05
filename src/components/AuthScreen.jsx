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

  const bars = [
    { anim: 'bar1', dur: '0.9s', delay: '0.00s' },
    { anim: 'bar2', dur: '0.7s', delay: '0.12s' },
    { anim: 'bar3', dur: '1.1s', delay: '0.05s' },
    { anim: 'bar4', dur: '0.8s', delay: '0.20s' },
    { anim: 'bar5', dur: '1.0s', delay: '0.08s' },
    { anim: 'bar6', dur: '0.75s', delay: '0.16s' },
    { anim: 'bar7', dur: '0.95s', delay: '0.04s' },
    { anim: 'bar8', dur: '0.85s', delay: '0.24s' },
    { anim: 'bar9', dur: '1.05s', delay: '0.10s' },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: '#0c0c14',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', fontFamily: "'DM Sans', sans-serif"
    }}>
      <style>{`
        @keyframes bar1 { 0%,100%{height:6px}  50%{height:28px} }
        @keyframes bar2 { 0%,100%{height:18px} 50%{height:6px}  }
        @keyframes bar3 { 0%,100%{height:10px} 50%{height:34px} }
        @keyframes bar4 { 0%,100%{height:26px} 50%{height:8px}  }
        @keyframes bar5 { 0%,100%{height:8px}  40%{height:28px} 80%{height:14px} }
        @keyframes bar6 { 0%,100%{height:20px} 50%{height:6px}  }
        @keyframes bar7 { 0%,100%{height:6px}  30%{height:24px} 70%{height:10px} }
        @keyframes bar8 { 0%,100%{height:14px} 50%{height:30px} }
        @keyframes bar9 { 0%,100%{height:22px} 50%{height:8px}  }
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-block-1 { animation: authFadeUp 0.55s 0.05s ease both; }
        .auth-block-2 { animation: authFadeUp 0.55s 0.18s ease both; }
        .auth-block-3 { animation: authFadeUp 0.55s 0.30s ease both; }
        .auth-input:focus { outline: none; border-color: #a78bfa !important; }
      `}</style>

      <div style={{ maxWidth: 360, width: '100%' }}>

        {/* Hero: wave + title */}
        <div className="auth-block-1" style={{ textAlign: 'center', marginBottom: 36 }}>
          {/* Animated sound wave bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 5, height: 40, marginBottom: 24 }}>
            {bars.map((b, i) => (
              <div key={i} style={{
                width: 4, borderRadius: 2, minHeight: 4,
                background: i < 4
                  ? `linear-gradient(to top, #a78bfa, #c4b5fd)`
                  : i < 7
                  ? `linear-gradient(to top, #818cf8, #a78bfa)`
                  : `linear-gradient(to top, #6d5fa8, #818cf8)`,
                animation: `${b.anim} ${b.dur} ${b.delay} ease-in-out infinite`,
              }} />
            ))}
          </div>

          {/* Title */}
          <div style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800, lineHeight: 1,
            letterSpacing: '-0.03em', marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, color: '#5a5880', fontFamily: "'DM Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 400, display: 'block', marginBottom: 6 }}>
              ♪ &nbsp; your concert log
            </span>
            <span style={{ fontSize: 48, color: '#e2e0ff', display: 'block' }}>
              set
              <span style={{ color: '#a78bfa' }}>tracker</span>
            </span>
          </div>

          <div style={{ fontSize: 13, color: '#4a4870', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            every show, remembered.
          </div>
        </div>

        {/* Feature pills */}
        <div className="auth-block-2" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
          {['track shows', 'rate nights', 'find patterns', 'friend profiles'].map(label => (
            <span key={label} style={{
              fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em',
              padding: '4px 11px', borderRadius: 99,
              background: '#13131f', border: '1px solid #1f1f35', color: '#5a5880'
            }}>{label}</span>
          ))}
        </div>

        {/* Form card */}
        <div className="auth-block-3" style={{
          background: '#13131f', border: '1px solid #1f1f35',
          borderRadius: 16, padding: '24px'
        }}>
          {!sent ? (
            <>
              <div style={{ fontSize: 12, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginBottom: 14, lineHeight: 1.6 }}>
                enter email → magic link → no password needed
              </div>

              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="your@email.com"
                autoFocus
                style={{
                  width: '100%', background: '#0c0c14', border: '1px solid #2e2e50',
                  borderRadius: 10, color: '#e2e0ff', padding: '12px 16px',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15,
                  boxSizing: 'border-box', marginBottom: 10, transition: 'border-color 0.15s'
                }}
              />

              {error && (
                <div style={{ fontSize: 12, color: '#f472b6', marginBottom: 10 }}>{error}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !email.trim()}
                style={{
                  width: '100%', padding: '13px', borderRadius: 10, fontSize: 14,
                  fontWeight: 700, cursor: loading ? 'wait' : email.trim() ? 'pointer' : 'default',
                  background: email.trim() ? '#a78bfa' : '#1a1a30',
                  color: email.trim() ? '#0c0c14' : '#4a4870',
                  border: 'none', fontFamily: "'Syne', sans-serif",
                  transition: 'all 0.2s', letterSpacing: '-0.01em'
                }}
              >
                {loading ? 'sending...' : 'send magic link'}
              </button>

              {onGuest && (
                <button
                  onClick={onGuest}
                  style={{
                    width: '100%', padding: '11px', borderRadius: 10, fontSize: 13,
                    cursor: 'pointer', background: 'none', marginTop: 8,
                    border: '1px solid #1f1f35', color: '#4a4870',
                    fontFamily: "'DM Mono', monospace", transition: 'all 0.2s'
                  }}
                >
                  continue as guest
                </button>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              {/* Mini wave in sent state */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 28, marginBottom: 16 }}>
                {bars.slice(0, 5).map((b, i) => (
                  <div key={i} style={{
                    width: 3, borderRadius: 2, minHeight: 3,
                    background: 'linear-gradient(to top, #a78bfa, #c4b5fd)',
                    animation: `${b.anim} ${b.dur} ${b.delay} ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 14, color: '#e2e0ff', fontWeight: 700, fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>
                check your email
              </div>
              <div style={{ fontSize: 13, color: '#6b6a8f', lineHeight: 1.6, fontFamily: "'DM Mono', monospace" }}>
                magic link sent to<br />
                <span style={{ color: '#a78bfa' }}>{email}</span>
              </div>
              <button
                onClick={() => setSent(false)}
                style={{
                  marginTop: 16, background: 'none', border: 'none',
                  color: '#4a4870', fontSize: 11, cursor: 'pointer',
                  fontFamily: "'DM Mono', monospace", textDecoration: 'underline'
                }}
              >
                use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
