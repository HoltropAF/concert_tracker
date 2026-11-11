import { useEffect, useRef, useState } from 'react'
import './WelcomeFlow.css'

function installHint() {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'Open settracker in Safari, tap Share, then Add to Home Screen.'
  }
  return 'Open settracker in Chrome or Edge and choose Install app or Add to home screen from the browser menu.'
}

export default function WelcomeFlow({ onSignIn, onGuest, onInstall, installAvailable = false }) {
  const [email, setEmail] = useState('')
  const [sentEmail, setSentEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    return params.has('error') ? 'This email link is invalid or has expired. Request a fresh link below.' : ''
  })
  const [installMessage, setInstallMessage] = useState('')
  const [installing, setInstalling] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const inFlight = useRef(false)
  const heading = useRef(null)
  const emailInput = useRef(null)

  useEffect(() => {
    if (sentEmail) heading.current?.focus()
  }, [sentEmail, retryAt])

  useEffect(() => {
    if (!retryAt) return
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [retryAt])

  const send = async event => {
    event.preventDefault()
    const address = sentEmail || email.trim()
    if (inFlight.current || Date.now() < retryAt) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address, like you@example.com.')
      return
    }
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const result = await onSignIn(address, { shouldCreateUser: true })
      if (result?.error) throw result.error
      setSentEmail(address)
      setRetryAt(Date.now() + 60000)
    } catch (err) {
      if (err?.status === 429 || /rate|too many/i.test(err?.message || '')) {
        setError('Too many requests. Wait a little and check for an earlier email.')
      } else if (err?.code === 'email_address_not_authorized' || err?.code === 'signup_disabled') {
        setError('This site can’t send an account link to this address. Ask the person who shared settracker with you, or try the demo.')
      } else {
        setError('We couldn’t send the link. Check your connection and email address, then try again.')
      }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const install = async () => {
    setInstalling(true)
    try {
      const result = await onInstall?.()
      setInstallMessage(result?.outcome === 'accepted' ? 'Installation accepted. Look for settracker on your device.' : 'You can install later from your browser.')
    } catch {
      setInstallMessage('The install prompt couldn’t open. Try the browser steps above.')
    } finally {
      setInstalling(false)
    }
  }

  const waiting = remaining > 0
  return (
    <section className="welcome-flow" aria-label="Welcome to settracker">
      <h1 ref={heading} tabIndex={-1}>{sentEmail ? 'Check your inbox' : 'Your concert log starts here'}</h1>
      <form onSubmit={send}>
        {sentEmail ? <>
          <p>We sent a link to <strong className="wf-email">{sentEmail}</strong></p>
          <p>Open the newest email and tap the link to start your log or pick up where you left off.</p>
          <details>
            <summary>Can’t find the email?</summary>
            <p>Check spam or junk, or request another link. Use the newest email. Each link works once.</p>
          </details>
        </> : <>
          <p>Use your email to start a private concert log or open your existing one.</p>
          <label htmlFor="welcome-email">Email address</label>
          <input ref={emailInput} id="welcome-email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
            value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" disabled={busy}
            aria-describedby={error ? 'welcome-error' : undefined} />
        </>}
        <button className="wf-primary" type="submit" disabled={busy || waiting || !email.trim()}>
          {busy ? 'Sending…' : waiting ? `Send again in ${remaining}s` : sentEmail ? 'Send another link' : 'Email me a link'}
        </button>
        {sentEmail && <button className="wf-link" type="button" disabled={busy} onClick={() => {
          setSentEmail('')
          setError('')
          requestAnimationFrame(() => emailInput.current?.focus())
        }}>Change email</button>}
        {error && <p className="wf-error" id="welcome-error" role="alert">{error}</p>}
      </form>
      {onGuest && <button className="wf-link" type="button" onClick={onGuest}>Try the demo</button>}
      <details>
        <summary>Install on your device</summary>
        <p>{installHint()} You can also use settracker right here in your browser.</p>
        {installAvailable && <button className="wf-primary" type="button" disabled={installing} onClick={install}>{installing ? 'Opening installer…' : 'Install settracker'}</button>}
        {installMessage && <p role="status">{installMessage}</p>}
      </details>
    </section>
  )
}
