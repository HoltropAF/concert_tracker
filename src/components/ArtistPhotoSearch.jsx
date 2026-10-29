import {useRef, useState} from 'react'
import {createPortal} from 'react-dom'
const choice={display:'block',width:'100%',boxSizing:'border-box',padding:'14px 12px',border:'1px solid #393454',borderRadius:10,background:'#201c30',color:'#e2e0ff',textAlign:'left',fontSize:14,textDecoration:'none',cursor:'pointer'}
export default function ArtistPhotoSearch({artist,onChoose,disabled,hasPhoto}) {
  const dialog=useRef(null),input=useRef(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const [online,setOnline]=useState(false),[query,setQuery]=useState(artist),[images,setImages]=useState(null),[selected,setSelected]=useState(null)
  const [visibleCount,setVisibleCount]=useState(8)
  async function search(term=query) {
    if(!term.trim())return
    setBusy(true);setError('');setSelected(null);setImages(null);setVisibleCount(8)
    try {
      const response=await fetch('/api/artist-images?q='+encodeURIComponent(term.trim()),{signal:AbortSignal.timeout(20000)})
      const data=await response.json()
      if(!response.ok)throw Error(data.error||'Search failed.')
      setImages(data.images)
    }catch(err){setError(err.name==='TimeoutError'?'Search timed out. Try again.':err.message)}
    finally{setBusy(false)}
  }
  async function importPhoto() {
    setBusy(true);setError('')
    try {
      const response=await fetch('/api/artist-images?image='+encodeURIComponent(selected.token),{signal:AbortSignal.timeout(20000)})
      if(!response.ok){const data=await response.json();throw Error(data.error||'Photo import failed.')}
      const blob=await response.blob()
      await onChoose(new File([blob],'artist-photo',{type:blob.type}),{source:selected.source,title:selected.title})
      dialog.current?.close()
    }catch(err){setError(err.name==='TimeoutError'?'Photo import timed out. Try again.':err.message)}
    finally{setBusy(false)}
  }
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
    {createPortal(<dialog ref={dialog} aria-label={'Photo for '+artist} onCancel={e=>{if(busy)e.preventDefault()}} style={{background:'#13131f',color:'#e2e0ff',border:'1px solid #393454',position:'fixed',top:'auto',bottom:0,left:0,right:0,margin:'0 auto',borderRadius:'20px 20px 0 0',padding:'18px 18px calc(12px + env(safe-area-inset-bottom, 0px))',width:'min(480px, 100vw)',maxWidth:'100vw',maxHeight:'85dvh',overflowY:'auto',boxSizing:'border-box'}}>
      <h2 style={{fontSize:18,margin:'0 0 16px'}}>Add artist photo</h2>
      <button type="button" disabled={busy} onClick={()=>{if(online){setOnline(false)}else{setOnline(true);setQuery(artist);search(artist)}}} style={{...choice,marginBottom:10}} aria-expanded={online}>Search online · Google Images</button>
      {online&&<div>
        <form onSubmit={e=>{e.preventDefault();search()}} style={{display:'flex',gap:6,marginBottom:12}}><input aria-label="Artist name" maxLength={160} value={query} onChange={e=>setQuery(e.target.value)} style={{minWidth:0,width:'100%',padding:8}}/><button disabled={busy||!query.trim()} type="submit">Search</button></form>
        {selected?<div><img src={selected.thumbnail} alt={selected.title} style={{width:'100%',maxHeight:220,objectFit:'contain'}}/><a href={selected.source} target="_blank" rel="noopener noreferrer" style={{color:'#a78bfa',fontSize:12}}>Photo source ↗</a><button type="button" disabled={busy} onClick={importPhoto} style={{...choice,margin:'10px 0'}}>Use this photo</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Choose another</button></div>
        :<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>{images?.slice(0,visibleCount).map(photo=><button key={photo.token} type="button" disabled={busy} onClick={()=>{setSelected(photo);setError('')}} aria-label={'Preview '+photo.title} style={{padding:0,border:0,background:'none',cursor:'pointer'}}><img src={photo.thumbnail} alt={photo.title} loading="lazy" style={{width:'100%',height:110,objectFit:'cover',borderRadius:8}}/></button>)}</div>}
        {!selected && images?.length>visibleCount && <button type="button" disabled={busy} onClick={()=>setVisibleCount(count=>count+8)} style={{...choice,textAlign:'center',marginTop:10}}>Load 8 more</button>}
        {images?.length===0&&<p>No photos found. Try another name.</p>}
        <p style={{fontSize:11,color:'#aaa6c4'}}>Google Images via SerpApi. Choose a photo you have permission to use.</p>
      </div>}
      <button type="button" style={choice} disabled={busy||disabled} onClick={()=>input.current.click()}>Choose from phone / Google Photos</button>
      <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
      <p style={{fontSize:11,color:'#aaa6c4'}}>Google Photos appears if available in your phone’s photo picker.</p>
      {busy&&<p role="status">Loading…</p>}
      {error&&<p role="alert" style={{fontSize:12,color:'#fda4af'}}>{error}</p>}
      <button type="button" disabled={busy} onClick={()=>dialog.current.close()} style={{background:'none',border:0,color:'#a78bfa',minHeight:44,marginTop:8,cursor:'pointer'}}>Cancel</button>
    </dialog>,document.body)}
  </>
}
