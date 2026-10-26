import {useRef,useState} from 'react'
import {discoveryCountries,discoveryCountry,discoveryDuplicate,discoveryInvite,wishlistDraft} from '../lib/discovery'

const field={width:'100%',minWidth:0,boxSizing:'border-box',padding:'9px 10px',borderRadius:8,border:'1px solid #3d3564',background:'#13131f',color:'#e2e0ff'}
const button={...field,width:'auto',cursor:'pointer',color:'#c4b5fd'}
export default function UpcomingDiscovery({concerts,onChoose,initialVenue='',initialCity='',initialCountry='NL',title=null,defaultOpen=false,standalone=false,draftLabel='Continue to wishlist draft'}) {
  const [artist,setArtist]=useState(''),[venue,setVenue]=useState(initialVenue),[city,setCity]=useState(initialCity),[country,setCountry]=useState(discoveryCountry(initialCountry))
  const [events,setEvents]=useState([]),[candidate,setCandidate]=useState(null),[type,setType]=useState('concert')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[report,setReport]=useState(null)
  const query=useRef(null),lock=useRef(false)
  const search=async(page=1)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setMessage('');setCandidate(null)
    if(page===1){setEvents([]);setReport(null)}
    const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const filters=page===1?{artist:artist.trim(),venue:venue.trim(),city:city.trim(),country,today}:query.current
    query.current=filters
    try {
      const response=await fetch(`/api/upcoming?${new URLSearchParams({...filters,page:String(page)})}`,{signal:AbortSignal.timeout(15000)})
      const data=await response.json().catch(()=>null)
      if(!response.ok || !Array.isArray(data?.events))throw Error(data?.error || 'Upcoming search is unavailable here. Try again later.')
      setEvents(previous=>page===1?data.events:[...new Map([...previous,...data.events].map(e=>[e.id,e])).values()]);setReport(data)
      if(!data.events.length)setMessage(data.hasMore?'No matches on this page. Try more results or fewer filters.':'No matching upcoming shows in these results. Try fewer filters or the ticket website.')
    }catch(e){setError(e.name==='TimeoutError'?'Search took too long. Please try again.':e.message)}finally{lock.current=false;setBusy(false)}
  }
  const duplicate=candidate && discoveryDuplicate(candidate,concerts)
  const Container=standalone?'section':'details'
  return <Container open={standalone?undefined:defaultOpen || undefined} style={{margin:'8px 0 12px',color:'#c4c2f0'}}>
    {!standalone&&<summary style={{cursor:'pointer',color:'var(--accent, #a78bfa)',fontSize:12,fontFamily:"'DM Mono', monospace",padding:'6px 0'}}>{title || (initialVenue?'What’s coming up here?':'Discover upcoming shows')}</summary>}
    <p style={{fontSize:12}}>Find upcoming shows on Ticketmaster and review their details before saving.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
      <label>Artist or keyword<input style={field} value={artist} disabled={busy} onChange={e=>setArtist(e.target.value)}/></label>
      <label>Venue<input style={field} value={venue} disabled={busy} onChange={e=>setVenue(e.target.value)}/></label>
      <label>City<input style={field} value={city} disabled={busy} onChange={e=>setCity(e.target.value)}/></label>
      <label>Country<select style={field} value={country} disabled={busy} onChange={e=>setCountry(e.target.value)}><option value="">Any listed country</option>{Object.entries(discoveryCountries).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
    </div>
    <button type="button" style={{...button,marginTop:10}} disabled={busy||(!artist.trim()&&!venue.trim())} onClick={()=>search()}>{busy?'Searching…':'Find upcoming shows'}</button>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {report&&<p style={{fontSize:11}}>{report.notice}<br/>Checked {new Date(report.checkedAt).toLocaleString()}.</p>}
    {events.map(event=><article key={event.id} style={{padding:'12px 0',borderTop:'1px solid #3d3564'}}>
      <strong>{event.artist}</strong><div>{event.date} · {[event.venue,event.city,event.country].filter(Boolean).join(', ')}</div>
      <div style={{fontSize:12}}>{event.status}{event.saleStart && !Number.isNaN(Date.parse(event.saleStart))?` · Sale starts ${new Date(event.saleStart).toLocaleString()}`:''}</div>
      {discoveryDuplicate(event,concerts)&&<p style={{fontSize:12}}>Possibly already in your library</p>}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
        <a href={event.url} target="_blank" rel="noopener noreferrer" style={{color:'#c4b5fd'}}>Ticketmaster ↗</a>
        <button type="button" style={button} disabled={busy||event.status==='Cancelled'} onClick={()=>{setCandidate(event);setType('concert');setMessage('')}}>Review for wishlist</button>
        <button type="button" style={button} onClick={async()=>{try{await navigator.clipboard.writeText(discoveryInvite(event));setMessage('Invitation copied.')}catch{setError('Could not copy. You can open the ticket link and share it instead.')}}}>Copy invite</button>
      </div>
    </article>)}
    {report?.hasMore&&<button type="button" style={button} disabled={busy} onClick={()=>search(report.page+1)}>More results</button>}
    {candidate&&<section aria-label="Review upcoming show" style={{padding:12,border:'1px solid #a78bfa',borderRadius:8,marginTop:12}}>
      <h4 style={{marginTop:0}}>Review: {candidate.artist}</h4><p>{candidate.date} · {candidate.venue} · {candidate.city}</p>
      {duplicate&&<p role="alert">A matching show may already be saved. Check your library before adding another copy.</p>}
      <label>Save as <select style={field} value={type} onChange={e=>setType(e.target.value)}><option value="concert">Concert</option><option value="festival">Festival</option></select></label>
      <p style={{fontSize:12}}>Check the event title and location in your draft, then press Save. Festival listings do not mark individual artists as seen.</p>
      <button type="button" style={button} onClick={()=>{onChoose(wishlistDraft(candidate,type));setCandidate(null);setMessage('Details added to your draft. Review them before saving.')}}>{draftLabel}</button>{' '}
      <button type="button" style={button} onClick={()=>setCandidate(null)}>Cancel</button>
    </section>}
  </Container>
}
