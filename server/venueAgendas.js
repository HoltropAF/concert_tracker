import {validDate} from '../src/lib/calendar.js'

const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const text=value=>value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()
const months='januari februari maart april mei juni juli augustus september oktober november december'.split(' ')

export function parseAfasAgenda(html) {
  const events=[]
  for(const match of html.matchAll(/<article\b[^>]*class="[^"]*agendaV2-item[^"]*"[^>]*>([\s\S]*?)<\/article>/g)){
    const card=match[1],artist=text(card.match(/<h4[^>]*>([\s\S]*?)<\/h4>/)?.[1]||'')
    const dateMatch=text(card.match(/<p class="date">([\s\S]*?)<\/p>/)?.[1]||'').match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
    const link=card.match(/href="(https:\/\/www\.afaslive\.nl\/agenda\/[^"#]+)"/)?.[1]
    if(!artist||!dateMatch||!link)continue
    const month=months.indexOf(dateMatch[2])+1,date=`${dateMatch[3]}-${String(month).padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}`
    if(!month||!validDate(date))continue
    const status=/st-canceled/.test(match[0])?'Cancelled':/uitverkocht/i.test(text(card))?'Sold out':'Check venue website for tickets'
    events.push({id:`venue:${link}:${date}`,artist,date,venue:'AFAS Live',city:'Amsterdam',country:'NL',url:link,source:'AFAS Live',status,venueWebsite:true})
  }
  if(!events.length)throw Error('AFAS agenda format could not be read.')
  return events
}

// A reader-specific cache shares the entire agenda, including in-flight requests.
// WeakMap isolates injected transports in tests. Failed reads are never cached.
const caches=new WeakMap()
export async function readSupportedAgenda(query,read){
  const host=new URL(query.website).hostname.replace(/^www\./,'')
  if(host!=='afaslive.nl')return null
  let cache=caches.get(read);if(!cache){cache=new Map();caches.set(read,cache)}
  let entry=cache.get(host),cached=!!entry&&entry.expires>Date.now()
  if(!cached){
    entry={expires:Date.now()+300000,promise:null}
    entry.promise=read('https://www.afaslive.nl/agenda').then(page=>({events:parseAfasAgenda(page.html),checkedAt:new Date().toISOString()})).catch(error=>{if(cache.get(host)===entry)cache.delete(host);throw error})
    cache.set(host,entry)
  }
  const agenda=await entry.promise,words=normalize(query.artist).split(' ').filter(Boolean)
  return {events:agenda.events.filter(event=>event.date>=query.today&&words.every(word=>normalize(event.artist).split(' ').includes(word))).map(event=>({...event,checkedAt:agenda.checkedAt})),checkedAt:agenda.checkedAt,hasMore:false,reader:'AFAS Live agenda',cached,notice:'Checked published AFAS Live agenda. Ticket availability requires the seller.',warning:null}
}
