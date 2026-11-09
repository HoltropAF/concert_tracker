import {useEffect,useState} from 'react'
import {visibleShowTimeFields} from '../lib/showTimes.js'

const link=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
const nameOf=act=>typeof act==='string'?act:act?.name||''
const sameName=(a,b)=>a.trim().toLowerCase()===b.trim().toLowerCase()
const button={background:'none',border:0,color:'#a78bfa',minHeight:44,padding:'8px 0',fontSize:12,cursor:'pointer'}
const action={...button,display:'inline-flex',alignItems:'center',justifyContent:'center',height:44,padding:'4px',border:'1px solid #2e2e50',borderRadius:8,textDecoration:'none',boxSizing:'border-box',fontFamily:'inherit',fontSize:11,lineHeight:1.3,textAlign:'center'}
const row={display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,color:'#c4c2f0',fontSize:13}
const muted={fontSize:11,lineHeight:1.6,color:'#9491b8'}

export default function ShowSchedule({concert,onSave,onEdit,settings={}}){
 const saved=link(concert.scheduleUrl)||link(concert.discovery?.url)||link(concert.ticketSaleLink)
 const [url,setUrl]=useState(saved),[proposal,setProposal]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState('')
 const website=link(settings.venueInfo?.[concert.venue]?.url)||link(settings.venueUrls?.[concert.venue])||link((settings.savedVenues||[]).find(v=>v.name===concert.venue)?.url)
 const cacheKey='showTimeLookup:v3:'+concert.id+':'+concert.date+':'+url
 const find=async(signal,automatic=false)=>{
   if(url && !link(url)){setError('Use a public HTTPS event-page link, or clear it to search automatically.');return}
   if(automatic){try{const cache=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(cache&&Date.now()-cache.at<600000){setProposal(cache.result);return}}catch{}}
   setBusy(true);setError('')
   try{
     const response=await fetch('/api/show-times?'+new URLSearchParams({url,website,artist:concert.artist,date:concert.date,venue:concert.venue||'',country:concert.country||''}),{signal:signal||AbortSignal.timeout(30000)})
     const data=await response.json().catch(()=>{throw Error('The lookup is unavailable here. Open the source or enter times manually.')})
     if(!response.ok)throw Error(data.error||'Could not check this page.')
     setProposal(data);try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),result:data}))}catch{}
   }catch(e){setError(['AbortError','TimeoutError'].includes(e.name)?'The source took too long. Open it manually or try again.':e.message||'Could not check times.')}
   finally{setBusy(false)}
 }
 useEffect(()=>{const controller=new AbortController();let timer;if(concert.artist&&concert.date){timer=window.setTimeout(()=>controller.abort(),30000);find(controller.signal,true)}return()=>{controller.abort();window.clearTimeout(timer)}},[saved,concert.id,concert.date,website])

 const persist=async(key,changes)=>{setSaving(key);setError('');try{const result=await onSave({...concert,...changes});if(result?.error)throw Error('Could not save. Try again.')}catch(e){setError(e.message)}finally{setSaving('')}}
 const accept=(key,found)=>persist(key,{[key]:found.value,scheduleUrl:link(concert.scheduleUrl)||link(found.source)||link(url),scheduleSources:{...concert.scheduleSources,[key]:{url:found.source||proposal.source,label:found.label,checkedAt:new Date().toISOString()}}})
 const confirmedSupport=(concert.support||[]).filter(a=>typeof a==='string'||a?.role!=='guest')
 const pendingSupport=(proposal?.supportActs||[]).filter(act=>!confirmedSupport.some(saved=>
   sameName(nameOf(saved),act.name) && (saved.timeManuallySet || !act.time || saved.time===act.time)
 ))
 const acceptSupport=act=>{
   const existing=concert.support||[],i=existing.findIndex(a=>sameName(nameOf(a),act.name))
   const row={...(typeof existing[i]==='object'?existing[i]:{}),name:act.name,role:'support',...(act.time?{time:act.time}:{}),...(link(act.source)?{sourceUrl:link(act.source)}:{})}
   const support=i<0?[...existing,row]:existing.map((a,n)=>n===i?row:a)
   return persist(act.name,{support})
 }
 const source=link(proposal?.source)||link(url)||link(website)||link(proposal?.sources?.find(s=>link(s.url))?.url)
 const search='https://www.google.com/search?q='+encodeURIComponent([concert.artist,concert.venue,concert.date,'timetable doors support act'].filter(Boolean).join(' '))
 return <section style={{background:'#13131f',border:'1px solid #1f1f35',borderRadius:10,padding:14}}>
   <div style={{fontSize:10,color:'#9491b8',fontFamily:"'DM Mono', monospace",textTransform:'uppercase',marginBottom:6}}>Schedule</div>
   {visibleShowTimeFields(concert,settings).map(([key,label])=>{
     const found=proposal?.times?.[key];
     const savedSource=concert.scheduleSources?.[key];
     const manuallySet=savedSource?.manual || (concert[key] && !savedSource?.url);
     return <div key={key} style={{padding:'10px 0',borderBottom:'1px solid #25243a'}}>
       <div style={row}><span>{label}</span><span style={{color:concert[key]?'#e2e0ff':'#9491b8'}}>{concert[key]||'Unknown'}</span></div>
       {!manuallySet && found && found.value!==concert[key] && <div style={{...row,...muted}}>
         <span>{found.label===label?'Found in the timetable':found.label}</span>
         <button disabled={!!saving} onClick={()=>accept(key,found)} style={{...button,whiteSpace:'nowrap'}}>{saving===key?'Saving…':'Use '+found.value}</button>
       </div>}
     </div>
   })}
   {(confirmedSupport.length>0||pendingSupport.length>0)&&<div style={{padding:'10px 0',borderBottom:'1px solid #25243a'}}><div style={{...muted,marginBottom:6}}>Support acts</div>{confirmedSupport.map((a,i)=><div key={i} style={{...row,padding:'5px 0'}}><span>{nameOf(a)}</span>{a.time&&<span>{a.time}</span>}</div>)}{pendingSupport.map(a=><div key={a.name} style={row}><span>{a.name}{a.time?' · '+a.time:''}</span><button disabled={!!saving} onClick={()=>acceptSupport(a)} style={button}>{saving===a.name?'Saving…':'Add support'}</button></div>)}</div>}
   <details style={{marginTop:8,color:'#c4c2f0',fontSize:13}}>
     <summary style={{padding:'12px 0',minHeight:44,cursor:'pointer'}}>Sources & manual times</summary>
     <div style={{display:'grid',gridTemplateColumns:`repeat(${source?3:2},minmax(0,1fr))`,gap:6}}><button disabled={busy} onClick={()=>find()} style={action}>{busy?'Checking…':'Find times'}</button>{source&&<a href={source} target="_blank" rel="noopener noreferrer" style={action}>Open source ↗</a>}<a href={search} target="_blank" rel="noopener noreferrer" style={action}>Search times ↗</a></div>
     {proposal?.sources?.map((s,i)=><div key={i} style={{...muted,padding:'5px 0'}}>{link(s.url)?<a href={link(s.url)} target="_blank" rel="noopener noreferrer" style={{color:'#a78bfa'}}>{s.name} ↗</a>:s.name} · {s.status}</div>)}
     <label style={{...muted,display:'block',marginTop:10}}>Event-page link<input type="url" value={url} onChange={e=>{setUrl(e.target.value);setProposal(null)}} placeholder="https://venue.com/this-event" style={{width:'100%',background:'#0c0c14',border:'1px solid #2e2e50',borderRadius:8,color:'#c4c2f0',padding:10,fontSize:16,marginTop:5}} /></label>
     <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{link(url)&&url!==saved&&<button disabled={!!saving} style={button} onClick={()=>persist('source',{scheduleUrl:link(url)})}>Save source</button>}<button onClick={onEdit} style={button}>Enter times manually</button></div>
   </details>
   {(busy||error||proposal?.notice)&&<div aria-live="polite" style={{...muted,color:error?'#f87171':muted.color}}>{error||(busy?'Checking show sources…':proposal.notice)}</div>}
 </section>
}
