import { useAuth, useConcerts, useSettings } from './hooks/useSupabase'
import AuthScreen from './components/AuthScreen'
import ConcertTracker from './components/ConcertTracker'

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth()
  const { concerts, loaded, saveConcert } = useConcerts(user?.id)
  const { settings, saveSetting } = useSettings(user?.id)

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0c0c14',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ color: '#a78bfa', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
          loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen onSignIn={signIn} />
  }

  if (!loaded) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0c0c14',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ color: '#a78bfa', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
          loading your shows...
        </div>
      </div>
    )
  }

  return (
    <ConcertTracker
      concerts={concerts}
      settings={settings}
      onSaveConcert={saveConcert}
      onUpdateSetting={saveSetting}
      onSignOut={signOut}
      userEmail={user.email}
    />
  )
}
