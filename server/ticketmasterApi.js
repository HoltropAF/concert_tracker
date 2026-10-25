import {discoveryCountries,matchesDiscovery} from '../src/lib/discovery.js'
import {safeTicketUrl} from '../src/lib/wishlistUpdates.js'

export async function searchTicketmasterApi(query, key, fetcher=fetch) {
  const params=new URLSearchParams({apikey:key,keyword:query.artist||query.venue,size:'20',page:String(query.page-1),sort:'date,asc',startDateTime:`${query.today}T00:00:00Z`})
  if(query.country)params.set('countryCode',query.country)
  const response=await fetcher(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`,{signal:AbortSignal.timeout(12000)})
  if(!response.ok) {
    const error=Error('Ticketmaster API request failed.')
    error.sourceStatus=response.status
    error.publicMessage=[401,403].includes(response.status)?'Ticketmaster API key is invalid or not authorised. Check the server integration settings.':response.status===429?'Ticketmaster API rate limit reached. Try again later.':`Ticketmaster API returned HTTP ${response.status}.`
    throw error
  }
  const data=await response.json()
  if(!data.page || (data._embedded?.events && !Array.isArray(data._embedded.events)))throw Error('Ticketmaster API response format could not be read.')
  const checkedAt=new Date().toISOString()
  const events=(data._embedded?.events||[]).flatMap(raw=>{
    const venue=raw._embedded?.venues?.[0]||{},url=safeTicketUrl(raw.url)
    if(!raw.id||!raw.name||!url)return []
    const code=venue.country?.countryCode||''
    const status={onsale:'On sale — check seller for availability',offsale:'Off sale',cancelled:'Cancelled',postponed:'Postponed',rescheduled:'Rescheduled'}[raw.dates?.status?.code]||'Check ticket site'
    const range=raw.priceRanges?.[0]
    const event={startTime:raw.dates?.start?.localTime||'',ticketDescription:String(raw.info||raw.pleaseNote||'').slice(0,1200),priceRange:range?{min:range.min,max:range.max,currency:range.currency}:null,id:`ticketmaster:${raw.id}`,artist:raw.name,date:raw.dates?.start?.localDate||'',venue:venue.name||'',city:venue.city?.name||'',country:discoveryCountries[code]||venue.country?.name||code,countryCode:code,url,source:'Ticketmaster',status,saleStart:raw.sales?.public?.startTBD?null:raw.sales?.public?.startDateTime||null,checkedAt}
    return matchesDiscovery(event,query,query.today)?[event]:[]
  })
  return {events,total:Number(data.page.totalElements)||0}
}
