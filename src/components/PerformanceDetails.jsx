import {useState} from 'react'
import {releaseNote,toMedley} from '../lib/setlistRows'

const field={width:'100%',background:'#13131f',border:'1px solid #2e2e50',borderRadius:7,color:'#c4c2f0',padding:8,fontSize:14}
export default function PerformanceDetails({song,onChange,readOnly=false}){
  const [partName,setPartName]=useState('')
  const row=typeof song==='string'?{name:song}:song
  const parts=row.type==='medley'?row.parts||[]:null
  if(readOnly&&!parts&&!row.unreleasedAtShow)return null
  const metadata=(value,update)=>readOnly&&!value.unreleasedAtShow?null:<div style={{fontSize:11,color:'#9491b8',marginTop:2}}>
    {readOnly?releaseNote(value):<>
      <label><input type="checkbox" checked={!!value.unreleasedAtShow} onChange={e=>update({...value,unreleasedAtShow:e.target.checked})}/> Unreleased at this show</label>
      {value.unreleasedAtShow&&<label style={{display:'block',marginTop:6}}>Release date (optional; correct reissue dates)<input aria-label="Release date" type="text" placeholder="YYYY, YYYY-MM or YYYY-MM-DD" pattern="[0-9]{4}(-[0-9]{2})?(-[0-9]{2})?" value={value.releaseDate||''} onChange={e=>update({...value,releaseDate:e.target.value,releaseDateManual:true})} style={field}/></label>}
    </>}
  </div>
  return <div style={{marginTop:readOnly?4:5}}>
    {!readOnly&&<label style={{fontSize:12}}><input type="checkbox" checked={!!parts} onChange={e=>{
      if(e.target.checked)onChange(toMedley(row))
      else if(parts.length<=1)onChange(parts[0]||{name:row.name})
    }} disabled={!!parts&&parts.length>1}/> Medley / remix{parts?.length>1?' · remove extra parts to convert to a single song':''}</label>}
    {parts?<>
      {!readOnly&&<input aria-label="Medley title" style={field} value={row.name||''} onChange={e=>onChange({...row,name:e.target.value})}/>}
      {parts.map((part,index)=>{const value=typeof part==='string'?{name:part}:part;const update=next=>onChange({...row,parts:parts.map((p,i)=>i===index?next:p)});return <div key={index} style={{padding:readOnly?'2px 0 2px 9px':'4px 0',lineHeight:1.4,borderLeft:readOnly?'2px solid #3d3564':undefined}}>
        {readOnly?<span style={{fontSize:13,fontWeight:500,fontFamily:"'DM Sans', sans-serif",color:'#e2e0ff'}}>{value.name}{value.spotifyId&&<span aria-label="Linked to Spotify" title="Linked to Spotify" style={{color:'#1DB954',fontSize:9,marginLeft:5}}>●</span>}</span>:<div style={{display:'flex',gap:6}}><input aria-label={`Song part ${index+1}`} style={field} value={value.name||''} onChange={e=>update({...value,name:e.target.value})}/><button type="button" aria-label={`Remove part ${index+1}`} onClick={()=>onChange({...row,parts:parts.filter((_,i)=>i!==index)})}>×</button></div>}
        {metadata(value,update)}
      </div>})}
      {!readOnly&&<div style={{marginTop:8}}><input aria-label="New medley part" style={field} placeholder="Song title / working title" value={partName} onChange={e=>setPartName(e.target.value)}/><button type="button" disabled={!partName.trim()} onClick={()=>{onChange({...row,parts:[...parts,{name:partName.trim()}]});setPartName('')}}>Add song part</button><p style={{fontSize:11,color:'#9491b8'}}>Link each part using Link Spotify for this setlist, or from Songs.</p></div>}
    </>:metadata(row,onChange)}
  </div>
}
