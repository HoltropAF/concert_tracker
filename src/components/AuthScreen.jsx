import { useState } from 'react'

// * The signed-out landing page. Email-only: `onSignIn(email)` sends a magic link and
// * is expected to resolve to { error }, never to throw. There is no sign-up path
// * because the first magic link for an address creates the account.
// * `onGuest` is optional — when omitted the "explore it first" link is hidden, so the
// * same screen works in a deployment where guest mode isn't offered.
// ! Purely presentational: it does not know whether the user is authenticated. App
// ! decides whether to render this or ConcertTracker.
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
        <div className="auth-block-1" style={{ textAlign: 'center', marginBottom: 36, paddingTop: 48 }}>
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
            <span style={{ fontSize: 13, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 400, display: 'block', marginBottom: 8 }}>
              your concert log
            </span>
            <span style={{ fontSize: 36, color: '#e2e0ff', display: 'block' }}>
              set<span style={{ color: '#a78bfa' }}>tracker</span>
            </span>
          </div>

          <div style={{ fontSize: 13, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            Every. Show. Remembered.
          </div>
        </div>

        {/* Feature pills */}
        <div className="auth-block-2" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 128 }}>
          {['track shows', 'rate nights', 'find patterns', 'friend profiles'].map(label => (
            <span key={label} style={{
              fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em',
              padding: '4px 11px', borderRadius: 99,
              background: '#13131f', border: '1px solid #1f1f35', color: '#7a78a0'
            }}>{label}</span>
          ))}
        </div>

        {/* Form card */}
        <div className="auth-block-3" style={{
          background: '#13131f', border: '1px solid #1f1f35',
          borderRadius: 16, padding: '24px', marginBottom: 20
        }}>
          {!sent ? (
            <>
              <div style={{ fontSize: 13, color: '#a78bfa', fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: 4 }}>
                sign in
              </div>
              <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
                new or returning — magic link, max twice an hour
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
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button onClick={onGuest} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#4a4870', fontFamily: "'DM Sans', sans-serif",
                    fontStyle: 'italic'
                  }}>
                    or explore it first
                  </button>
                </div>
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
        {/* Social links */}
        <div className="auth-block-3" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', marginBottom: 10 }}>find me on</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {[
            {
              href: 'https://github.com/HoltropAF/concert_tracker',
              label: 'GitHub',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            },
            {
              href: 'https://www.threads.com/@annuhfloor',
              label: 'Threads',
              icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161"/></svg>
            },
            {
              href: 'https://www.tiktok.com/@annuhfloor98',
              label: 'TikTok',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
            },
            {
              href: 'https://www.vinted.nl/member/50873825',
              label: 'Vinted',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/></svg>
            },
            {
              href: 'https://open.spotify.com/user/lxvqdy1rt317aiskee5fh6bpm',
              label: 'Spotify',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            },
          ].map(({ href, label, icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10,
                background: '#13131f', border: '1px solid #1f1f35',
                color: '#4a4870', textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s'
              }}
            >{icon}</a>
          ))}
          </div>
        </div>

      </div>
    </div>
  )
}
