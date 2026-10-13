import {validDate} from './calendar.js'

export const discoveryCountries = {NL:'Netherlands',BE:'Belgium',DE:'Germany',FR:'France',GB:'United Kingdom'}
export function discoveryCountry(value) {
  return Object.keys(discoveryCountries).find(code=>code===value || discoveryCountries[code].toLowerCase()===String(value).toLowerCase()) || ''
}
const normalized = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export function matchesDiscovery(event, query, today) {
  if(!validDate(event.date) || event.date < today) return false
  if(query.country && event.countryCode !== query.country) return false
  return ['city','venue'].every(key=>!query[key] || normalized(event[key]).includes(normalized(query[key])))
}
export function discoveryDuplicate(event, concerts) {
  return concerts.some(c => c.discovery?.id === event.id || (c.date===event.date && normalized(c.artist)===normalized(event.artist) && (!c.venue || normalized(c.venue)===normalized(event.venue))))
}
export function wishlistDraft(event, type='concert') {
  let ticketSaleAt = ''
  if(event.saleStart) {
    const date=new Date(event.saleStart)
    if(!Number.isNaN(date.getTime())) {
      const pad=n=>String(n).padStart(2,'0')
      ticketSaleAt=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }
  return {artist:event.artist,date:event.date,venue:event.venue,city:event.city,country:event.country,type,wishlist:true,attendanceMode:'in_person',ticketSaleAt,ticketSaleLink:event.url,discovery:{id:event.id,source:event.source,url:event.url,status:event.status,checkedAt:event.checkedAt,saleStart:event.saleStart || null}}
}
export function discoveryInvite(event) {
  return `Want to go to ${event.artist}?\n${event.date} · ${[event.venue,event.city].filter(Boolean).join(', ')}\n${event.url}`
}
