import {useRef,useState} from 'react'
import {geocodeVenue} from '../lib/geocode'
import {validCoordinates,parseCoordinates,venueLocations} from '../lib/venueCoordinates'
import VenueMap from './VenueMap'

export default function MapRepair({concerts,settings,onUpdateSetting,venueName=null,includeSaved=true}) {
  const all = venueLocations(concerts,includeSaved ? settings.savedVenues : [])
  const venues = venueName ? all.filter(v=>v.name === venueName) : all
  const [selected,setSelected] = useState(venueName || '')
  const [lat,setLat] = useState(settings.venueInfo?.[venueName]?.lat ?? ''), [lng,setLng] = useState(settings.venueInfo?.[venueName]?.lng ?? '')
  const [busy,setBusy] = useState(false), [message,setMessage] = useState('')
  const lock = useRef(false)
  const latest = useRef(settings); latest.current = settings
  const missing = venues.filter(v=>!validCoordinates(settings.venueInfo?.[v.name]?.lat,settings.venueInfo?.[v.name]?.lng))
  const choose = name => {
    setSelected(name);setMessage('')
    setLat(settings.venueInfo?.[name]?.lat ?? '');setLng(settings.venueInfo?.[name]?.lng ?? '')
  }
  const save = async coords => {
    const info = latest.current.venueInfo || {}
    const result = await onUpdateSetting('venueInfo',{...info,[selected]:{...info[selected],...coords}})
    if (result?.error) throw result.error
    setMessage('Map position saved.');setLat(coords.lat);setLng(coords.lng)
  }
  const act = async lookup => {
    if(lock.current) return
    lock.current=true;setBusy(true);setMessage('')
    try {
      const venue = venues.find(v=>v.name === selected)
      if(!venue) throw new Error('Choose a venue first.')
      const coords = lookup ? await geocodeVenue(venue.name,venue.city,venue.country) : parseCoordinates(lat,lng)
      if(!coords) throw new Error(lookup?'No location found, or the lookup service is unavailable. Try again later or place the pin manually.':'Enter latitude −90 to 90 and longitude −180 to 180.')
      await save(coords)
    } catch(e) {setMessage(e.message || 'Could not save map position.')} finally {setBusy(false);lock.current=false}
  }
  const point = parseCoordinates(lat,lng)
  if(!missing.length) return null
  return <details style={{padding:12,border:'1px solid #2e2e50',borderRadius:10,margin:'12px 0'}}>
    <summary>Map positions · {missing.length} missing</summary>
    {missing.length > 0 && <p style={{fontSize:12}}>Missing pins: {missing.map(v=>v.name).join(', ')}</p>}
    <label>Venue <select aria-label="Venue to locate" value={selected} disabled={busy} onChange={e=>choose(e.target.value)}><option value="">Choose a venue</option>{venues.map(v=><option key={v.name}>{v.name}</option>)}</select></label>
    {selected && <>
      <p><button disabled={busy} onClick={()=>act(true)}>{busy?'Working…':'Look up / retry location'}</button></p>
      <label>Latitude <input aria-label="Latitude" type="number" min="-90" max="90" step="any" value={lat} disabled={busy} onChange={e=>setLat(e.target.value)}/></label>
      <label>Longitude <input aria-label="Longitude" type="number" min="-180" max="180" step="any" value={lng} disabled={busy} onChange={e=>setLng(e.target.value)}/></label>
      <p>Enter coordinates, or zoom in and tap the map to place a pin. Save when it looks right.</p>
      <VenueMap points={point?[{...point,name:selected,pastCount:1}]:[]} height={220} onPick={busy?null:p=>{setLat(p.lat);setLng(p.lng)}} />
      <button disabled={busy || !point} onClick={()=>act(false)}>Save map position</button>
    </>}
    {message && <p role="status">{message}</p>}
  </details>
}
