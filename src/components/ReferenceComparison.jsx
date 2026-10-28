import {useState} from 'react'
import {applyReference,compareReference,parseReference,referenceFields,referenceUrl,mediaUrl} from '../lib/referenceComparison'
const field={width:'100%',boxSizing:'border-box',background:'#13131f',border:'1px solid #3d3564',borderRadius:7,color:'#c4c2f0',padding:9,fontSize:14}
const button={background:'none',border:0,color:'var(--accent, #a78bfa)',padding:'10px 0',minHeight:44,cursor:'pointer',fontSize:12}
export default function ReferenceComparison({concert,onSave}){
  const [text,setText]=useState(''),[source,setSource]=useState({name:'Concert Archives',url:''})
  const [draft,setDraft]=useState(null),[selected,setSelected]=useState([]),[confirmed,setConfirmed]=useState(false)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const report=draft?compareReference(concert,draft):null
  const changes=report?[...report.fields,...report.additions]:[]
  const update=(key,value)=>{setDraft(prev=>({...prev,[key]:value}));setSelected([]);setConfirmed(false);setMessage('')}
  const mediaLink=(key,fallback)=>{try{return mediaUrl(concert[key]||'',key)||fallback}catch{return fallback}}
  const links=[['Concert Archives','https://www.concertarchives.org/'],[concert.spotifyUrl?'Spotify':'Find on Spotify',mediaLink('spotifyUrl','https://open.spotify.com/search/'+encodeURIComponent(concert.artist||''))],[concert.youtubeUrl?'YouTube':'Find on YouTube',mediaLink('youtubeUrl','https://www.youtube.com/results?search_query='+encodeURIComponent([concert.artist,concert.venue,concert.date==='9999-12-31'?'':concert.date,'live'].filter(Boolean).join(' ')))]]
  return <section style={{margin:'14px 0',color:'#c4c2f0',borderTop:'1px solid #29233c',paddingTop:12}}>
    <div style={{fontSize:10,color:'#9491b8',fontFamily:"'DM Mono', monospace",textTransform:'uppercase',letterSpacing:'.08em'}}>Sources & comparison</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:'0 16px'}}>{links.map(([label,url])=><a key={label} href={url} target="_blank" rel="noopener noreferrer" style={{...button,textDecoration:'none'}}>{label} ↗</a>)}</div>
    <details><summary style={{...button,fontFamily:"'DM Mono', monospace"}}>Compare or add source details</summary>
    <p style={{fontSize:12,color:'#9491b8',marginBottom:10}}>Paste details you have copied or received in an authorised export. Links are saved as references; this does not fetch Concert Archives. Compare one artist’s setlist at a time.</p>
    <label style={{fontSize:12}}>Source name<input style={field} value={source.name} onChange={e=>setSource({...source,name:e.target.value})}/></label>
    <label style={{display:'block',fontSize:12,marginTop:8}}>Source link (optional)<input style={field} type="url" value={source.url} onChange={e=>setSource({...source,url:e.target.value})}/></label>
    <button type="button" style={button} disabled={busy||!source.url.trim()} onClick={async()=>{setBusy(true);setError('');try{const url=referenceUrl(source.url);const previous=concert.referenceLinks||[];const result=await onSave({...concert,referenceLinks:[...previous.filter(link=>link.url!==url),{name:source.name.trim()||'Source',url}]},{notify:true});if(result?.error)throw Error('Could not save the source link.');setMessage('Source link saved.')}catch(e){setError(e.message)}finally{setBusy(false)}}}>Save source link only</button>
    <textarea aria-label="Reference details" style={{...field,minHeight:140,marginTop:10}} value={text} onChange={e=>setText(e.target.value)} placeholder={'Artist: Example artist\nDate: 2026-10-28\nVenue: Example venue\nCity: Amsterdam\nSetlist:\n1. First song\n2. Second song'} />
    <div style={{display:'flex',gap:16}}><button type="button" disabled={busy} style={button} onClick={()=>{try{referenceUrl(source.url);setDraft(parseReference(text));setSelected([]);setConfirmed(false);setError('');setMessage('')}catch(e){setError(e.message)}}}>Compare pasted details</button><button type="button" style={button} onClick={()=>{setDraft({...Object.fromEntries(referenceFields.map(key=>[key,''])),setlist:[]});setSelected([]);setConfirmed(false);setError('')}}>Enter manually</button></div>
    {draft&&<>
      <details><summary style={button}>Correct extracted details</summary>
        {referenceFields.map(key=><label key={key} style={{display:'block',fontSize:12,marginBottom:6,textTransform:'capitalize'}}>{key==='spotifyUrl'?'Spotify link':key==='youtubeUrl'?'YouTube link':key}<input style={field} type={key==='date'?'date':key.endsWith('Url')?'url':'text'} value={draft[key]} onChange={e=>update(key,e.target.value)}/></label>)}
        <label style={{fontSize:12}}>Song titles, one per line<textarea style={{...field,minHeight:100}} value={draft.setlist.join('\n')} onChange={e=>update('setlist',e.target.value.split('\n'))}/></label>
      </details>
      <p style={{fontSize:12,margin:'8px 0'}}>Saved: {concert.artist} · {concert.date==='9999-12-31'?'Date unknown':concert.date||'Date unknown'} · {concert.venue||'Venue unknown'}</p>
      <p style={{fontSize:11,color:'#9491b8'}}>Check artist, date and venue. A matching value is agreement, not independent verification: Concert Archives may reuse setlist.fm.</p>
      {changes.map(change=><label key={change.id} style={{display:'flex',gap:8,padding:'9px 0',borderBottom:'1px solid #29233c',fontSize:12}}>
        {change.status!=='match'&&<input type="checkbox" disabled={busy} checked={selected.includes(change.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,change.id]:prev.filter(id=>id!==change.id))}/>}
        <span><span style={{color:change.status==='conflict'?'#fbbf24':change.status==='match'?'#6ee7b7':'#a78bfa'}}>{change.status==='match'?'Matches':change.status==='conflict'?'Conflict':'Missing information'} · {change.key==='setlist'?'Song':change.key}</span><br/>{change.status==='conflict'&&<span style={{color:'#9491b8'}}>Saved: {change.before}<br/>Reference: </span>}{change.after}</span>
      </label>)}
      {report.sequenceDiffers&&<p style={{fontSize:12,color:'#fbbf24',marginTop:10}}>Setlists differ ({report.existingCount} saved songs, {report.referenceCount} reference songs). Extra songs are suggestions, not proof they were played. Selected new songs go at the end for you to position; existing songs, repeats, medleys and sections stay unchanged.</p>}
      <button type="button" style={button} disabled={busy} onClick={()=>setSelected(changes.filter(c=>c.status==='addition').map(c=>c.id))}>Select all non-conflicting additions</button>
      <label style={{display:'block',fontSize:12,margin:'8px 0'}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I checked that this is the same show and performer.</label>
      <button type="button" style={button} disabled={busy||!confirmed||!selected.length} onClick={async()=>{
        setBusy(true);setError('');setMessage('')
        try{const clean=parseReference(JSON.stringify(draft));referenceUrl(source.url);const result=await onSave(applyReference(concert,clean,selected,source),{notify:true});if(result?.error)throw Error('Could not save. Please try again.');setSelected([]);setConfirmed(false);setMessage('Selected details saved with their source.')}catch(e){setError(e.message)}finally{setBusy(false)}
      }}>{busy?'Saving…':'Save selected details'}</button>
    </>}
    {error&&<p role="alert" style={{fontSize:12,color:'#fda4af'}}>{error}</p>}
    {message&&<p role="status" style={{fontSize:12,color:'#6ee7b7'}}>{message}</p>}
    {!!concert.referenceImports?.length&&<details><summary style={button}>Saved comparison sources ({concert.referenceImports.length})</summary>{concert.referenceImports.map((item,index)=><p key={index} style={{fontSize:12,marginBottom:8}}>{item.name} · {item.changes.length} changes · {new Date(item.checkedAt).toLocaleDateString()}{item.url&&<a href={(()=>{try{return referenceUrl(item.url)}catch{return undefined}})()} target="_blank" rel="noopener noreferrer" style={{...button,marginLeft:8}}>Source ↗</a>}</p>)}</details>}
    </details>
    {(concert.referenceLinks||[]).map((link,index)=>{let url;try{url=referenceUrl(link.url)}catch{return null}return <a key={index} href={url} target="_blank" rel="noopener noreferrer" style={{...button,display:'block',textDecoration:'none'}}>{link.name} ↗</a>})}
  </section>
}
