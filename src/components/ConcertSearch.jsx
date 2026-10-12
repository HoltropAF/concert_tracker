import {useRef,useState} from 'react'
export default function ConcertSearch({concerts,onChoose}) {
  const [artist,setArtist]=useState(''),[city,setCity]=useState(''),[date,setDate]=useState('')
  const [results,setResults]=useState([]),[candidate,setCandidate]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[more,setMore]=useState(false)
  const query=useRef(null)
  const search=async(next=1)=>{
    if(busy||!artist.trim())return
    setBusy(true);setMessage('');setCandidate(null)
    const q=next===1?{artist:artist.trim(),city:city.trim(),date}:query.current
    query.current=q
    if(next===1)setResults([])
    try {
      const response=await fetch(`/api/setlist?${new URLSearchParams({...q,search:'1',page:String(next)})}`,{signal:AbortSignal.timeout(15000)})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw Error(response.status===501?'Concert search needs the app owner’s setlist.fm API key. Manual entry is still available.':response.status===404?'No matching concerts. Try fewer filters.':response.status===429?'Search is busy. Please try again later.':'Could not search. Please try again.')
      if(!Array.isArray(data.results))throw Error('Concert search is unavailable on this preview. Try the deployed app or enter details manually.')
      setResults(next===1?data.results:old=>[...old,...data.results]);setPage(next);setMore(next*data.itemsPerPage<data.total)
      if(!data.results.length)setMessage('No matching concerts. Try fewer filters.')
    }catch(e){setMessage(e.message);setMore(false)}finally{setBusy(false)}
  }
  const duplicate=c=>concerts.some(x=>x.date===c.date&&x.artist?.trim().toLowerCase()===c.artist?.trim().toLowerCase()&&(!x.venue||!c.venue||x.venue.trim().toLowerCase()===c.venue.trim().toLowerCase()))
  return <details style={{marginBottom:16,padding:12,border:'1px solid #3d3564',borderRadius:10}}><summary>Find a concert and import details</summary>
    <p style={{fontSize:12}}>Search setlist.fm, choose the right show, then review before saving. Coverage varies; festival sets are individual artist performances.</p>
    <div style={{display:'grid',gap:8}}><input aria-label="Search artist" placeholder="Artist" value={artist} onChange={e=>setArtist(e.target.value)} disabled={busy}/><input aria-label="Search city (optional)" placeholder="City (optional)" value={city} onChange={e=>setCity(e.target.value)} disabled={busy}/><input aria-label="Search date (optional)" type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/><button disabled={busy||!artist.trim()} onClick={()=>search()}>{busy?'Searching…':'Search concerts'}</button></div>
    {message&&<p role="status">{message}</p>}
    {results.map((c,i)=><button key={`${c.url}-${i}`} onClick={()=>setCandidate(c)} style={{display:'block',width:'100%',textAlign:'left',marginTop:8}}>{c.artist} · {c.date} · {c.venue} · {c.city}{duplicate(c)?' · Possibly already logged':''}</button>)}
    {more&&<button disabled={busy} onClick={()=>search(page+1)}>More results</button>}
    {candidate&&<section aria-label="Review concert import"><h4>Review import</h4><p>{candidate.artist} · {candidate.date}<br/>{[candidate.venue,candidate.city,candidate.country].filter(Boolean).join(', ')}<br/>{candidate.songs?.length||0} songs</p>{candidate.url?.startsWith('https://www.setlist.fm/')&&<a href={candidate.url} target="_blank" rel="noopener noreferrer">Source: setlist.fm ↗</a>}{duplicate(candidate)&&<p role="alert">This concert may already be in your library. Check before saving another copy.</p>}<p>Use these details to replace the artist, date, venue, tour and setlist in this draft. Your other fields are kept. Review missing details before saving.</p><button onClick={()=>{onChoose(candidate);setCandidate(null);setMessage('Details added to your draft. Review them and press Save when ready.')}}>Use these details</button></section>}
  </details>
}
