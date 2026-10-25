import {validDate} from './calendar.js'
const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
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
    const parts=event.artist.split(/\s+(?:\||–|-)\s+(?=(?:VIP\b|VIP\d|Golden Circle\b|General Admission\b|GA\b|Premium\b|Venue Premium\b|Standard tickets\b))/i)
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
