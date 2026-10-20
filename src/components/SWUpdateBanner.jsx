import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { checkAppUpdate } from '../lib/checkAppUpdate'
import { publishUpdateState } from '../lib/swUpdate'

// * Self-contained: owns the SW registration hook. Isolated here so a failure in
// * useRegisterSW cannot crash the main App.
// *
// * The banner is deliberately one line. It used to expand the entire changelog
// * inline, which made a "there's an update" notice into a wall of text you had to
// * read past. Release notes now live in Settings, where there's room for them.
// *
// * Dismissing means *later*, not never: the pending state is published to the
// * shared store so Settings keeps offering the update until it's taken.
export default function SWUpdateBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [registration, setRegistration] = useState(null)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) { setRegistration(reg) },
    onRegisterError() { publishUpdateState({ result: 'failed' }) },
  })
  useEffect(() => {
    publishUpdateState({ check: async () => {
      publishUpdateState({ checking: true, result: null })
      const result = await checkAppUpdate(registration, { online: navigator.onLine })
      publishUpdateState({ checking: false, result, checkedAt: Date.now(), ...(result === 'found' ? { pending: true } : {}) })
      if (result === 'found') setDismissed(false)
    } })
  }, [registration])

  useEffect(() => {
    if (needRefresh) setDismissed(false)
    publishUpdateState({ pending: needRefresh, apply: () => updateServiceWorker(true) })
  }, [needRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!needRefresh || dismissed) return null

  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448,
      background: '#1a1a30', border: '1px solid #f87171', borderRadius: 12,
      padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
      zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
    }}>
      {/* A red dot rather than a red banner — enough to catch the eye without
          making a routine update look like something went wrong. */}
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#e2e0ff' }}>
        New version available
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', color: '#6b6a8f', cursor: 'pointer', fontSize: 11, fontFamily: "'DM Mono', monospace", padding: '4px 2px', flexShrink: 0 }}
      >Later</button>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '7px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}
      >Update</button>
    </div>
  )
}
