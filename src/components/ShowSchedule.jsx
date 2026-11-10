import {useEffect,useState} from 'react'
import {pendingShowTime,pendingSupportActs,supportNameKey,timetableRows} from '../lib/showTimes.js'
import {cachedSchedule,checkShowSchedule,scheduleLink as link,scheduleRequest} from '../lib/showScheduleLookup.js'

const nameOf=act=>typeof act==='string'?act:act?.name||''
const button={background:'none',border:0,color:'#a78bfa',minHeight:44,padding:'8px 0',fontSize:12,cursor:'pointer'}
const action={...button,display:'inline-flex',alignItems:'center',justifyContent:'center',height:44,padding:'4px',border:'1px solid #2e2e50',borderRadius:8,textDecoration:'none',boxSizing:'border-box',fontFamily:'inherit',fontSize:11,lineHeight:1.3,textAlign:'center'}
const row={display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,color:'#c4c2f0',fontSize:13}
const muted={fontSize:11,lineHeight:1.6,color:'#9491b8'}
const input={width:'100%',minWidth:0,boxSizing:'border-box',background:'#0c0c14',border:'1px solid #2e2e50',borderRadius:8,color:'#c4c2f0',padding:'8px',fontSize:16,marginTop:5}

export default function ShowSchedule({concert,onSave,onEdit,settings={}}){
 const request=scheduleRequest(concert,settings)
 const saved=request.url,website=request.website
 const [url,setUrl]=useState(saved),[proposal,setProposal]=useState(()=>cachedSchedule(request.key)?.result),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState('')
 const [supportDraft,setSupportDraft]=useState(null)
 const find=async(lookup,automatic=false,isActive=()=>true)=>{
   if(automatic&&cachedSchedule(lookup.key)?.day){
     setProposal(cachedSchedule(lookup.key).result)
   }
   setBusy(true);setError('')
   try{
     const data=await checkShowSchedule(lookup,automatic)
     if(isActive())setProposal(data)
   }catch(e){if(isActive())setError(e.name==='TimeoutError'?'The source took too long. Open it manually or try again.':e.message||'Could not check times.')}
   finally{if(isActive())setBusy(false)}
 }
 useEffect(()=>{let active=true;setUrl(saved);if(concert.artist&&concert.date&&concert.date!=='9999-12-31')find(request,true,()=>active);return()=>{active=false}},[request.key])

 const persist=async(key,changes)=>{setSaving(key);setError('');try{const result=await onSave({...concert,...changes});if(result?.error)throw Error('Could not save. Try again.');return true}catch(e){setError(e.message);return false}finally{setSaving('')}}
 const accept=(key,found)=>persist(key,{[key]:found.value,scheduleSources:{...concert.scheduleSources,[key]:{url:found.source||proposal.source,label:found.label,checkedAt:new Date().toISOString()}}})
 const lineup=concert.support||[]
 const pendingSupport=pendingSupportActs(lineup,proposal?.supportActs||[])
 const saveSupport=async(draft,manual)=>{
   const name=draft.name.trim()
   if(!name)return false
   if(lineup.some(act=>supportNameKey(nameOf(act))===supportNameKey(name))){
     setError('That artist is already on this show.')
     return false
   }
   const act={name,role:'support',time:draft.time||''}
   if(manual)act.timeManuallySet=true
   if(link(draft.source))act.sourceUrl=link(draft.source)
   if(draft.sourceName)act.scheduleSourceName=draft.sourceName
   return persist('support:'+name,{support:[...lineup,act]})
 }
 const foundDraft=act=>({name:act.name,time:act.time||'',source:act.source,sourceName:act.name})
 const source=link(proposal?.source)||link(url)||link(website)||link(proposal?.sources?.find(s=>link(s.url))?.url)
 const search='https://www.google.com/search?q='+encodeURIComponent([concert.artist,concert.venue,concert.date,'timetable doors support act'].filter(Boolean).join(' '))
 const fields=timetableRows(concert,settings)
 const hasPending=pendingSupport.length>0||fields.some(({key})=>pendingShowTime(concert,key,proposal?.times?.[key]))
 const hadMatches=Object.keys(proposal?.times||{}).length>0||proposal?.supportActs?.length>0
 const notice=hasPending||!hadMatches?proposal?.notice:null
 return <section style={{background:'#13131f',border:'1px solid #1f1f35',borderRadius:10,padding:14}}>
   <div style={{fontSize:10,color:'#9491b8',fontFamily:"'DM Mono', monospace",textTransform:'uppercase',marginBottom:6}}>Schedule</div>
   {fields.map(({key,label,time,supportIndex})=>{
     const found=pendingShowTime(concert,key,proposal?.times?.[key]);
     return <div key={key} style={{padding:'10px 0',borderBottom:'1px solid #25243a'}}>
       <div style={row}><span>{label}{supportIndex!=null&&<small style={{...muted,marginLeft:6}}>Support act</small>}</span><span style={{color:time?'#e2e0ff':'#9491b8'}}>{time||'Unknown'}</span></div>
       {found && <div style={{...row,...muted}}>
         <span>{found.label===label?'Found in the timetable':found.label}</span>
         <button disabled={!!saving} onClick={()=>accept(key,found)} style={{...button,whiteSpace:'nowrap'}}>{saving===key?'Saving…':'Use '+found.value}</button>
       </div>}
     </div>
   })}
   {(pendingSupport.length>0||supportDraft)&&<div style={{borderBottom:'1px solid #25243a'}}>
     {pendingSupport.map(act=><div key={act.name} style={{...row,borderTop:'1px solid #25243a'}}>
       <div style={{flex:1,overflowWrap:'anywhere'}}>{act.name}{act.time?' · '+act.time:''}<div style={muted}>Found in the timetable</div></div>
       <button type="button" disabled={!!saving} onClick={()=>setSupportDraft(foundDraft(act))} style={button}>Edit</button>
       <button type="button" disabled={!!saving||!!supportDraft} onClick={()=>saveSupport(foundDraft(act),false)} style={button}>{saving==='support:'+act.name?'Saving…':'Use'}</button>
     </div>)}
     {supportDraft&&<form key={supportDraft.sourceName} onSubmit={async e=>{e.preventDefault();if(await saveSupport(supportDraft,true))setSupportDraft(null)}} style={{background:'#0c0c14',borderRadius:8,padding:'10px',marginBottom:10}}>
       <div style={{display:'grid',gridTemplateColumns:'minmax(0, 1fr) minmax(108px, 40%)',gap:8}}>
         <label style={muted}>Support act<input value={supportDraft.name} disabled={!!saving} onChange={e=>setSupportDraft({...supportDraft,name:e.target.value})} autoFocus placeholder="Artist name" style={input} /></label>
         <label style={muted}>Start time (optional)<input type="time" disabled={!!saving} value={supportDraft.time} onChange={e=>setSupportDraft({...supportDraft,time:e.target.value})} style={{...input,paddingInline:5}} /></label>
       </div>
       <div style={{display:'flex',justifyContent:'flex-end',gap:14}}>
         <button type="button" disabled={!!saving} onClick={()=>setSupportDraft(null)} style={button}>Cancel</button>
         <button type="submit" disabled={!!saving||!supportDraft.name.trim()} style={button}>{saving?'Saving…':'Save support act'}</button>
       </div>
     </form>}
   </div>}
   <details style={{marginTop:8,color:'#c4c2f0',fontSize:13}}>
     <summary style={{padding:'12px 0',minHeight:44,cursor:'pointer'}}>Sources & manual times</summary>
     <div style={{display:'grid',gridTemplateColumns:`repeat(${source?3:2},minmax(0,1fr))`,gap:6}}><button disabled={busy} onClick={()=>find(scheduleRequest(concert,settings,url))} style={action}>{busy?'Checking…':'Find times'}</button>{source&&<a href={source} target="_blank" rel="noopener noreferrer" style={action}>Open source ↗</a>}<a href={search} target="_blank" rel="noopener noreferrer" style={action}>Search times ↗</a></div>
     {proposal?.sources?.map((s,i)=><div key={i} style={{...muted,padding:'5px 0'}}>{link(s.url)?<a href={link(s.url)} target="_blank" rel="noopener noreferrer" style={{color:'#a78bfa'}}>{s.name} ↗</a>:s.name} · {s.status}</div>)}
     <label style={{...muted,display:'block',marginTop:10}}>Event-page link<input type="url" value={url} onChange={e=>{setUrl(e.target.value);setProposal(null)}} placeholder="https://venue.com/this-event" style={{width:'100%',background:'#0c0c14',border:'1px solid #2e2e50',borderRadius:8,color:'#c4c2f0',padding:10,fontSize:16,marginTop:5}} /></label>
     <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>{link(url)&&url!==saved&&<button disabled={!!saving} style={button} onClick={()=>persist('source',{scheduleUrl:link(url)})}>Save source</button>}<button onClick={onEdit} style={button}>Enter times manually</button></div>
   </details>
   {(busy||error||notice)&&<div aria-live="polite" style={{...muted,color:error?'#f87171':muted.color}}>{error||(busy?'Checking show sources…':notice)}</div>}
 </section>
}
