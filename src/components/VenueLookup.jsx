import {useEffect,useRef,useState} from 'react'
import {discoveryCountries} from '../lib/discovery'
export default function VenueLookup({name='',city='',country='',onChoose}){
  const [results,setResults]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const request=useRef(null)
  useEffect(()=>{request.current?.abort();request.current=null;setBusy(false);setResults([]);setMessage('');return ()=>{request.current?.abort();request.current=null}},[name,city,country])
  const search=async()=>{
    request.current?.abort();const controller=new AbortController();request.current=controller
    const timer=setTimeout(()=>controller.abort(),15000)
    setBusy(true);setMessage('');setResults([])
    try{
      const code=/^[a-z]{2}$/i.test(country)?country.toUpperCase():Object.entries(discoveryCountries).find(([,label])=>label.toLowerCase()===country.trim().toLowerCase())?.[0]||''
      if(country.trim()&&!code)throw Error('Use a two-letter country code, such as NL, BE, DE, GB or US.')
      const response=await fetch('/api/venues?'+new URLSearchParams({name,city,country:code}),{signal:controller.signal})
      const data=await response.json()
      if(!response.ok||!Array.isArray(data.venues))throw Error(data.error||'Venue search unavailable.')
      if(request.current!==controller)return
      setResults(data.venues);setMessage(data.venues.length?data.notice:'No matching venues found. Try part of the name or enter it manually.')
    }catch(error){if(request.current===controller)setMessage(controller.signal.aborted?'Search stopped. Please try again.':error.message)}
    finally{clearTimeout(timer);if(request.current===controller)setBusy(false)}
  }
  const style={background:'none',border:0,color:'var(--accent, #a78bfa)',padding:'8px 0',textAlign:'left',cursor:'pointer',fontSize:12,minHeight:44}
  return <div style={{marginBottom:12}}>
    <button type="button" style={style} disabled={busy||(!name.trim()&&!city.trim())} onClick={search}>{busy?'Searching venues…':'Find venue by name or city ↗'}</button>
    {message&&<p role="status" style={{fontSize:11,color:'#9491b8'}}>{message}</p>}
    {results.map((venue,index)=><button type="button" key={venue.id||index} style={{...style,display:'block',width:'100%',borderBottom:'1px solid #29233c'}} onClick={()=>{onChoose(venue);setResults([]);setMessage('Venue details filled in. Save when ready.')}}>{venue.name}<span style={{display:'block',color:'#9491b8'}}>{[venue.city,venue.country].filter(Boolean).join(', ')}</span></button>)}
  </div>
}
