import { Component, useState, useEffect, useCallback } from 'react'
import { useAuth, useConcerts, useSettings } from './hooks/useSupabase'
import { DEFAULT_SETTINGS, SAMPLE_CONCERTS } from './lib/data'
import AuthScreen from './components/AuthScreen'
import ConcertTracker from './components/ConcertTracker'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 360, width: '100%', background: '#13131f', border: '1px solid #f472b6', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#e2e0ff', marginBottom: 8 }}>Something crashed</div>
          <div style={{ color: '#6b6a8f', fontSize: 12, lineHeight: 1.6, fontFamily: "'DM Mono', monospace", marginBottom: 16 }}>The app hit a render error. Reloading should get you back without losing saved data.</div>
          <button onClick={() => window.location.reload()} style={{ width: '100%', minHeight: 40, borderRadius: 8, border: '1px solid #a78bfa', background: '#1a1a30', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>Reload app</button>
        </div>
      </div>
    )
  }
}

function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448,
      background: '#1a1a30', border: '1px solid #a78bfa', borderRadius: 12,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#e2e0ff' }}>Install settracker</div>
        <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Add to home screen for the full app experience</div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
      <button onClick={onInstall} style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '7px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>Install</button>
    </div>
  )
}

function useGuestMode() {
  const [concerts, setConcerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('guest_concerts') || '[]') } catch { return [] }
  })
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('guest_settings') || '{}') } } catch { return DEFAULT_SETTINGS }
  })

  const saveConcert = useCallback((concert) => {
    setConcerts(prev => {
      const next = prev.some(c => c.id === concert.id)
        ? prev.map(c => c.id === concert.id ? concert : c)
        : [...prev, concert]
      localStorage.setItem('guest_concerts', JSON.stringify(next))
      return next
    })
    return { error: null }
  }, [])

  const deleteConcert = useCallback((id) => {
    setConcerts(prev => {
      const next = prev.filter(c => c.id !== id)
      localStorage.setItem('guest_concerts', JSON.stringify(next))
      return next
    })
    return { error: null }
  }, [])

  const saveSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('guest_settings', JSON.stringify(next))
      return next
    })
  }, [])

  const saveSettings = useCallback((next) => {
    localStorage.setItem('guest_settings', JSON.stringify(next))
    setSettings(next)
    return { error: null }
  }, [])

  const clearGuest = () => {
    localStorage.removeItem('guest_concerts')
    localStorage.removeItem('guest_settings')
    localStorage.removeItem('guest_mode')
  }

  const initWithSamples = useCallback((samples) => {
    localStorage.setItem('guest_concerts', JSON.stringify(samples))
    setConcerts(samples)
  }, [])

  return { concerts, settings, saveConcert, deleteConcert, saveSetting, saveSettings, clearGuest, initWithSamples }
}

export default function App() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem('guest_mode') === 'true')

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowBanner(true) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setShowBanner(false))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Detect when a new service worker has taken over → show update banner
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      // fired when a new SW activates after skipWaiting
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateReady(true)
      })
      // also check if there's already a waiting SW on load
      if (reg.waiting) setUpdateReady(true)
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true)
          }
        })
      })
    })
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null); setShowBanner(false)
  }

  const guest = useGuestMode()
  const { user, loading: authLoading, signIn, signOut, dbSleeping } = useAuth()
  const { concerts, loaded, saveConcert, deleteConcert } = useConcerts(guestMode ? null : user?.id)
  const { settings, saveSetting, saveSettings } = useSettings(guestMode ? null : user?.id)

  const enterGuest = () => {
    localStorage.setItem('guest_mode', 'true')
    if (!localStorage.getItem('guest_concerts')) {
      guest.initWithSamples(SAMPLE_CONCERTS)
    }
    setGuestMode(true)
  }

  const exitGuest = () => {
    guest.clearGuest()
    setGuestMode(false)
  }

  const banner = showBanner && <InstallBanner onInstall={handleInstall} onDismiss={() => setShowBanner(false)} />

  if (guestMode) return (
    <>
      <AppErrorBoundary>
        <ConcertTracker
          concerts={guest.concerts}
          settings={guest.settings}
          onSaveConcert={guest.saveConcert}
          onDeleteConcert={guest.deleteConcert}
          onUpdateSetting={guest.saveSetting}
          onUpdateSettings={guest.saveSettings}
          onSignOut={exitGuest}
          userEmail="guest"
        />
      </AppErrorBoundary>
      {banner}
    </>
  )

  if (dbSleeping) return (
    <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 320, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>💤</div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#e2e0ff', marginBottom: 10 }}>database is napping</div>
        <div style={{ fontSize: 13, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", lineHeight: 1.7, marginBottom: 28 }}>
          Supabase pauses free projects after a week of inactivity. Your data is fine — it just needs a nudge.
        </div>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: '#a78bfa', color: '#0c0c14', textDecoration: 'none', fontFamily: "'Syne', sans-serif", marginBottom: 10, boxSizing: 'border-box' }}
        >
          wake it up →
        </a>
        <button
          onClick={() => window.location.reload()}
          style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 13, background: 'none', border: '1px solid #1f1f35', color: '#6b6a8f', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
        >
          try again
        </button>
        <div style={{ fontSize: 11, color: '#2e2e4a', fontFamily: "'DM Mono', monospace", marginTop: 16 }}>
          go to your project → click restore → come back and try again
        </div>
      </div>
    </div>
  )

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#a78bfa', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>loading...</div>
      {banner}
    </div>
  )

  if (!user) return <><AuthScreen onSignIn={signIn} onGuest={enterGuest} />{banner}</>

  if (!loaded) return (
    <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#a78bfa', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>loading your shows...</div>
      {banner}
    </div>
  )

  return (
    <>
      {updateReady && (
        <div style={{
          position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)', maxWidth: 448,
          background: '#1a1a30', border: '1px solid #a78bfa', borderRadius: 12,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#e2e0ff' }}>Update available</div>
            <div style={{ fontSize: 11, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>A new version of settracker is ready</div>
          </div>
          <button onClick={() => setUpdateReady(false)} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
          <button onClick={() => window.location.reload()} style={{ background: '#a78bfa', border: 'none', borderRadius: 8, color: '#0c0c14', fontSize: 12, fontWeight: 700, padding: '7px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>Update</button>
        </div>
      )}
      <AppErrorBoundary>
        <ConcertTracker
          concerts={concerts}
          settings={settings}
          onSaveConcert={saveConcert}
          onDeleteConcert={deleteConcert}
          onUpdateSetting={saveSetting}
          onUpdateSettings={saveSettings}
          onSignOut={signOut}
          userEmail={user.email}
        />
      </AppErrorBoundary>
      {banner}
    </>
  )
}
