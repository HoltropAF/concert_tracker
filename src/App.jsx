import { useState, useEffect, useCallback } from 'react'
import { useAuth, useConcerts, useSettings } from './hooks/useSupabase'
import { DEFAULT_SETTINGS } from './lib/data'
import AuthScreen from './components/AuthScreen'
import ConcertTracker from './components/ConcertTracker'

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
  }, [])

  const deleteConcert = useCallback((id) => {
    setConcerts(prev => {
      const next = prev.filter(c => c.id !== id)
      localStorage.setItem('guest_concerts', JSON.stringify(next))
      return next
    })
  }, [])

  const saveSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('guest_settings', JSON.stringify(next))
      return next
    })
  }, [])

  const clearGuest = () => {
    localStorage.removeItem('guest_concerts')
    localStorage.removeItem('guest_settings')
    localStorage.removeItem('guest_mode')
  }

  return { concerts, settings, saveConcert, deleteConcert, saveSetting, clearGuest }
}

export default function App() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem('guest_mode') === 'true')

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowBanner(true) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setShowBanner(false))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null); setShowBanner(false)
  }

  const guest = useGuestMode()
  const { user, loading: authLoading, signIn, signOut } = useAuth()
  const { concerts, loaded, saveConcert, deleteConcert } = useConcerts(guestMode ? null : user?.id)
  const { settings, saveSetting } = useSettings(guestMode ? null : user?.id)

  const enterGuest = () => {
    localStorage.setItem('guest_mode', 'true')
    setGuestMode(true)
  }

  const exitGuest = () => {
    guest.clearGuest()
    setGuestMode(false)
  }

  const banner = showBanner && <InstallBanner onInstall={handleInstall} onDismiss={() => setShowBanner(false)} />

  if (guestMode) return (
    <>
      <ConcertTracker
        concerts={guest.concerts}
        settings={guest.settings}
        onSaveConcert={guest.saveConcert}
        onDeleteConcert={guest.deleteConcert}
        onUpdateSetting={guest.saveSetting}
        onSignOut={exitGuest}
        userEmail="guest"
      />
      {banner}
    </>
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
      <ConcertTracker
        concerts={concerts}
        settings={settings}
        onSaveConcert={saveConcert}
        onDeleteConcert={deleteConcert}
        onUpdateSetting={saveSetting}
        onSignOut={signOut}
        userEmail={user.email}
      />
      {banner}
    </>
  )
}
