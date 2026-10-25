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
export async function checkWish(concert, { fetcher = fetch, signal, sources = ['ticketmaster', 'mojo'], venues = [], now = new Date() } = {}) {
  if (!String(concert.artist || '').trim()) throw Error('Add an artist before checking.')
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const query = { artist: concert.artist, country: discoveryCountry(concert.country), today }
  const events = new Map()
  let checkedAt, hasMore = false
  const reports=[]
  for (const source of [...sources,...venues]) {
    let pages=0, count=0, error=null, skipped=null, warning=null
    for (let page=1;page<=5;page++) {
      try {
        const venueSource=typeof source==='object'
        const endpoint=venueSource ? `/api/venue-updates?${new URLSearchParams({artist:query.artist,today,website:source.url,venueName:source.name})}` : `/api/upcoming?${new URLSearchParams({...query,source,page:String(page)})}`
        const response=await fetcher(endpoint,{signal})
        const data=await response.json()
        if(!response.ok || !Array.isArray(data.events))throw Error(data.error || 'Source unavailable')
        if(data.skipped) { skipped=data.skipped;break }
        pages++; checkedAt=data.checkedAt;warning=data.warning||null
        for(const event of data.events) {
          if(typeof event.artist!=='string'||!event.id||!safeTicketUrl(event.url,event))continue
          events.set(event.id,event);count++
        }
        hasMore=Boolean(data.hasMore)
        if(!hasMore)break
      } catch(e) {error=e.message;hasMore=true;break}
    }
    reports.push({source:typeof source==='object'?source.name:source,count,pages,error,skipped,warning,checkedAt:new Date().toISOString()})
    if(signal?.aborted)break
  }
  if(!sources.length&&!venues.length)throw Error('Enable a concert search source in Settings → Integrations.')
  const candidates = [...events.values()]
  const exact = candidates.filter(event => isSameWish(concert, event))
  return { events: exact.length ? exact : candidates, exact: exact.length === 1, checkedAt: checkedAt || new Date().toISOString(), limited: hasMore || reports.some(r=>r.error||r.warning), reports, status: candidates.length ? 'found' : reports.some(r=>r.error||r.warning) ? (reports.some(r=>r.pages>0)?'partial':'error') : reports.every(r=>r.skipped)?'skipped':'empty', message: reports.filter(r=>r.error).map(r=>r.source+': '+r.error).join(' · ') }
}
