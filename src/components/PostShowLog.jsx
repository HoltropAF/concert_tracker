import { useEffect, useState } from 'react'
import ShowControlSheet from './ShowControlSheet'
import { matchesPostShowSetlist } from '../lib/postShowLog'
import { localDay } from '../lib/showDay'
import { setlistSongs } from '../lib/setlistRows'
import { reuseSpotifyLinks } from '../lib/spotifyReuse'

const secondary = { color:'#9491b8', fontSize:12, lineHeight:1.5 }
const input = { background:'#0c0c14', color:'#e2e0ff', border:'1px solid #2e2e50', borderRadius:8, padding:8, fontSize:16 }

export default function PostShowLog({ concert, concerts, ratingMax, onSave, onClose }) {
  const hasSetlist = setlistSongs(concert.setlist).length > 0
  const findSetlist = !hasSetlist && concert.type !== 'festival' && concert.attendanceMode !== 'online'
  const [matches,setMatches] = useState([])
  const [choice,setChoice] = useState(null)
  const [looking,setLooking] = useState(findSetlist)
  const [lookupMessage,setLookupMessage] = useState('')
  const [rating,setRating] = useState(concert.rating || '')
  const [notes,setNotes] = useState(concert.notes || '')
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')

  useEffect(() => {
    if (!findSetlist) return
    const controller = new AbortController()
    const run = async () => {
      try {
        const params = new URLSearchParams({artist:concert.artist,date:concert.date,city:concert.city||'',search:'1',period:'past',today:localDay()})
        const response = await fetch('/api/setlist?' + params,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])})
        if (!response.ok && response.status !== 404) throw Error('Setlist search is unavailable here.')
        const result = response.ok ? await response.json() : {results:[]}
        if (!Array.isArray(result.results)) throw Error('Setlist search is unavailable here.')
        const matching = result.results.filter(item => matchesPostShowSetlist(concert,item))
        if (controller.signal.aborted) return
        setMatches(matching)
        if (matching.length === 1) setChoice(matching[0])
        if (!matching.length) setLookupMessage('No setlist matched this artist, date, and location yet.')
      } catch {
        if (!controller.signal.aborted) setLookupMessage('Could not check for a setlist. You can still log the show.')
      } finally {
        if (!controller.signal.aborted) setLooking(false)
      }
    }
    run()
    return () => controller.abort()
  }, [concert,findSetlist])

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const result = await onSave({ ...concert, rating:Number(rating),
        notes, loggedAt:new Date().toISOString(),
        ...(choice ? {setlist:reuseSpotifyLinks(choice.songs,concert.artist,concerts),setlistSource:choice.url} : {}) },{notify:true})
      if (result?.error) throw result.error
      onClose()
    } catch { setError('Could not save the show log. Try again.'); setSaving(false) }
  }

  return <ShowControlSheet title="Log this show" onClose={onClose} showDone={false}>
    <strong>{concert.artist}</strong>
    <p style={secondary}>{[concert.date,concert.venue].filter(Boolean).join(' · ')}</p>
    {looking && <p role="status" style={secondary}>Looking for the setlist…</p>}
    {lookupMessage && <p role="status" style={secondary}>{lookupMessage}</p>}
    {matches.length > 1 && <label style={{display:'grid',gap:4,marginBottom:10}}>Setlist<select style={input} value={choice ? String(matches.indexOf(choice)) : ''} onChange={e=>setChoice(e.target.value===''?null:matches[Number(e.target.value)])}>
      <option value="">Choose a matching setlist</option>
      {matches.map((item,index)=><option key={item.url||index} value={index}>Setlist {index+1} · {setlistSongs(item.songs).length} songs{item.tour?' · '+item.tour:''}</option>)}
    </select></label>}
    {matches.length === 1 && !choice && <button type="button" onClick={()=>setChoice(matches[0])} style={{...input,fontSize:12,marginBottom:10}}>Review found setlist</button>}
    {choice && <details open style={{marginBottom:12,color:'#c4c2f0'}}>
      <summary>Review {setlistSongs(choice.songs).length} songs</summary>
      <ol style={{maxHeight:150,overflowY:'auto',paddingInlineStart:24,fontSize:13}}>
        {setlistSongs(choice.songs).map((song,index)=><li key={index}>{typeof song==='string'?song:song.name}</li>)}
      </ol>
      <button type="button" onClick={()=>setChoice(null)} style={{...input,fontSize:12}}>Skip importing songs</button>
    </details>}
    <div style={{display:'grid',gap:8}}>
      <label style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>Rating <select style={input} value={rating} onChange={e=>setRating(e.target.value)}><option value="">Optional</option>{Array.from({length:ratingMax},(_,index)=><option key={index+1} value={index+1}>{index+1} / {ratingMax}</option>)}</select></label>
      <label style={{display:'grid',gap:4}}>Notes<textarea rows={2} style={input} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <button type="button" disabled={saving} onClick={submit} style={{...input,minHeight:44,background:'#a78bfa',color:'#0c0c14',fontWeight:700}}>{saving?'Saving…':looking?'I was there · Save without a setlist':'I was there · Save log'}</button>
      {error && <div role="alert" style={{color:'#fda4af'}}>{error}</div>}
    </div>
  </ShowControlSheet>
}
