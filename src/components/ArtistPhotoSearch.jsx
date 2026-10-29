import {useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import './ArtistPhotoSearch.css'
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
    <button type="button" disabled={busy||disabled} onClick={()=>{setError('');setOnline(false);setSelected(null);dialog.current.showModal()}} style={{background:hasPhoto?'#0c0c14aa':'#a78bfa',border:0,borderRadius:99,color:hasPhoto?'#fff':'#0c0c14',fontSize:12,padding:'5px 12px',cursor:'pointer'}}>{busy?'Saving…':hasPhoto?'Change photo':'📷 Add photo'}</button>
    {createPortal(<dialog className="artist-photo-sheet" ref={dialog} aria-label={'Photo for '+artist} onCancel={e=>{if(busy)e.preventDefault()}}>
      <div className="artist-photo-handle" aria-hidden="true"/>
      <header className="artist-photo-header">
        {online&&<button type="button" className="artist-photo-icon" aria-label={selected?'Back to photos':'Back to photo options'} disabled={busy} onClick={()=>{setError('');if(selected)setSelected(null);else setOnline(false)}}>←</button>}
        <div><h2>{selected?'Preview photo':online?'Find a photo':hasPhoto?'Change artist photo':'Add artist photo'}</h2><p>{artist}</p></div>
        <button type="button" className="artist-photo-icon" aria-label="Close photo picker" disabled={busy} onClick={()=>dialog.current.close()}>×</button>
      </header>
      <div className="artist-photo-content" aria-busy={busy}>
        {!online ? <div className="artist-photo-options">
          <button type="button" disabled={busy} onClick={()=>{setOnline(true);setQuery(artist);search(artist)}}><span className="artist-photo-option-icon" aria-hidden="true">⌕</span><span><strong>Search online</strong><small>Find a photo with Google Images</small></span><span aria-hidden="true">›</span></button>
          <button type="button" disabled={busy||disabled} onClick={()=>input.current.click()}><span className="artist-photo-option-icon" aria-hidden="true">▧</span><span><strong>Choose from your phone</strong><small>Gallery or Google Photos, when available</small></span><span aria-hidden="true">›</span></button>
        </div> : selected ? <div>
          <div className="artist-photo-preview"><img src={selected.thumbnail} alt={selected.title}/></div>
          <p className="artist-photo-title">{selected.title}</p>
          <a className="artist-photo-source" href={selected.source} target="_blank" rel="noopener noreferrer">Photo source ↗</a>
          <p className="artist-photo-note">You can reposition the photo after saving.</p>
        </div> : <>
          <form className="artist-photo-search" onSubmit={e=>{e.preventDefault();if(!busy)search()}}><input aria-label="Artist name" maxLength={160} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Artist name"/><button disabled={busy||!query.trim()} type="submit">Search</button></form>
          {busy ? <div role="status" className="artist-photo-loading"><span className="artist-photo-spinner"/>Finding photos…</div> : <>
            {!!images?.length&&<p className="artist-photo-note">Tap a photo to preview · {Math.min(visibleCount,images.length)} shown</p>}
            <div className="artist-photo-grid">{images?.slice(0,visibleCount).map(photo=><button key={photo.token} type="button" onClick={()=>{setSelected(photo);setError('')}} aria-label={'Preview '+photo.title}><img src={photo.thumbnail} alt={photo.title} loading="lazy"/><span>Preview ↗</span></button>)}</div>
            {images?.length>visibleCount&&<button type="button" className="artist-photo-more" onClick={()=>setVisibleCount(count=>count+8)}>Load {Math.min(8,images.length-visibleCount)} more photos ↓</button>}
            {images?.length===0&&<div className="artist-photo-empty">No photos found.<small>Try a different spelling or artist name.</small></div>}
          </>}
          <p className="artist-photo-note">Google Images · powered by SerpApi</p>
        </>}
        <input ref={input} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
        {busy&&(!online||selected)&&<p role="status" className="artist-photo-loading">Saving your photo…</p>}
        {error&&<p role="alert" className="artist-photo-error">{error}</p>}
      </div>
      {selected&&<footer className="artist-photo-footer"><button type="button" disabled={busy} className="artist-photo-primary" onClick={importPhoto}>{busy?'Saving…':'Use this photo'}</button><small>Choose an image you have permission to use.</small></footer>}
    </dialog>,document.body)}
  </>
}