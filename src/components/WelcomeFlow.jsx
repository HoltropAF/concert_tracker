import { useEffect, useRef, useState } from 'react'
import './WelcomeFlow.css'

const deviceType = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop'
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

export default function WelcomeFlow({ onSignIn, onGuest, onInstall, installAvailable = false }) {
  const [path, setPath] = useState(null)
  const [step, setStep] = useState('choose')
  const [device, setDevice] = useState(deviceType)
  const [installed, setInstalled] = useState(isInstalled)
  const [email, setEmail] = useState('')
  const [sentEmail, setSentEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [installMessage, setInstallMessage] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const inFlight = useRef(false)
  const heading = useRef(null)
  useEffect(() => { heading.current?.focus() }, [step])
  useEffect(() => {
    const done = () => { setInstalled(true); setInstallMessage('Installed. Open settracker from your home screen or continue here.') }
    window.addEventListener('appinstalled', done)
    return () => window.removeEventListener('appinstalled', done)
  }, [])
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [retryAt])
  const choose = value => { setPath(value); setError(''); setStep(value === 'new' && !installed ? 'install' : 'email') }
  const send = async event => {
    event?.preventDefault()
    if (inFlight.current || Date.now() < retryAt) return
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError('Enter a valid email address, like you@example.com.'); return }
    inFlight.current = true
    setBusy(true); setError('')
    try {
      const result = await onSignIn(address, { shouldCreateUser: path === 'new' })
      if (result?.error) throw result.error
      setSentEmail(address); setRetryAt(Date.now() + 60000); setStep('sent')
    } catch (err) {
      setError(err?.status === 429 || /rate|too many/i.test(err?.message || '')
        ? 'Too many requests. Wait a little before trying again, and check for an earlier email.'
        : 'We couldn’t send the link. Check your connection and email address, then try again. If you’re new, choose “I’m new” first.')
    } finally { inFlight.current = false; setBusy(false) }
  }
  const install = async () => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setInstallMessage('')
    try {
      const result = await onInstall?.()
      setInstallMessage(result?.outcome === 'accepted' ? 'Installation accepted. Look for settracker on your device.' : 'You can install later, or follow the steps below.')
    } catch { setInstallMessage('The install prompt couldn’t open. Follow the steps below, or continue in your browser.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <section className="welcome-flow" aria-label="Welcome to settracker">
    {step !== 'choose' && <button className="wf-back" disabled={busy} onClick={() => { setError(''); setStep(step === 'sent' ? 'email' : 'choose') }}>← {step === 'sent' ? 'Change email' : 'Back'}</button>}
    {path === 'new' && step !== 'choose' && <div className="wf-progress" aria-label="Setup progress"><span className={step === 'install' ? 'current' : ''}>{step === 'install' ? '1' : '✓'} Install · optional</span><span className={step === 'email' ? 'current' : ''}>2 Email</span><span className={step === 'sent' ? 'current' : ''}>3 Open link</span></div>}
    <h1 ref={heading} tabIndex={-1}>{step === 'choose' ? 'Your next great night starts here.' : step === 'install' ? 'Keep settracker close' : step === 'sent' ? 'Check your inbox' : path === 'new' ? 'Create your concert log' : 'Welcome back'}</h1>
    {step === 'choose' && <>
      <p>New here, or picking up where you left off?</p>
      <button className="wf-choice" onClick={() => choose('new')}><strong>I’m new <span aria-hidden="true">→</span></strong><small>Get set up, install the app, and start your log.</small></button>
      <button className="wf-choice" onClick={() => choose('returning')}><strong>Log in <span aria-hidden="true">→</span></strong><small>Get back to your shows with an email link.</small></button>
      {onGuest && <button className="wf-link" onClick={onGuest}>Explore a demo first</button>}
    </>}
    {step === 'install' && <>
      <p>Settracker installs straight from this website. No app-store download or extra software needed. You can also use it in your browser.</p>
      <label htmlFor="setup-device">Your device</label>
      <select id="setup-device" value={device} onChange={e => setDevice(e.target.value)}><option value="ios">iPhone or iPad</option><option value="android">Android</option><option value="desktop">Computer</option></select>
      {installed ? <p role="status">✓ You’re already using the installed app.</p> : <>
        {installAvailable && <button className="wf-primary" disabled={busy} onClick={install}>{busy ? 'Opening installer…' : 'Install settracker'}</button>}
        <ol className="wf-steps">{(device === 'ios' ? [<>Open this website in <b>Safari</b>.</>, <>Tap <b>Share</b> (you may need to open the menu first), then <b>Add to Home Screen</b>.</>, <>Keep <b>Open as Web App</b> on if shown, then tap <b>Add</b>.</>, <>Open <b>settracker</b> from your home screen and choose <b>I’m new</b> to create your log.</>] : device === 'android' ? [<>Open this website in <b>Chrome</b>.</>, <>Tap the <b>⋮ menu</b>, then <b>Add to home screen</b> or <b>Install app</b>.</>, <>Confirm <b>Install</b>, then open <b>settracker</b> from your home screen.</>] : [<>Open this website in <b>Chrome or Edge</b>.</>, <>Look for the <b>Install</b> icon in the address bar, or the install option in the browser menu.</>, <>Confirm installation, then open <b>settracker</b> from your apps.</>]).map((text, i) => <li key={i}>{text}</li>)}</ol>
        <details><summary>Can’t find the install option?</summary><p>If you opened this link inside another app, open it in Safari on iPhone or Chrome on Android. If installation isn’t offered, you can still use every online feature in your browser.</p></details>
      </>}
      {installMessage && <p role="status">{installMessage}</p>}
      <button className="wf-primary" disabled={busy} onClick={() => setStep('email')}>Continue to account setup →</button>
      <p className="wf-note">Installing is optional. Continue here whenever you’re ready.</p>
    </>}
    {step === 'email' && <form onSubmit={send}>
      <p>{path === 'new' ? 'Enter your email and we’ll send a secure link to create your account. No password to remember.' : 'Use the same email as before to return to your saved shows. We’ll send a fresh login link — no password needed.'}</p>
      <label htmlFor="welcome-email">Email address</label>
      <input id="welcome-email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} aria-describedby={error ? 'welcome-error' : undefined} />
      <button className="wf-primary" type="submit" disabled={busy || !email.trim() || remaining > 0}>{busy ? 'Sending…' : remaining > 0 ? `Try again in ${remaining}s` : path === 'new' ? 'Send my setup link' : 'Send login link'}</button>
      <button className="wf-link" type="button" disabled={busy} onClick={() => choose(path === 'new' ? 'returning' : 'new')}>{path === 'new' ? 'Already have an account? Log in' : 'New here? Get started'}</button>
    </form>}
    {step === 'sent' && <>
      <p>A {path === 'new' ? 'setup' : 'login'} link has been requested for <strong className="wf-email">{sentEmail}</strong></p>
      <ol className="wf-steps"><li>Open your email inbox on this device.</li><li>Open the newest email from settracker and tap its link.</li><li>You’ll return to settracker, signed in and ready to log shows.</li></ol>
      <details><summary>No email, or the link doesn’t work?</summary><p>Check spam or junk. Links can expire and can only be used once — use the newest one. If you’re returning, double-check that this is your original account email. If the link opens in a browser instead of the installed app, continue there.</p></details>
      <button className="wf-primary" disabled={busy || remaining > 0} onClick={send}>{busy ? 'Sending…' : remaining > 0 ? `Send another link in ${remaining}s` : 'Send another link'}</button>
    </>}
    {error && <p className="wf-error" id="welcome-error" role="alert">{error}</p>}
  </section>
}
