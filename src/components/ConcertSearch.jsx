import {useRef,useState} from 'react'
import UpcomingDiscovery from './UpcomingDiscovery'
import {discoveryCountries,discoveryCountry} from '../lib/discovery'
export default function ConcertSearch({concerts,onChoose,mode='past',initialCountry=''}) {
  const [artist,setArtist]=useState(''),[city,setCity]=useState(''),[date,setDate]=useState('')
  const [country,setCountry]=useState(discoveryCountry(initialCountry))
  const [results,setResults]=useState([]),[candidate,setCandidate]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[more,setMore]=useState(false)
  const query=useRef(null)
  const search=async(next=1)=>{
    if(busy||!artist.trim())return
    setBusy(true);setMessage('');setCandidate(null)
    const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    if(date && date>=today){setBusy(false);setMessage('Choose a past date for a past show.');return}
    const q=next===1?{artist:artist.trim(),city:city.trim(),date,country,period:'past',today}:query.current
    query.current=q
    if(next===1)setResults([])
    try {
      const response=await fetch(`/api/setlist?${new URLSearchParams({...q,search:'1',page:String(next)})}`,{signal:AbortSignal.timeout(15000)})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw Error(response.status===501?'Concert search needs the app owner’s setlist.fm API key. Manual entry is still available.':response.status===404?'No matching concerts. Try fewer filters.':response.status===429?'Search is busy. Please try again later.':'Could not search. Please try again.')
      if(!Array.isArray(data.results))throw Error('Concert search is unavailable on this preview. Try the deployed app or enter details manually.')
      setResults(next===1?data.results:old=>[...old,...data.results]);setPage(next);setMore(next*data.itemsPerPage<data.total)
      if(!data.results.length)setMessage(next*data.itemsPerPage<data.total?'No past shows on this page. Try more results or narrow the date.':'No matching past concerts. Try fewer filters.')
    }catch(e){setMessage(e.message);setMore(false)}finally{setBusy(false)}
  }
  const duplicate=c=>concerts.some(x=>x.date===c.date&&x.artist?.trim().toLowerCase()===c.artist?.trim().toLowerCase()&&(!x.venue||!c.venue||x.venue.trim().toLowerCase()===c.venue.trim().toLowerCase()))
  if(mode==='upcoming')return <UpcomingDiscovery concerts={concerts} onChoose={onChoose} initialCountry={initialCountry} title="Find a concert and import details" draftLabel="Use these details" />
  return <details style={{marginBottom:12}}><summary style={{cursor:'pointer',color:'var(--accent, #a78bfa)',fontSize:12,fontFamily:"'DM Mono', monospace",padding:'6px 0'}}>Find a concert and import details</summary>
    <p style={{fontSize:12}}>Search past concerts on setlist.fm, choose the right show, then review before saving. Festival sets are individual artist performances.</p>
    <label>Country <select aria-label="Search country (optional)" value={country} onChange={e=>setCountry(e.target.value)} disabled={busy}><option value="">Any country</option>{Object.entries(discoveryCountries).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
    <div style={{display:'grid',gap:8}}><input aria-label="Search artist" placeholder="Artist" value={artist} onChange={e=>setArtist(e.target.value)} disabled={busy}/><input aria-label="Search city (optional)" placeholder="City (optional)" value={city} onChange={e=>setCity(e.target.value)} disabled={busy}/><input aria-label="Search date (optional)" type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/><button disabled={busy||!artist.trim()} onClick={()=>search()}>{busy?'Searching…':'Search concerts'}</button></div>
    {message&&<p role="status">{message}</p>}
    {results.map((c,i)=><button key={`${c.url}-${i}`} onClick={()=>setCandidate(c)} style={{display:'block',width:'100%',textAlign:'left',marginTop:8}}>{c.artist} · {c.date} · {c.venue} · {c.city}{duplicate(c)?' · Possibly already logged':''}</button>)}
    {more&&<button disabled={busy} onClick={()=>search(page+1)}>More results</button>}
    {candidate&&<section aria-label="Review concert import"><h4>Review import</h4><p>{candidate.artist} · {candidate.date}<br/>{[candidate.venue,candidate.city,candidate.country].filter(Boolean).join(', ')}<br/>{candidate.songs?.length||0} songs</p>{candidate.url?.startsWith('https://www.setlist.fm/')&&<a href={candidate.url} target="_blank" rel="noopener noreferrer">Source: setlist.fm ↗</a>}{duplicate(candidate)&&<p role="alert">This concert may already be in your library. Check before saving another copy.</p>}<p>Use these details to replace the artist, date, venue, tour and setlist in this draft. Your other fields are kept. Review missing details before saving.</p><button onClick={()=>{onChoose(candidate);setCandidate(null);setMessage('Details added to your draft. Review them and press Save when ready.')}}>Use these details</button></section>}
  </details>
}
