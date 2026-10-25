import { discoveryCountry, wishlistDraft } from './discovery.js'
import { validDate } from './calendar.js'

const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const updateFields = { date: 'Show date', venue: 'Venue', city: 'City', country: 'Country', ticketSaleAt: 'Ticket sale (your local time)', ticketSaleLink: 'Ticket seller' }
export function safeTicketUrl(value, event) {
  try {
    const url = new URL(value)
    if(event?.venueWebsite && value===event.url && url.protocol==='https:' && !url.username && !url.password)return url.href
    return url.protocol === 'https:' && /(^|\.)(ticketmaster\.(nl|be|de|fr|com|co\.uk)|mojo\.nl)$/i.test(url.hostname) ? url.href : ''
  } catch { return '' }
}
export function isSameWish(concert, event) {
  if (concert.discovery?.id === event.id) return true
  return validDate(concert.date) && concert.date === event.date &&
    normalize(concert.artist) === normalize(event.artist) &&
    !!normalize(concert.venue) && normalize(concert.venue) === normalize(event.venue)
}
export function proposedChanges(concert, event) {
  const draft = wishlistDraft(event)
  draft.ticketSaleLink = safeTicketUrl(event.url,event)
  return Object.entries(updateFields).flatMap(([key, label]) => {
    const value = draft[key]
    const current = key === 'date' && !validDate(concert.date) ? '' : concert[key] || ''
    if (!value || current === value || (key === 'date' && !validDate(value))) return []
    return [{ key, label, before: current, after: value }]
  })
}
export function applyWishUpdates(concert, event, selected) {
  if (!concert.wishlist) throw Error('This show is no longer in Want to go.')
  const changes = proposedChanges(concert, event).filter(change => selected.includes(change.key))
  return {
    ...concert,
    ...Object.fromEntries(changes.map(change => [change.key, change.after])),
    discovery: {
      ...concert.discovery, id: event.id, source: event.source, url: safeTicketUrl(event.url,event),
      status: event.status, checkedAt: event.checkedAt, venueWebsite: !!event.venueWebsite,
    },
  }
}
export async function checkWish(concert, { fetcher = fetch, signal, sources = ['ticketmaster', 'mojo'], venues = [], now = new Date(), budgetMs = 15000, sourceMs = 10000, onProgress = () => {} } = {}) {
  if (!String(concert.artist || '').trim()) throw Error('Add an artist before checking.')
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const queue = [...sources,...[...venues].sort((a,b)=>Number(normalize(b.name)===normalize(concert.venue))-Number(normalize(a.name)===normalize(concert.venue)))]
  if(!queue.length)throw Error('Enable a concert search source in Settings → Integrations.')
  const deadline=Date.now()+budgetMs, events=new Map(),reports=new Array(queue.length)
  let next=0,completed=0
  const publish=()=>onProgress({done:completed,total:queue.length,found:events.size})
  const worker=async()=>{
    while(next<queue.length){
      const index=next++,source=queue[index],venueSource=typeof source==='object'
      const report={source:venueSource?source.name:source,count:0,pages:0,error:null,skipped:null,warning:null,checkedAt:new Date().toISOString()}
      reports[index]=report
      if(signal?.aborted||Date.now()>=deadline){report.error=signal?.aborted?'Stopped before checking this source.':'Not checked within the time limit.';completed++;publish();continue}
      const controller=new AbortController(),stop=()=>controller.abort()
      signal?.addEventListener('abort',stop,{once:true})
      let timer
      const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error(signal?.aborted?'Check stopped.':'Source timed out.')),{once:true}))
      timer=setTimeout(stop,Math.min(sourceMs,deadline-Date.now()))
      try {
        for(let page=1;page<=2;page++){
          const params=venueSource?{artist:concert.artist,today,website:source.url,venueName:source.name}:{artist:concert.artist,country:discoveryCountry(concert.country),today,source,page:String(page)}
          const request=async()=>{const response=await fetcher((venueSource?'/api/venue-updates?':'/api/upcoming?')+new URLSearchParams(params),{signal:controller.signal});const data=await response.json();if(!response.ok||!Array.isArray(data.events))throw Error(data.error||'Source unavailable');return data}
          const data=await Promise.race([request(),aborted])
          if(data.skipped){report.skipped=data.skipped;break}
          report.pages++;report.warning=data.warning||null;report.checkedAt=data.checkedAt||report.checkedAt
          for(const event of data.events){if(typeof event.artist!=='string'||!event.id||!safeTicketUrl(event.url,event))continue;events.set(event.id,event);report.count++}
          if(!data.hasMore||venueSource)break
          if(page===2)report.warning='More pages available; quick check is limited to two pages.'
        }
      }catch(error){report.error=error.message}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);completed++;publish()}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,queue.length)},worker))
  const candidates=[...events.values()],exact=candidates.filter(event=>isSameWish(concert,event))
  const incomplete=reports.some(r=>r.error||r.warning),checked=reports.filter(r=>r.pages>0).length
  return {events:exact.length?exact:candidates,exact:exact.length===1,checkedAt:new Date().toISOString(),limited:incomplete,reports,checkedSources:checked,totalSources:queue.length,status:candidates.length?'found':incomplete?(checked?'partial':'error'):reports.every(r=>r.skipped)?'skipped':'empty',message:reports.filter(r=>r.error).map(r=>r.source+': '+r.error).join(' · ')}
}
