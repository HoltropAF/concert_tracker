import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyWishUpdates, checkWish, proposedChanges, safeTicketUrl } from '../lib/wishlistUpdates'
import { validDate } from '../lib/calendar'

const Context = createContext(null)
const action = { background: 'none', border: 0, color: '#a78bfa', cursor: 'pointer', minHeight: 44, padding: '8px 2px', fontSize: 12 }
const muted = { color: '#9491b8', fontSize: 12, lineHeight: 1.5 }
const section = { borderBottom: '1px solid #29233c', padding: '12px 0' }
export function WishlistUpdateProvider({ children, settings = {} }) {
  const [results, setResults] = useState({})
  const [sourceStatus, setSourceStatus] = useState({})
  const [progress, setProgress] = useState(null)
  const lock = useRef(false), controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  const check = async concerts => {
    if (lock.current) return
    lock.current = true
    const abort = new AbortController()
    controller.current = abort
    try {
      for (let index = 0; index < concerts.length && !abort.signal.aborted; index++) {
        const concert = concerts[index]
        setProgress({ done: index, total: concerts.length })
        setResults(previous => ({ ...previous, [concert.id]: { status: 'checking' } }))
        const timeout = setTimeout(() => abort.abort(), 90000)
        try {
          const result = await checkWish(concert, { signal: abort.signal, sources: ['ticketmaster','mojo'].filter(source => settings.concertSearchSources?.[source] !== false) })
          setSourceStatus(previous => ({...previous,...Object.fromEntries((result.reports||[]).map(report=>[report.source,report]))}))
          setResults(previous => ({ ...previous, [concert.id]: result }))
        } catch (error) {
          setResults(previous => ({ ...previous, [concert.id]: { status: 'error', message: abort.signal.aborted ? 'Check stopped or timed out. Try again.' : error.message } }))
        } finally { clearTimeout(timeout) }
      }
    } finally { lock.current = false; setProgress(null) }
  }
  return <Context.Provider value={{ results, sourceStatus, check, progress, stop: () => controller.current?.abort(), reviewed: id => setResults(previous => ({ ...previous, [id]: { ...previous[id], status: 'saved' } })) }}>{children}</Context.Provider>
}
function statusText(result) {
  if (!result) return ''
  if (result.status === 'checking') return 'Checking…'
  if (result.status === 'error') return 'Couldn’t check · try again'
  if (result.status === 'saved') return 'Updates saved'
  if (result.status === 'empty') return 'No matches found in this source'
  return result.exact ? 'Show found · review details' : 'Possible matches · choose a show'
}
export function WishlistUpdateBadge({ concert }) {
  const ctx = useContext(Context)
  const text = statusText(ctx?.results[concert.id])
  if (!concert.wishlist || !text) return null
  return <span style={{ display: 'block', color: '#75d9b1', fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 400, whiteSpace: 'normal', marginTop: 4 }}>{text}</span>
}
export function WishlistCheckAll({ concerts }) {
  const ctx = useContext(Context)
  const wishes = concerts.filter(c => c.wishlist)
  return <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={muted}>{ctx.progress ? `Checking ${ctx.progress.done + 1} of ${ctx.progress.total}` : 'Search enabled sources'}</span>
      <button type="button" style={action} onClick={() => ctx.progress ? ctx.stop() : ctx.check(wishes)}>{ctx.progress ? 'Stop' : 'Check all for updates ↻'}</button>
    </div>
    {!ctx.progress && wishes.some(c => ctx.results[c.id]) && <p role="status" style={muted}>Checked {wishes.filter(c => ctx.results[c.id]).length} of {wishes.length} · open a show to review its result.</p>}
  </div>
}
export default function WishlistUpdateDetails({ concert, onSave }) {
  const ctx = useContext(Context), result = ctx.results[concert.id]
  const [candidate, setCandidate] = useState(null), [selected, setSelected] = useState([])
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [moving, setMoving] = useState(false)
  const closeRef = useRef(null)
  useEffect(() => {
    if (!candidate) return
    const previous = document.activeElement
    closeRef.current?.focus()
    const keyboard = event => {
      if (event.key === 'Escape' && !busy) setCandidate(null)
      if (event.key === 'Tab') {
        const items = [...closeRef.current.closest('[role="dialog"]').querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')]
        const first = items[0], last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus() }
  }, [candidate, busy])
  const review = event => { setCandidate(event); setSelected(proposedChanges(concert, event).map(change => change.key)); setConfirmed(result?.exact || false); setError('') }
  const save = async () => {
    setBusy(true); setError('')
    try {
      const response = await onSave(applyWishUpdates(concert, candidate, selected))
      if (response?.error) throw Error('Could not save updates. Please try again.')
      ctx.reviewed(concert.id); setCandidate(null)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const move = async () => {
    setBusy(true); setError('')
    try {
      const response = await onSave({ ...concert, wishlist: false })
      if (response?.error) throw Error('Could not move this show. Please try again.')
      setMoving(false)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div style={{ marginBottom: 16 }}>
    <div style={section}><div style={muted}>SHOW DETAILS</div><div>{validDate(concert.date) ? concert.date : 'Date not announced / not entered'}</div><div style={muted}>{[concert.venue, concert.city, concert.country].filter(Boolean).join(' · ') || 'Venue not announced / not entered'}</div></div>
    <div style={section}><div style={muted}>TICKETS</div>
      <p style={muted}>{concert.ticketSaleAt ? `Sale: ${concert.ticketSaleAt.replace('T', ' ')} (your local time)` : 'No ticket-sale date saved.'}</p>
      {safeTicketUrl(concert.ticketSaleLink) && <a href={safeTicketUrl(concert.ticketSaleLink)} target="_blank" rel="noopener noreferrer" style={action}>Open ticket seller ↗</a>}
      <p style={muted}>{concert.discovery?.status || 'Availability unknown — check seller.'}{concert.discovery?.checkedAt ? ` · Checked ${new Date(concert.discovery.checkedAt).toLocaleString()}` : ''}</p>
    </div>
    <div style={section}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={muted}>UPDATES</span><button type="button" disabled={!!ctx.progress} style={action} onClick={() => ctx.check([concert])}>Check for news ↻</button></div>
      <p style={muted}>Uses the sources enabled in Settings. Coverage varies; no results does not mean sold out.</p>
      <p role="status" style={muted}>{statusText(result)}{result?.checkedAt ? ` · ${new Date(result.checkedAt).toLocaleString()}` : ''}</p>
      {result?.reports?.map(report => <p key={report.source} style={muted}>{report.source}: {report.error ? (report.pages ? 'Partial results — ' : 'Unavailable — ') + report.error : `${report.count} results checked`}</p>)}
      {result?.message && <p style={muted}>{result.message}</p>}
      {result?.limited && <p style={muted}>More results may exist beyond the checked pages.</p>}
      {result?.status === 'found' && result.events.map(event => <button type="button" key={event.id} onClick={() => review(event)} style={{ ...action, textAlign: 'left', display: 'block', width: '100%', borderTop: '1px solid #29233c' }}>
        {event.artist}<span style={{ ...muted, display: 'block' }}>{event.date} · {event.venue} · {event.city}</span><span>{result.exact ? 'Review updates →' : 'Possible match · review →'}</span>
      </button>)}
    </div>
    {error && !candidate && <p role="alert" style={{ color: '#fda4af' }}>{error}</p>}
    {moving ? <div style={section}><p style={muted}>Move this show to Going? Your details and notes stay saved.</p><button type="button" style={action} disabled={busy} onClick={move}>Yes, I have tickets</button><button type="button" style={{ ...action, marginLeft: 14 }} disabled={busy} onClick={() => setMoving(false)}>Cancel</button></div>
      : <button type="button" style={action} onClick={() => setMoving(true)}>Got tickets → Going</button>}
    {candidate && createPortal(<div style={{ position: 'fixed', inset: 0, background: '#000b', zIndex: 6000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="wish-review-title" style={{ width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box', background: '#13131f', color: '#e2e0ff', borderRadius: '16px 16px 0 0', padding: '16px 20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 id="wish-review-title" style={{ fontSize: 18 }}>Review updates</h2><button ref={closeRef} type="button" style={action} disabled={busy} onClick={() => setCandidate(null)}>Close</button></div>
        <p>{candidate.artist}</p><p style={muted}>{candidate.date} · {candidate.venue} · {candidate.city}</p>
        {!result?.exact && <label style={{ display: 'flex', gap: 10, padding: '12px 0', fontSize: 13 }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />This is the show I mean.</label>}
        {proposedChanges(concert, candidate).map(change => <label key={change.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, ...section, fontSize: 13, overflowWrap: 'anywhere' }}>
          <input type="checkbox" checked={selected.includes(change.key)} disabled={busy} onChange={e => setSelected(previous => e.target.checked ? [...previous, change.key] : previous.filter(key => key !== change.key))} />
          <span>{change.label}<span style={{ ...muted, display: 'block' }}>{change.before || 'Not saved'} →</span><span style={{ color: '#75d9b1' }}>{change.after}</span></span>
        </label>)}
        {!proposedChanges(concert, candidate).length && <p style={muted}>No changes to show details. You can save the latest ticket status below.</p>}
        <p style={muted}>Reported status: {candidate.status || 'Unknown'}<br />Checked: {candidate.checkedAt ? new Date(candidate.checkedAt).toLocaleString() : 'this session'}</p>
        <a href={safeTicketUrl(candidate.url)} target="_blank" rel="noopener noreferrer" style={action}>Source: {candidate.source} ↗</a>
        <p style={muted}>Only selected details and this check’s source/status will be saved. Your notes stay unchanged.</p>
        {error && <p role="alert" style={{ color: '#fda4af' }}>{error}</p>}
        <button type="button" disabled={!confirmed || busy} onClick={save} style={{ ...action, width: '100%', background: '#a78bfa', color: '#0c0c14', borderRadius: 9, fontWeight: 700, opacity: !confirmed || busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save updates to Want to go'}</button>
      </div>
    </div>, document.body)}
  </div>
}

export function ConcertSearchSettings({ settings, onChange }) {
  const ctx=useContext(Context)
  return <div style={{padding:'14px 16px',borderBottom:'1px solid #29233c'}}>
    <strong style={{color:'#c4b5fd',fontSize:13}}>Concert search sources</strong>
    <p style={muted}>Public listings; no account connection needed. Save Settings to apply. Status is from this session.</p>
    {['ticketmaster','mojo'].map(source => <div key={source} style={{marginBottom:8}}>
      <label style={{display:'flex',gap:10,alignItems:'center',minHeight:44,color:'#c4c2f0',fontSize:13}}><input type="checkbox" checked={settings.concertSearchSources?.[source] !== false} onChange={e=>onChange({...settings.concertSearchSources,[source]:e.target.checked})}/>{source==='mojo'?'MOJO · Dutch promoter agenda':'Ticketmaster · ticket listings'}</label>
      <div style={muted}>{ctx?.sourceStatus[source] ? (ctx.sourceStatus[source].error ? 'Unavailable / partial' : 'Working')+' · '+new Date(ctx.sourceStatus[source].checkedAt).toLocaleString() : 'Not checked'}</div>
    </div>)}
  </div>
}
