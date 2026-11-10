import {validDate} from './calendar.js'
const norm=s=>String(s||'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const packageSuffix = /\s+(?:\||–|-)+\s+(?=(?:VIP\b|VIP\d|Golden Circle\b|General Admission\b|GA\b|Premium\b|Venue Premium\b|Standard tickets\b|[^|]{0,70}\b(?:First Entry Package|Meet & Greet Package)\b))/i
export function sellerLink(value){
  try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}
}
export function ticketSaleOpen(concert,now=Date.now()){
  const status=concert.discovery?.status||''
  if(/off sale|cancelled|postponed|rescheduled|sold out/i.test(status))return false
  return /\bon sale\b/i.test(status)||new Date(concert.ticketSaleAt||'').getTime()<=now
}
export function groupTicketEvents(events){
  const groups=new Map()
  for(const event of events){
    // Only strip explicit ticket-package suffixes, never arbitrary tour titles.
    const parts=event.artist.split(packageSuffix)
    const artist=parts[0], label=parts.slice(1).join(' · ')||'Event listing'
    const key=event.date&&event.venue ? [norm(artist),event.date,norm(event.venue),norm(event.city),event.startTime||''].join('|') : event.id
    const option={id:event.id,label,url:event.url,status:event.status,description:event.ticketDescription||'',...(event.priceRange?{priceRange:event.priceRange}:{})}
    if(!groups.has(key))groups.set(key,{...event,artist,ticketOptions:[],listingIds:[]})
    const group=groups.get(key)
    group.listingIds.push(event.id)
    if(!group.ticketOptions.some(o=>o.url===option.url))group.ticketOptions.push(option)
    if(parts.length===1){Object.assign(group,{...event,artist,ticketOptions:group.ticketOptions,listingIds:group.listingIds})}
  }
  return [...groups.values()]
}

export function groupDiscoveryListings(events, searchArtist = '') {
  const identity = value => norm(value) || String(value || '').trim().toLowerCase()
  const matches = (a,b) => !a || !b || identity(a) === identity(b)
  const listings = events.filter(event => !/^(?:parking (?:permit|pass)|parking:|parkeren|parkeerkaart)(?:\s|:|$)/i.test(event.artist))
    .map(event => {
      const [title, option] = event.artist.split(packageSuffix)
      const namedArtist = event.performer || searchArtist.trim()
      const suffix = namedArtist && title.slice(namedArtist.length)
      const isNamedTitle = namedArtist && identity(title.slice(0,namedArtist.length)) === identity(namedArtist)
        && (!suffix || /^\s*[:|–—-]\s*/.test(suffix))
      const artist = isNamedTitle ? namedArtist : title
      const tour = isNamedTitle && suffix ? suffix.replace(/^\s*[:|–—-]\s*/,'').trim() : event.tour
      return { ...event, artist, tour, option }
    })
  const related = (a,b) => a.date === b.date && identity(a.artist) === identity(b.artist)
    && matches(a.city,b.city) && matches(a.country,b.country)
  const primary = listings.filter(event => !event.option)
  const enriched = listings.map(event => {
    const others = primary.filter(candidate => candidate !== event && related(event,candidate)
      && matches(event.venue,candidate.venue) && matches(event.startTime,candidate.startTime))
    const unique = key => {
      const values = new Map(others.filter(other => other[key]).map(other => [identity(other[key]),other[key]]))
      return values.size === 1 ? values.values().next().value : ''
    }
    const venue = event.venue || unique('venue')
    return { ...event, venue, city:event.city || unique('city'), country:event.country || unique('country'),
      countryCode:event.countryCode || unique('countryCode'), startTime:event.startTime || unique('startTime'),
      timeZone:event.timeZone || unique('timeZone'), tour:event.tour || unique('tour') }
  })
  const prepared = enriched.map(event => {
    if (!event.option) return event
    const shows = enriched.filter(show => !show.option && related(event,show) && show.venue &&
      (!event.venue || identity(event.venue) === identity(show.venue) || identity(event.venue) === identity(show.venue + ' Loge')))
    const slots = new Map(shows.map(show => [identity(show.venue) + '|' + (show.startTime || ''),show]))
    const show = slots.size === 1 ? slots.values().next().value : null
    return { ...event, artist:event.artist + ' | ' + event.option,
      ...(show ? {venue:show.venue,city:show.city,country:show.country,startTime:show.startTime} : {}) }
  }).sort((a,b) => Number(a.source === 'Ticketmaster') - Number(b.source === 'Ticketmaster'))
  const byId = new Map(prepared.map(event => [event.id,event]))
  return groupTicketEvents(prepared).map(group => {
    const sources = group.listingIds.map(id => byId.get(id))
    const sourceLinks = [...new Map(sources.filter(item => !item.option).map(item => [item.url,{url:item.url,source:item.source}])).values()]
    const ticketOptions = group.ticketOptions.filter(option => byId.get(option.id)?.source !== 'MOJO' || group.source === 'MOJO')
    return { ...group, sourceLinks, ticketOptions }
  }).sort((a,b) => a.date.localeCompare(b.date))
}
export function mergeTicketOptions(saved=[],found=[]){
  const options=new Map(saved.map(o=>[o.url||o.id,o]))
  for(const option of found){const url=sellerLink(option.url);if(!url)continue;const old=options.get(url);options.set(url,{...old,...option,label:old?.label||option.label,url})}
  return [...options.values()]
}
export function wishStepStates(concert,events,changesFor){
  const known=[!!concert.artist?.trim(),!!concert.venue?.trim(),validDate(concert.date),!!sellerLink(concert.ticketSaleLink)||Number.isFinite(new Date(concert.ticketSaleAt||'').getTime())]
  const keys=[['artist'],['venue','city','country'],['date'],['ticketSaleAt','ticketSaleLink','ticketOptions']]
  return known.map((saved,i)=>events.some(e=>changesFor(concert,e).some(c=>keys[i].includes(c.key)))?'pending':saved?'saved':'missing')
}
