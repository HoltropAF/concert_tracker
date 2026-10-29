import VenueLookup from './VenueLookup'
import { sellerLink, ticketSaleOpen, wishStepStates } from '../lib/ticketOptions'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyWishUpdates, checkWish, proposedChanges, safeTicketUrl, summarizeWishCheck } from '../lib/wishlistUpdates'
import { savedVenueSources } from '../lib/venueSources'
import { validDate } from '../lib/calendar'
import {localDay,readDailyCheck,claimDailyCheck} from '../lib/dailyWishlist'

const Context = createContext(null)
const action = { background: 'none', border: 0, color: '#a78bfa', cursor: 'pointer', minHeight: 44, padding: '8px 2px', fontSize: 12 }
const muted = { color: '#9491b8', fontSize: 12, lineHeight: 1.5 }
const section = { borderBottom: '1px solid #29233c', padding: '12px 0' }
export function WishlistUpdateProvider({ children, settings = {}, concerts = [], account, ready = true }) {
  const [results, setResults] = useState({})
  const [sourceStatus, setSourceStatus] = useState({})
  const [progress, setProgress] = useState(null)
  const lock = useRef(false), controller = useRef(null)
  const dailyKey=account?`settracker:wishlist-daily:${account}`:null
  const dailySession=useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(()=>{
    if(!ready||!dailyKey||!concerts.some(c=>c.wishlist))return
    const timer=setTimeout(()=>{
      const marker=dailyKey+localDay()
      if(dailySession.current===marker)return
      dailySession.current=marker
      const saved=readDailyCheck(localStorage,dailyKey)
      if(saved?.day===localDay()){setResults(saved.results||{});return}
      if(lock.current){dailySession.current=null;return}
      if(claimDailyCheck(localStorage,dailyKey))check(concerts.filter(c=>c.wishlist))
    },500)
    return ()=>clearTimeout(timer)
  },[ready,dailyKey,concerts])
  const wishIds=concerts.filter(c=>c.wishlist).map(c=>c.id)
  const check = async concerts => {
    if (lock.current) return
    lock.current = true
    if(dailyKey&&wishIds.length&&wishIds.every(id=>concerts.some(c=>c.id===id)))claimDailyCheck(localStorage,dailyKey)
    const abort = new AbortController()
    controller.current = abort
    try {
      for (let index = 0; index < concerts.length && !abort.signal.aborted; index++) {
        const concert = concerts[index]
        setProgress({ done: index, total: concerts.length })
        setResults(previous => ({ ...previous, [concert.id]: { status: 'checking' } }))
        try {
          const previousResult = (dailyKey && readDailyCheck(localStorage,dailyKey)?.results?.[concert.id]) || results[concert.id];
          const checkedResult = await checkWish(concert, { signal: abort.signal, onProgress: state => setResults(previous=>({...previous,[concert.id]:{status:'checking',progress:state}})), venues: settings.concertSearchSources?.venues !== false ? savedVenueSources(settings) : [], sources: ['ticketmaster','mojo'].filter(source => settings.concertSearchSources?.[source] !== false) })
          const result = summarizeWishCheck(concert, checkedResult, previousResult);
          setSourceStatus(previous => ({...previous,...Object.fromEntries((result.reports||[]).map(report=>[report.source,report]))}))
          setResults(previous => ({ ...previous, [concert.id]: result }))
          if(dailyKey){
            const saved=readDailyCheck(localStorage,dailyKey)
            try{localStorage.setItem(dailyKey,JSON.stringify({day:saved?.day||null,results:{...saved?.results,[concert.id]:result}}))}catch{/* Checking remains usable when storage is full. */}
          }
        } catch (error) {
          setResults(previous => ({ ...previous, [concert.id]: { status: 'error', checkedAt:new Date().toISOString(), message: abort.signal.aborted ? 'Check stopped or timed out. Try again.' : error.message } }))
        }
      }
    } finally { lock.current = false; setProgress(null) }
  }
  return <Context.Provider value={{ results, sourceStatus, check, progress, stop: () => controller.current?.abort(), reviewed: id => setResults(previous => ({ ...previous, [id]: { ...previous[id], status: 'saved' } })) }}>{children}</Context.Provider>
}
function statusText(result) {
  if (!result) return ''
  if (result.status === 'checking') return result.progress ? `Checking sources · ${result.progress.done}/${result.progress.total}${result.progress.found ? ' · '+result.progress.found+' matches found' : ''}` : 'Checking…'
  if (result.status === 'error') return 'No sources could be checked · try again'
  if (result.status === 'saved') return 'Updates saved'
  if (result.repeat && result.status === 'found') return (result.newCount ? 'New information found · review updates' : 'No new information found') + (result.limited ? ' · some sources could not be fully checked' : '');
  if (result.repeat && result.status === 'empty') return result.locked ? 'The selected show was not found in checked sources · saved details kept' : 'No new information found';
  if (result.status === 'partial') return `Checked ${result.checkedSources || 0}/${result.totalSources || result.reports?.length || 0} sources · no matches found · coverage incomplete`
  if (result.status === 'skipped') return 'Enabled sources don’t cover this location'
  if (result.status === 'empty') return `Checked ${result.checkedSources || result.reports?.length || 0} sources · no matching listings`
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
export default function WishlistUpdateDetails({ concert, onSave, onGotTickets }) {
  const ctx = useContext(Context), result = ctx.results[concert.id]
  const [candidate, setCandidate] = useState(null), [selected, setSelected] = useState([])
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [editingStep, setEditingStep] = useState(null), [draft, setDraft] = useState({})
  const [ticketChoice,setTicketChoice]=useState(''), [newOption,setNewOption]=useState({label:'',url:'',description:''})
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
  const save = async (keys = selected) => {
    setBusy(true); setError('')
    try {
      const response = await onSave(applyWishUpdates(concert, candidate, keys), {notify:true})
      if (response?.error) throw Error('Could not save updates. Please try again.')
      if(proposedChanges(concert,candidate).every(c=>keys.includes(c.key)))ctx.reviewed(concert.id); setCandidate(null)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const fields = [
    [['artist','Artist','text']],
    [['venue','Venue','text'],['city','City','text'],['country','Country','text']],
    [['date','Show date','date']],
    [['ticketSaleAt','Sale starts','datetime-local'],['ticketSaleLink','Ticket website','url']],
  ]
  const saleTime = new Date(concert.ticketSaleAt || '').getTime()
  const pendingEvents=result?.status==='found'?result.events:[]
  const states=wishStepStates(concert,pendingEvents,proposedChanges)
  const known=states.map(s=>s==='saved')
  const buyUrl=sellerLink(concert.ticketSaleLink)
  const canBuy=!!buyUrl&&ticketSaleOpen(concert)
  const values = [concert.artist || 'Add artist', [concert.venue,concert.city,concert.country].filter(Boolean).join(' · ') || 'Venue not announced', validDate(concert.date) ? new Date(concert.date+'T12:00:00').toLocaleDateString([], {dateStyle:'medium'}) : 'Date not announced', Number.isFinite(saleTime) ? (saleTime <= Date.now() ? 'Sale started · ' : 'Sale starts · ') + new Date(saleTime).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : 'Sale date unknown']
  const editStep = index => { setEditingStep(index); setDraft(Object.fromEntries(fields[index].map(([key])=>[key,key==='date'&&!validDate(concert.date)?'':concert[key]||'']))); setError('') }
  const saveStep = async () => {
    if(editingStep===0&&!draft.artist?.trim()){setError('Enter an artist.');return}
    if(editingStep===3&&draft.ticketSaleLink){try{const u=new URL(draft.ticketSaleLink);if(!['https:','http:'].includes(u.protocol))throw Error()}catch{setError('Enter a valid ticket website.');return}}
    setBusy(true);setError('')
    try{const patch=Object.fromEntries(fields[editingStep].map(([key])=>[key,key==='date'&&!draft[key]?'9999-12-31':draft[key]?.trim()||'']));const response=await onSave({...concert,...patch},{notify:true});if(response?.error)throw Error('Could not save this detail.');setEditingStep(null)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const checked = result?.checkedAt || concert.discovery?.checkedAt
  return <div style={{ marginBottom: 16 }}>
    {['Who?','Where?','When?','Tickets?'].map((label,index)=><div key={label} style={section}>
      <button type="button" disabled={busy} onClick={()=>{if(index===3&&canBuy)window.open(buyUrl,'_blank','noopener,noreferrer');else editStep(index)}} style={{...action,display:'flex',alignItems:'center',gap:12,textAlign:'left',width:'100%',color:'#c4c2f0'}}>
        <span aria-label={states[index]==='saved'?'Saved':states[index]==='pending'?'Found · not accepted':'Missing'} style={{background:states[index]==='saved'?'#123c30':states[index]==='pending'?'#493313':'#421f2b',color:states[index]==='saved'?'#6ee7b7':states[index]==='pending'?'#fbbf24':'#fda4af',borderRadius:'50%',width:28,height:28,display:'grid',placeItems:'center',flexShrink:0}}>{states[index]==='saved'?'✓':states[index]==='pending'?'!':index+1}</span>
        <span style={{flex:1}}><strong>{label}</strong><span style={{...muted,display:'block',marginTop:4}}>{values[index]}</span><span style={{...muted,display:'block',fontSize:11}}>{states[index]==='pending'?'New information · review below':states[index]==='missing'?'Not saved / not found yet':index===3&&canBuy?'Open ticket seller ↗':'Saved'}</span></span><span>›</span>
      </button>
      {index===3&&<button type="button" disabled={busy} style={action} onClick={()=>editStep(3)}>Edit ticket details</button>}
      {editingStep===index&&<form onSubmit={e=>{e.preventDefault();saveStep()}}>
        {fields[index].map(([key,title,type])=><label key={key} style={{...muted,display:'block',marginTop:10}}>{title}<input type={type} value={draft[key]||''} onChange={e=>setDraft({...draft,[key]:e.target.value})} disabled={busy} style={{display:'block',width:'100%',boxSizing:'border-box',background:'#13131f',color:'#c4c2f0',border:'1px solid #3d3564',borderRadius:8,padding:12,fontSize:16}}/></label>)}
        {index===1&&<VenueLookup name={draft.venue||''} city={draft.city||''} country={draft.country||''} onChoose={venue=>setDraft(d=>({...d,venue:venue.name,city:venue.city,country:venue.country}))}/>}
        <button type="submit" disabled={busy} style={action}>{busy?'Saving…':'Save detail'}</button><button type="button" disabled={busy} style={{...action,marginLeft:16}} onClick={()=>setEditingStep(null)}>Cancel</button>
      </form>}
    </div>)}
    <details style={{...muted,marginTop:12}}><summary style={{padding:'12px 0',cursor:'pointer'}}>Ticket options{concert.ticketOptions?.length?' · '+concert.ticketOptions.length:''}</summary>
      {(concert.ticketOptions||[]).map((option,i)=><div key={option.id||i} style={section}>
        <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="radio" name={'ticket-option-'+concert.id} checked={ticketChoice===String(i)} onChange={()=>setTicketChoice(String(i))}/><strong>{option.label}</strong></label>
        {option.description&&<p>{option.description}</p>}
        {option.priceRange&&<p>{option.priceRange.currency} {option.priceRange.min}–{option.priceRange.max} · published range</p>}
        {option.status&&<p>{option.status}</p>}
        {sellerLink(option.url)&&<a href={sellerLink(option.url)} target="_blank" rel="noopener noreferrer" style={action}>View this ticket option ↗</a>}
      </div>)}
      <form onSubmit={async e=>{e.preventDefault();if(!newOption.label.trim()){setError('Name the ticket option.');return}if(newOption.url&&!sellerLink(newOption.url)){setError('Enter a valid seller link.');return}setBusy(true);setError('');try{const response=await onSave({...concert,ticketOptions:[...(concert.ticketOptions||[]),{...newOption,id:crypto.randomUUID(),label:newOption.label.trim(),url:sellerLink(newOption.url)}]},{notify:true});if(response?.error)throw Error('Could not save ticket option.');setNewOption({label:'',url:'',description:''})}catch(e){setError(e.message)}finally{setBusy(false)}}}>
        {[['label','Ticket type (GA, Golden Circle, VIP1…)'],['url','Seller link (optional)'],['description','Price / package details (optional)']].map(([key,label])=><label key={key} style={{display:'block',marginTop:10}}>{label}<input value={newOption[key]} onChange={e=>setNewOption({...newOption,[key]:e.target.value})} disabled={busy} style={{width:'100%',boxSizing:'border-box',fontSize:16,padding:10,background:'#13131f',color:'#c4c2f0',border:'1px solid #3d3564',borderRadius:8}}/></label>)}
        <button type="submit" disabled={busy} style={action}>Add ticket option</button>
      </form>
    </details>
    <button type="button" disabled={!!ctx.progress||busy} style={{...action,width:'100%',marginTop:16,...(!known.every(Boolean)?{background:'#a78bfa',color:'#0c0c14',borderRadius:9,fontWeight:700}:{})}} onClick={()=>ctx.check([concert])}>{result?.status==='checking'?'Checking…':known.every(Boolean)?'Check for updates ↻':'Check for missing details'}</button>
    {result?.status==='checking'&&<button type="button" style={action} onClick={ctx.stop}>Stop checking</button>}
    <p style={muted}>{checked?'Last checked '+new Date(checked).toLocaleString():'Not checked yet'}</p>
    {result&&<p role="status" style={muted}>{statusText(result)}</p>}
    {result?.status==='found'&&<details open={!result.repeat || result.newCount > 0}><summary style={muted}>{result.repeat && !result.newCount ? 'Previously found details' : 'Review found details'}</summary>{result.events.map(event=><button type="button" key={event.id} style={{...action,display:'block',textAlign:'left',width:'100%',borderBottom:'1px solid #29233c'}} onClick={()=>review(event)}>{event.artist}<span style={{...muted,display:'block'}}>{event.date} · {event.venue} · {event.city}{event.ticketOptions?.length>1?' · '+event.ticketOptions.length+' ticket options':''}</span>{result.exact?'Review found details →':'Choose this show →'}</button>)}</details>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:14}}>
      <details style={muted}><summary style={{padding:'12px 0',cursor:'pointer'}}>Your notes</summary><textarea aria-label="Your notes" key={concert.notes||''} defaultValue={concert.notes||''} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} style={{width:'100%',boxSizing:'border-box',minHeight:90,background:'#13131f',color:'#c4c2f0',fontSize:16}}/><button type="button" disabled={busy} style={action} onClick={async()=>{setBusy(true);setError('');try{const r=await onSave({...concert,notes:draft.notes??concert.notes??''},{notify:true});if(r?.error)throw Error('Could not save notes.')}catch(e){setError(e.message)}finally{setBusy(false)}}}>Save notes</button></details>
      <details style={muted}><summary style={{padding:'12px 0',cursor:'pointer'}}>Sources checked</summary>{result?.reports?.map((report,i)=><p key={i}>{report.source}: {report.error||report.skipped||(report.count?report.count+' matches':'No matches')}{report.reader?' · '+report.reader:''}{report.cached?' · cached (up to 5 min)':''}{report.reader&&report.checkedAt?' · fetched '+new Date(report.checkedAt).toLocaleTimeString():''}{report.warning?' · '+report.warning:''}</p>)}{result?.message&&!result.reports?.length&&<p>{result.message}</p>}<p>Coverage varies. No results does not mean sold out.</p>{result?.limited&&<p>Other listings may exist beyond the checked pages.</p>}</details>
    </div>
    {error&&!candidate&&<p role="alert" style={{color:'#fda4af'}}>{error}</p>}
    <button type="button" disabled={busy} style={{...action,width:'100%',marginTop:16,border:'1px solid #3d3564',borderRadius:9}} onClick={()=>onGotTickets(ticketChoice!==''?concert.ticketOptions?.[Number(ticketChoice)]:null)}>I got tickets →</button>
    {candidate && createPortal(<div style={{ position: 'fixed', inset: 0, background: '#000b', zIndex: 6000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="wish-review-title" style={{ width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box', background: '#13131f', color: '#e2e0ff', borderRadius: '16px 16px 0 0', padding: '16px 20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 id="wish-review-title" style={{ fontSize: 18 }}>Review updates</h2><button ref={closeRef} type="button" style={action} disabled={busy} onClick={() => setCandidate(null)}>Close</button></div>
        <p>{candidate.artist}</p><p style={muted}>{candidate.date} · {candidate.venue} · {candidate.city}</p>
        {candidate.ticketOptions?.map(option=><details key={option.id} style={muted}><summary style={{padding:'8px 0'}}>{option.label}</summary><p>{option.description||'See the seller for package details.'}</p>{option.priceRange&&<p>{option.priceRange.currency} {option.priceRange.min}–{option.priceRange.max} · published range</p>}<a href={sellerLink(option.url)} target="_blank" rel="noopener noreferrer" style={action}>View listing ↗</a></details>)}
        {!result?.exact && <label style={{ display: 'flex', gap: 10, padding: '12px 0', fontSize: 13 }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />This is the show I mean.</label>}
        {proposedChanges(concert, candidate).map(change => <label key={change.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, ...section, fontSize: 13, overflowWrap: 'anywhere' }}>
          <input type="checkbox" checked={selected.includes(change.key)} disabled={busy} onChange={e => setSelected(previous => e.target.checked ? [...previous, change.key] : previous.filter(key => key !== change.key))} />
          <span>{change.label}<span style={{ ...muted, display: 'block' }}>{change.before || 'Not saved'} →</span><span style={{ color: '#75d9b1' }}>{change.after}</span><button type="button" disabled={!confirmed||busy} style={{...action,display:'block'}} onClick={e=>{e.preventDefault();save([change.key])}}>Use this detail</button></span>
        </label>)}
        {!!proposedChanges(concert,candidate).length&&<button type="button" disabled={!confirmed||busy} style={action} onClick={()=>save(proposedChanges(concert,candidate).map(c=>c.key))}>Accept all found details</button>}
        {!proposedChanges(concert, candidate).length && <p style={muted}>No changes to show details. You can save the latest ticket status below.</p>}
        <p style={muted}>Reported status: {candidate.status || 'Unknown'}<br />Checked: {candidate.checkedAt ? new Date(candidate.checkedAt).toLocaleString() : 'this session'}</p>
        <a href={safeTicketUrl(candidate.url,candidate)} target="_blank" rel="noopener noreferrer" style={action}>Source: {candidate.source} ↗</a>
        <p style={muted}>Only selected details and this check’s source/status will be saved. Your notes stay unchanged.</p>
        {error && <p role="alert" style={{ color: '#fda4af' }}>{error}</p>}
        <button type="button" disabled={!confirmed || busy} onClick={()=>save()} style={{ ...action, width: '100%', background: '#a78bfa', color: '#0c0c14', borderRadius: 9, fontWeight: 700, opacity: !confirmed || busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save selected details'}</button>
      </div>
    </div>, document.body)}
  </div>
}

export function ConcertSearchSettings({ settings, onChange }) {
  const ctx=useContext(Context)
  return <div style={{padding:'14px 16px',borderBottom:'1px solid #29233c'}}>
    <strong style={{color:'#c4b5fd',fontSize:13}}>Concert search sources</strong>
    <p style={muted}>Public listings; no account connection needed. Save Settings to apply. Status is from this session.</p>
    <label style={{display:'flex',gap:10,alignItems:'center',minHeight:44,...muted}}><input type="checkbox" checked={settings.concertSearchSources?.venues !== false} onChange={e=>onChange({...settings.concertSearchSources,venues:e.target.checked})}/>Saved venue websites ({savedVenueSources(settings).length})</label>
    <p style={muted}>AFAS Live uses its published agenda, shared across artist checks for 5 minutes. Other saved websites use a limited page check; unsupported sites may still need manual checking.</p>
    {['ticketmaster','mojo'].map(source => <div key={source} style={{marginBottom:8}}>
      <label style={{display:'flex',gap:10,alignItems:'center',minHeight:44,color:'#c4c2f0',fontSize:13}}><input type="checkbox" checked={settings.concertSearchSources?.[source] !== false} onChange={e=>onChange({...settings.concertSearchSources,[source]:e.target.checked})}/>{source==='mojo'?'MOJO · Dutch promoter agenda':'Ticketmaster · ticket listings'}</label>
      <div style={muted}>{ctx?.sourceStatus[source] ? (ctx.sourceStatus[source].skipped ? 'Outside coverage' : ctx.sourceStatus[source].error ? 'Unavailable / partial' : 'Working')+' · '+new Date(ctx.sourceStatus[source].checkedAt).toLocaleString() : 'Not checked'}</div>
    </div>)}
  </div>
}
