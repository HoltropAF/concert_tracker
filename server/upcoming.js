import {discoveryCountries,matchesDiscovery} from '../src/lib/discovery.js'

const site='https://www.ticketmaster.nl'
export function parseUpcomingPage(html, query, today, checkedAt) {
  const script=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  if(!script) throw Error('The source could not be read. Please try again later.')
  const queries=JSON.parse(script[1])?.props?.pageProps?.initialReduxState?.api?.queries
  if(!queries || typeof queries!=='object') throw Error('The source format has changed. Please try again later.')
  let found=false,total=0
  const events=new Map()
  for(const entry of Object.values(queries)) {
    if(!['searchEvents','categoryEvents'].includes(entry?.endpointName) || !Array.isArray(entry?.data?.events))continue
    found=true;total=Math.max(total,Number(entry.data.total)||0)
    for(const raw of entry.data.events) {
      if(!raw?.id || typeof raw.title!=='string' || typeof raw.url!=='string' || !raw.url)continue
      const start=raw.dates?.startDate
      let date=''
      if(start && !Number.isNaN(Date.parse(start))) {
        try { date=new Intl.DateTimeFormat('en-CA',{timeZone:raw.timeZone || 'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start)) } catch { continue }
      }
      let url
      try {url=new URL(raw.url,site);if(url.protocol!=='https:' || !/(^|\.)ticketmaster\.(nl|be|de|fr|com|co\.uk)$/i.test(url.hostname))continue} catch {continue}
      const countryCode=String(raw.venue?.countryCode || '').toUpperCase()
      const event={id:`ticketmaster:${raw.id}`,artist:raw.title,date,venue:typeof raw.venue?.name==='string'?raw.venue.name:'',city:typeof raw.venue?.city==='string'?raw.venue.city:'',countryCode,country:discoveryCountries[countryCode] || countryCode,source:'Ticketmaster',url:url.href,status:raw.cancelled?'Cancelled':raw.postponed?'Postponed':raw.rescheduled?'Rescheduled':raw.soldOut?'Sold out':'Check ticket site',saleStart:typeof raw.dates?.onsaleDate==='string'?raw.dates.onsaleDate:null,checkedAt}
      if(matchesDiscovery(event,query,today))events.set(event.id,event)
    }
  }
  if(!found)throw Error('The source did not return a readable search result. Please try again later.')
  return {events:[...events.values()].sort((a,b)=>a.date.localeCompare(b.date)),total}
}

export async function searchUpcoming(query, fetcher=fetch, now=new Date()) {
  const params=new URLSearchParams({q:query.artist || query.venue,page:String(query.page-1)})
  const response=await fetcher(`${site}/search?${params}`,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000)})
  if(!response.ok) { const error=Error(`Ticketmaster returned HTTP ${response.status}.`);error.sourceStatus=response.status;throw error }
  const reader=response.body.getReader(),decoder=new TextDecoder()
  let html='',bytes=0
  try {
    while(true) { const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>5*1024*1024)throw Error('The source response is too large.');html+=decoder.decode(value,{stream:true}) }
    html+=decoder.decode()
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock() }
  return parseUpcomingPage(html,query,query.today,now.toISOString())
}
