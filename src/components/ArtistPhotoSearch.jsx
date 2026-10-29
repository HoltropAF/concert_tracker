import {useEffect, useRef, useState} from 'react'

const button = {background:'none',border:0,color:'var(--accent, #a78bfa)',minHeight:44,cursor:'pointer',fontSize:12}
const plain = value => new DOMParser().parseFromString(value || '', 'text/html').body.textContent || ''
export default function ArtistPhotoSearch({artist,onChoose,disabled}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(artist),[results,setResults]=useState(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(null)
  const controller=useRef(null)
  useEffect(()=>()=>controller.current?.abort(),[])
  async function search(e) {
    e.preventDefault()
    if(!query.trim()) return
    controller.current?.abort()
    const abort=new AbortController(); controller.current=abort
    const timeout=setTimeout(()=>abort.abort(),15000)
    setBusy(true);setError('');setSelected(null);setResults(null)
    try {
      const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:query.trim(),gsrnamespace:'6',gsrlimit:'20',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'960',format:'json',origin:'*'})
      const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal:abort.signal,credentials:'omit'})
      if(!response.ok) throw new Error('Photo search is unavailable. Try again shortly.')
      const data=await response.json()
      if(data.error) throw new Error('Photo search failed. Try a different name.')
      const photos=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(page=>{
        const info=page.imageinfo?.[0],meta=info?.extmetadata||{}
        if(!info || !['image/jpeg','image/png','image/webp'].includes(info.mime)) return []
        const url=info.thumburl||info.url
        if(!url?.startsWith('https://upload.wikimedia.org/') || !info.descriptionurl?.startsWith('https://commons.wikimedia.org/')) return []
        return [{url,source:info.descriptionurl,title:page.title.replace(/^File:/,''),author:plain(meta.Artist?.value),license:plain(meta.LicenseShortName?.value)}]
      })
      setResults(photos)
    } catch(err) {setError(err.name==='AbortError'?'Search timed out. Please try again.':err.message)}
    finally {clearTimeout(timeout);setBusy(false)}
  }
  async function choose() {
    setBusy(true);setError('')
    const abort=new AbortController();controller.current=abort
    const timeout=setTimeout(()=>abort.abort(),20000)
    try {
      const response=await fetch(selected.url,{signal:abort.signal,credentials:'omit'})
      if(!response.ok) throw new Error('Could not download this photo. Choose another or try again.')
      const blob=await response.blob()
      if(!['image/jpeg','image/png','image/webp'].includes(blob.type) || blob.size>12*1024*1024) throw new Error('This photo is too large or unsupported. Choose another.')
      await onChoose(new File([blob],'artist-photo',{type:blob.type}),selected)
      setOpen(false);setSelected(null)
    } catch(err) {setError(err.name==='AbortError'?'Download timed out. Please try again.':err.message)}
    finally {clearTimeout(timeout);setBusy(false)}
  }
  return <section style={{padding:'0 18px',color:'var(--text, #c4c2f0)'}}>
    <button style={button} disabled={busy||disabled} onClick={()=>setOpen(!open)} aria-expanded={open}>⌕ Find an artist photo online {open?'−':'+'}</button>
    {open && <div style={{paddingBottom:12}}>
      <form onSubmit={search} style={{display:'flex',gap:8}}><input aria-label="Artist photo search" value={query} onChange={e=>setQuery(e.target.value)} style={{minWidth:0,flex:1,padding:10,borderRadius:8}}/><button style={button} disabled={busy||disabled}>Search</button></form>
      <p style={{fontSize:11,opacity:.7}}>Photos from Wikimedia Commons. Select a photo to preview it; credits stay with your banner.</p>
      {busy && <p role="status">{selected?'Saving photo…':'Searching…'}</p>}
      {error && <p role="alert" style={{fontSize:12}}>{error}</p>}
      {results?.length===0 && <p style={{fontSize:12}}>No photos found. Try the artist’s full name or another spelling.</p>}
      {selected ? <div><img src={selected.url} alt={selected.title} style={{width:'100%',maxHeight:280,objectFit:'contain'}}/><p style={{fontSize:11}}>{selected.author} · {selected.license}</p><a href={selected.source} target="_blank" rel="noopener noreferrer" style={button}>Photo source ↗</a><div style={{display:'flex',gap:20}}><button style={button} disabled={busy||disabled} onClick={choose}>Use this photo</button><button style={button} disabled={busy} onClick={()=>setSelected(null)}>Choose another</button></div></div>
      : <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>{results?.map(photo=><button key={photo.source} disabled={busy||disabled} onClick={()=>setSelected(photo)} aria-label={'Preview '+photo.title} style={{padding:0,border:0,background:'none',cursor:'pointer'}}><img loading="lazy" src={photo.url} alt={photo.title} style={{width:'100%',height:120,objectFit:'cover',borderRadius:8}}/></button>)}</div>}
    </div>}
  </section>
}
