// * The app shell below the root error boundary. Its whole job is deciding *which*
// * of five mutually exclusive screens to show, and where ConcertTracker's data
// * comes from:
// *
// *   booting     → render nothing, leave the index.html splash up
// *   guestMode   → ConcertTracker fed from localStorage (useGuestMode)
// *   dbSleeping  → the "database is napping" recovery screen
// *   !user       → AuthScreen
// *   otherwise   → ConcertTracker fed from Supabase (useSupabase hooks)
// *
// * It also completes the Spotify OAuth redirect, since that lands on "/" and has to
// * be handled before any view renders.
import { Component, Suspense, lazy, useState, useEffect, useCallback } from 'react'
import { useAuth, useConcerts, useSettings } from './hooks/useSupabase'
import { DEFAULT_SETTINGS, SAMPLE_CONCERTS } from './lib/data'
import { exchangeCodeForTokens } from './lib/spotify'
import { publishInstallState } from './lib/appInstall'
import AuthScreen from './components/AuthScreen'
import ConcertTracker from './components/ConcertTracker'

// * Lazy-loaded so a failure in useRegisterSW (or the workbox-window chunk) cannot
// * crash the main App component. If the import fails, the banner just doesn't render.
const SWUpdateBanner = lazy(() =>
  import('./components/SWUpdateBanner').catch(() => ({ default: () => null }))
)

// * The app has exactly one loading screen and it lives in index.html, so it can
// * paint before any JS runs. This tears it down once real UI is on screen.
// * Idempotent — safe to call on every render pass.
function hideBootSplash() {
  const el = document.getElementById('boot-splash')
  if (!el || el.classList.contains('is-hiding')) return
  el.classList.add('is-hiding')
  setTimeout(() => el.remove(), 320)
}

// ============================================================
// ERROR BOUNDARY
// * Catches any unhandled render error and shows a friendly recovery screen.
// * Prevents a single bad concert from crashing the whole app.
// ============================================================

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
    // * The boot splash sits above #root, so it would hide this recovery screen.
    document.getElementById('boot-splash')?.remove()
  }

  render() {
    if (!this.state.error) return this.props.children
    const message = this.state.error?.message || String(this.state.error || 'Unknown render error')
    return (
      <div style={{ minHeight: '100vh', background: '#0c0c14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 360, width: '100%', background: '#13131f', border: '1px solid #f472b6', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#e2e0ff', marginBottom: 8 }}>Something crashed</div>
          <div style={{ color: '#6b6a8f', fontSize: 12, lineHeight: 1.6, fontFamily: "'DM Mono', monospace", marginBottom: 16 }}>The app hit a render error. Reloading should get you back without losing saved data.</div>
          <div style={{ color: '#f472b6', fontSize: 11, lineHeight: 1.5, fontFamily: "'DM Mono', monospace", marginBottom: 16, wordBreak: 'break-word' }}>{message}</div>
          <button onClick={() => window.location.reload()} style={{ width: '100%', minHeight: 40, borderRadius: 8, border: '1px solid #a78bfa', background: '#1a1a30', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>Reload app</button>
        </div>
      </div>
    )
  }
}

// * Shown only after the browser fires `beforeinstallprompt`, so it never appears on
// * iOS Safari (no such event) or when the PWA is already installed.
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

// ============================================================
// GUEST MODE
// * All state lives in localStorage (guest_concerts / guest_settings).
// * No Supabase calls are made in guest mode. clearGuest() wipes everything on exit.
// * SAMPLE_CONCERTS are loaded on first guest visit so there's something to explore.
// ============================================================

// * Mirrors the API surface of useConcerts + useSettings so ConcertTracker can be
// * handed either one without knowing the difference. Saves are synchronous but still
// * return { error: null } to match the async signature callers expect.
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

// ============================================================
// APP
// ============================================================

export default function App() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [guestMode, setGuestMode] = useState(() => localStorage.getItem('guest_mode') === 'true')
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false)
  const [pendingSpotifyExchange, setPendingSpotifyExchange] = useState(null)

  // * All custom hooks must be declared before any useEffect that references their
  // * return values in a dependency array — otherwise the dep array is evaluated
  // * while those const bindings are still in TDZ, causing a runtime crash.
  const guest = useGuestMode()
  const { user, loading: authLoading, signIn, signOut, dbSleeping } = useAuth()
  const { concerts, loaded, saveConcert, deleteConcert } = useConcerts(guestMode ? null : user?.id)
  const { settings, settingsLoaded, saveSetting, saveSettings } = useSettings(guestMode ? null : user?.id)

  // * Detect a Spotify OAuth callback (?code=…) on every fresh page load.
  // * Reads the code verifier + client ID from sessionStorage (written by startSpotifyAuth
  // * before the redirect), validates the state param against CSRF, then stores the
  // * exchange payload so the next effect can complete it once auth+settings are ready.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (code || error) history.replaceState({}, '', window.location.pathname)
    if (error || !code || !state) return

    const savedState = sessionStorage.getItem('spotify_oauth_state')
    const verifier = sessionStorage.getItem('spotify_code_verifier')
    const clientId = sessionStorage.getItem('spotify_oauth_client_id')

    sessionStorage.removeItem('spotify_oauth_state')
    sessionStorage.removeItem('spotify_code_verifier')
    sessionStorage.removeItem('spotify_oauth_client_id')

    if (state !== savedState || !verifier || !clientId) return
    setPendingSpotifyExchange({ code, verifier, clientId })
  }, [])

  // * Exchange the Spotify code for tokens once the user is authenticated and
  // * settings are loaded. Saves clientId + tokens together so they're always
  // * in sync (handles the case where the user hadn't saved Settings manually).
  // ! Must gate on settingsLoaded, not on concerts being loaded: this spreads
  // ! `settings` into a full overwrite, so running it while settings are still
  // ! DEFAULT_SETTINGS would wipe every real preference the user has.
  useEffect(() => {
    if (!pendingSpotifyExchange || !user || !settingsLoaded) return
    const { code, verifier, clientId } = pendingSpotifyExchange
    setPendingSpotifyExchange(null)
    exchangeCodeForTokens(code, verifier, clientId)
      .then(data => saveSettings({
        ...settings,
        spotifyClientId: clientId,
        spotifyAccessToken: data.access_token,
        spotifyRefreshToken: data.refresh_token,
        spotifyTokenExpiry: Date.now() + data.expires_in * 1000,
      }))
      .catch(err => console.error('Spotify token exchange failed:', err))
  }, [pendingSpotifyExchange, user, settingsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // * Tells the emergency fallback in index.html that React is alive. It used to
  // * infer that from #root having children, which no longer holds: while booting
  // * we render nothing and let the HTML splash stay up.
  useEffect(() => { window.__appMounted = true }, [])

  // * The captured event is published so Settings can offer the install too —
  // * dismissing the banner should mean "not now", not "never". Both listeners are
  // * cleaned up; `appinstalled` used to leak a handler on every remount.
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowBanner(true)
      publishInstallState({ available: true, prompt: () => e.prompt() })
    }
    const onInstalled = () => {
      setShowBanner(false)
      setInstallPrompt(null)
      publishInstallState({ available: false, prompt: null })
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    // ! A beforeinstallprompt event can only be prompted once, so whatever the
    // ! choice was, this one is spent — clear it everywhere.
    setInstallPrompt(null); setShowBanner(false)
    publishInstallState({ available: false, prompt: null })
  }

  // * Keep splash counts fresh after every load so the next visit's boot screen
  // * (rendered from index.html, before React exists) shows current stats
  useEffect(() => {
    if (!loaded) return
    const counts = {
      concerts: concerts.filter(c => c.type !== 'festival' && !c.wishlist && new Date(c.date + 'T00:00:00') <= new Date()).length,
      festivals: concerts.filter(c => c.type === 'festival' && !c.wishlist && new Date(c.date + 'T00:00:00') <= new Date()).length,
      upcoming: concerts.filter(c => !c.wishlist && new Date(c.date + 'T00:00:00') > new Date()).length,
    }
    try { localStorage.setItem('splash_counts', JSON.stringify(counts)) } catch { /* quota — counts are cosmetic */ }
  }, [loaded, concerts])

  // * Everything below renders real UI, so the boot splash comes down as soon as
  // * this flips false. Concerts are served from cache on a repeat visit, which
  // * means `loaded` is already true and there is usually nothing to wait for.
  const booting = !guestMode && (authLoading || (user && !loaded))

  useEffect(() => {
    if (!booting) hideBootSplash()
  }, [booting])

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

  // * The boot splash in index.html is still covering the screen — nothing to render.
  if (booting) return null

  if (guestMode) return (
    <>
      {!setupBannerDismissed && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#13121f', borderBottom: '1px solid #2a2550',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '9px 40px 9px 16px',
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, gap: 6,
        }}>
          <span style={{ color: '#6b6890' }}>Exploring as guest —</span>
          <a href="/setup.html" target="_blank" rel="noopener noreferrer"
            style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            want your own copy? →
          </a>
          <button onClick={() => setSetupBannerDismissed(true)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#4a4870',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '4px 6px',
            fontFamily: 'inherit',
          }}>×</button>
        </div>
      )}
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
          settingsLoaded
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

  if (!user) return <><AuthScreen onSignIn={signIn} onGuest={enterGuest} />{banner}</>

  return (
    <>
      <Suspense fallback={null}>
        <SWUpdateBanner />
      </Suspense>
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
          settingsLoaded={settingsLoaded}
        />
      </AppErrorBoundary>
      {banner}
    </>
  )
}
