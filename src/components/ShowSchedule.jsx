import {useEffect,useState} from 'react'
import {showTimeFields} from '../lib/showTimes.js'
const link=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
const button={background:'none',border:0,color:'#a78bfa',minHeight:44,padding:'8px 0',fontSize:12,cursor:'pointer'}
export default function ShowSchedule({concert,onSave,onEdit}){
 const saved=link(concert.scheduleUrl)||link(concert.discovery?.url)||link(concert.ticketSaleLink)
 const [url,setUrl]=useState(saved),[proposal,setProposal]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState('')
 const cacheKey='showTimeLookup:'+concert.id+':'+concert.date+':'+url
 const find=async(signal,automatic=false)=>{
   if(!link(url)){setError('Add a public HTTPS event-page link, or use Search times.');return}
   if(automatic){try{const cache=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(cache&&Date.now()-cache.at<600000){setProposal(cache.result);return}}catch{}}
   setBusy(true);setError('')
   try{const response=await fetch('/api/show-times?'+new URLSearchParams({url,artist:concert.artist,date:concert.date}),{signal:signal||AbortSignal.timeout(12000)});const data=await response.json().catch(()=>{throw Error('The lookup is unavailable here. Open the source or enter times manually.')});if(!response.ok)throw Error(data.error||'Could not check this page.');setProposal(data);try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),result:data}))}catch{}}
   catch(e){setError(e.name==='AbortError'?'The source took too long. Open it manually or try again.':e.message||'Could not check times. Open the source or enter them manually.')}
   finally{setBusy(false)}
 }
 useEffect(()=>{const controller=new AbortController();let timer;if(saved){timer=window.setTimeout(()=>controller.abort(),12000);find(controller.signal,true)}return()=>{controller.abort();window.clearTimeout(timer)}},[saved,concert.id,concert.date])
 const accept=async(key,value)=>{setSaving(key);setError('');try{const result=await onSave({...concert,[key]:value,scheduleUrl:link(url),scheduleSources:{...concert.scheduleSources,[key]:{url:proposal.source,label:proposal.times[key].label,checkedAt:new Date().toISOString()}}});if(result?.error)throw Error('Could not save this time. Try again.')}catch(e){setError(e.message)}finally{setSaving('')}}
 return <section style={{background:'#13131f',border:'1px solid #1f1f35',borderRadius:10,padding:14}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:10,color:'#6b6a8f',fontFamily:"'DM Mono', monospace",textTransform:'uppercase'}}>Schedule</span><button onClick={onEdit} style={button}>Edit manually</button></div>
   {Object.entries(showTimeFields).map(([key,label])=>{const found=proposal?.times?.[key];return <div key={key} style={{padding:'9px 0',borderBottom:'1px solid #25243a'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,color:'#9491b8'}}><span>{label}</span><span style={{color:concert[key]?'#c4c2f0':'#6b6a8f'}}>{concert[key]||'Unknown'}</span></div>{found&&found.value!==concert[key]&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,fontSize:11,color:'#9491b8'}}><span>{found.label}</span><button disabled={!!saving} onClick={()=>accept(key,found.value)} style={{...button,whiteSpace:'nowrap'}}>{saving===key?'Saving…':'Use '+found.value}</button></div>}</div>})}
   <details style={{marginTop:10,color:'#9491b8',fontSize:12}}><summary style={{padding:'10px 0',cursor:'pointer'}}>Event source</summary><input aria-label="Event-page link" type="url" value={url} onChange={e=>{setUrl(e.target.value);setProposal(null)}} placeholder="https://venue.com/this-event" style={{width:'100%',background:'#0c0c14',border:'1px solid #2e2e50',borderRadius:8,color:'#c4c2f0',padding:10,fontSize:16}} /></details>
   <div style={{display:'flex',gap:18,flexWrap:'wrap'}}><button disabled={busy} onClick={()=>find()} style={button}>{busy?'Checking source…':'Find times'}</button>{link(url) && url!==saved && <button disabled={!!saving} style={button} onClick={async()=>{setSaving('source');try{const result=await onSave({...concert,scheduleUrl:link(url)});if(result?.error)setError('Could not save the source. Try again.')}catch{setError('Could not save the source. Try again.')}finally{setSaving('')}}}>Save source</button>}{link(url)&&<a href={link(url)} target="_blank" rel="noopener noreferrer" style={{...button,textDecoration:'none'}}>Open source ↗</a>}<a href={'https://www.google.com/search?q='+encodeURIComponent([concert.artist,concert.venue,concert.date,'doors VIP start end times'].filter(Boolean).join(' '))} target="_blank" rel="noopener noreferrer" style={{...button,textDecoration:'none'}}>Search times ↗</a></div>
   <div aria-live="polite" style={{fontSize:11,color:error?'#f87171':'#9491b8',lineHeight:1.6}}>{error||proposal?.notice||'Saved event pages are checked automatically. Found times need your acceptance; blocked or incomplete websites can be checked manually.'}</div>
 </section>
}
