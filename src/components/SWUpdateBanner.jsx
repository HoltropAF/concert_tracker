import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// * Self-contained: owns the SW registration hook and changelog state.
// * Isolated here so a failure in useRegisterSW cannot crash the main App.
export default function SWUpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  const [showChangelog, setShowChangelog] = useState(false)
  const [changelogText, setChangelogText] = useState(null)

  if (!needRefresh) return null

  const toggleChangelog = async () => {
    if (!showChangelog && changelogText === null) {
      try {
        const res = await fetch(`/changelog.md?v=${Date.now()}`, { cache: 'no-store' })
        setChangelogText(res.ok ? await res.text() : '')
      } catch {
        setChangelogText('')
      }
    }
    setShowChangelog(v => !v)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448,
      background: '#1a1a30', border: '1px solid #a78bfa', borderRadius: 12,
      padding: '12px 16px',
      zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#e2e0ff' }}>Update available</div>
          <button onClick={toggleChangelog} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 11, color: '#a78bfa', fontFamily: "'DM Mono', monospace",
            marginTop: 3, display: 'block', textDecoration: 'underline', textUnderlineOffset: 2
          }}>
            {showChangelog ? 'hide changes ▲' : "what's changed ▾"}
          </button>
        </div>
        <button
          onClick={() => { setNeedRefresh(false); setShowChangelog(false) }}
          style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
        >×</button>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '7px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}
        >Update</button>
      </div>
      {showChangelog && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid #2a2850',
          maxHeight: '60vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch'
        }}>
          {changelogText === null ? (
            <div style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Sans', sans-serif" }}>loading...</div>
          ) : !changelogText.trim() ? (
            <div style={{ fontSize: 12, color: '#6b6a8f', fontFamily: "'DM Sans', sans-serif" }}>No release notes yet.</div>
          ) : (
            changelogText.trim().split('\n').map((line, i) => {
              const trimmed = line.trim()
              if (!trimmed) return null
              if (trimmed.startsWith('# ')) return null
              if (trimmed.startsWith('## ')) {
                return (
                  <div key={i} style={{
                    fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: '#a78bfa',
                    marginTop: i === 0 ? 0 : 14, marginBottom: 6
                  }}>{trimmed.slice(3)}</div>
                )
              }
              if (trimmed.startsWith('- ')) {
                return (
                  <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
                    <span style={{ color: '#a78bfa', fontSize: 13, lineHeight: '19px', flexShrink: 0 }}>•</span>
                    <span style={{ fontSize: 13, color: '#c4c2f0', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{trimmed.slice(2)}</span>
                  </div>
                )
              }
              return <div key={i} style={{ fontSize: 13, color: '#c4c2f0', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, marginBottom: 6 }}>{trimmed}</div>
            })
          )}
        </div>
      )}
    </div>
  )
}
