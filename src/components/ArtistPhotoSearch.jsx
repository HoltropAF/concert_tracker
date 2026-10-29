import {useRef, useState} from 'react'
import {createPortal} from 'react-dom'
const choice={display:'block',width:'100%',boxSizing:'border-box',padding:'14px 12px',border:'1px solid #393454',borderRadius:10,background:'#201c30',color:'#e2e0ff',textAlign:'left',fontSize:14,textDecoration:'none',cursor:'pointer'}
export default function ArtistPhotoSearch({artist,onChoose,disabled,hasPhoto}) {
  const dialog=useRef(null),input=useRef(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function pick(e) {
    const file=e.target.files?.[0];e.target.value=''
    if(!file)return
    setBusy(true);setError('')
    try {await onChoose(file);dialog.current?.close()}
    catch(err){setError(err.message||'Could not save photo. Please try again.')}
    finally{setBusy(false)}
  }
  return <>
    <button type="button" disabled={busy||disabled} onClick={()=>{setError('');dialog.current.showModal()}} style={{background:hasPhoto?'#0c0c14aa':'#a78bfa',border:0,borderRadius:99,color:hasPhoto?'#fff':'#0c0c14',fontSize:12,padding:'5px 12px',cursor:'pointer'}}>{busy?'Saving…':hasPhoto?'Change photo':'📷 Add photo'}</button>
    {createPortal(<dialog ref={dialog} aria-label={'Photo for '+artist} onCancel={e=>{if(busy)e.preventDefault()}} style={{background:'#13131f',color:'#e2e0ff',border:'1px solid #393454',borderRadius:16,padding:20,width:'min(340px, calc(100vw - 48px))',boxSizing:'border-box'}}>
      <h2 style={{fontSize:18,margin:'0 0 16px'}}>Add artist photo</h2>
      <a href={'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(artist+' artist')} target="_blank" rel="noopener noreferrer" style={{...choice,marginBottom:10}}>Search Google Images ↗</a>
      <p style={{fontSize:12,color:'#aaa6c4',lineHeight:1.5}}>Save a photo from Google, then return here to choose it.</p>
      <button type="button" style={choice} disabled={busy||disabled} onClick={()=>input.current.click()}>Choose from phone / Google Photos</button>
      <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
      <p style={{fontSize:11,color:'#aaa6c4'}}>Google Photos appears if available in your phone’s photo picker.</p>
      {busy&&<p role="status">Saving photo…</p>}
      {error&&<p role="alert" style={{fontSize:12,color:'#fda4af'}}>{error}</p>}
      <button type="button" disabled={busy} onClick={()=>dialog.current.close()} style={{background:'none',border:0,color:'#a78bfa',minHeight:44,marginTop:8,cursor:'pointer'}}>Cancel</button>
    </dialog>,document.body)}
  </>
}
