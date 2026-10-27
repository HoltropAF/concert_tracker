import {useState} from 'react'
import {releaseNote} from '../lib/setlistRows'

const field={width:'100%',background:'#13131f',border:'1px solid #2e2e50',borderRadius:7,color:'#c4c2f0',padding:8,fontSize:14}
export default function PerformanceDetails({song,onChange,readOnly=false}){
  const [partName,setPartName]=useState('')
  const row=typeof song==='string'?{name:song}:song
  const parts=row.type==='medley'?row.parts||[]:null
  if(readOnly&&!parts&&!row.unreleasedAtShow)return null
  const metadata=(value,update)=><div style={{fontSize:11,color:'#9491b8',marginTop:4}}>
    {readOnly?releaseNote(value):<>
      <label><input type="checkbox" checked={!!value.unreleasedAtShow} onChange={e=>update({...value,unreleasedAtShow:e.target.checked})}/> Unreleased at this show</label>
      {value.unreleasedAtShow&&<label style={{display:'block',marginTop:6}}>Release date (optional; correct reissue dates)<input aria-label="Release date" type="text" placeholder="YYYY, YYYY-MM or YYYY-MM-DD" pattern="[0-9]{4}(-[0-9]{2})?(-[0-9]{2})?" value={value.releaseDate||''} onChange={e=>update({...value,releaseDate:e.target.value,releaseDateManual:true})} style={field}/></label>}
    </>}
  </div>
  return <div style={{marginTop:5}}>
    {!readOnly&&<label style={{fontSize:12}}><input type="checkbox" checked={!!parts} onChange={e=>{
      if(e.target.checked)onChange({type:'medley',name:'Medley / remix',parts:[row]})
      else if(parts.length<=1)onChange(parts[0]||{name:row.name})
    }} disabled={!!parts&&parts.length>1}/> Medley / remix{parts?.length>1?' · remove extra parts to convert to a single song':''}</label>}
    {parts?<>
      {!readOnly&&<input aria-label="Medley title" style={field} value={row.name||''} onChange={e=>onChange({...row,name:e.target.value})}/>}
      {parts.map((part,index)=>{const value=typeof part==='string'?{name:part}:part;const update=next=>onChange({...row,parts:parts.map((p,i)=>i===index?next:p)});return <div key={index} style={{padding:'6px 0 6px 10px',borderLeft:'2px solid #3d3564',marginTop:6}}>
        {readOnly?<span style={{fontSize:12,color:'#c4c2f0'}}>{value.name}{value.spotifyId?' · linked':''}</span>:<div style={{display:'flex',gap:6}}><input aria-label={`Song part ${index+1}`} style={field} value={value.name||''} onChange={e=>update({...value,name:e.target.value})}/><button type="button" aria-label={`Remove part ${index+1}`} onClick={()=>onChange({...row,parts:parts.filter((_,i)=>i!==index)})}>×</button></div>}
        {metadata(value,update)}
      </div>})}
      {!readOnly&&<div style={{marginTop:8}}><input aria-label="New medley part" style={field} placeholder="Song title / working title" value={partName} onChange={e=>setPartName(e.target.value)}/><button type="button" disabled={!partName.trim()} onClick={()=>{onChange({...row,parts:[...parts,{name:partName.trim()}]});setPartName('')}}>Add song part</button><p style={{fontSize:11,color:'#9491b8'}}>Link each part using Link Spotify for this setlist, or from Songs.</p></div>}
    </>:metadata(row,onChange)}
  </div>
}
