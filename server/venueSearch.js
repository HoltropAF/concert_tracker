export async function searchVenues({name='',city='',country=''},key,fetcher=fetch){
  const params=new URLSearchParams({apikey:key,keyword:name||city,size:'100',locale:'*'})
  if(country)params.set('countryCode',country)
  const response=await fetcher(`https://app.ticketmaster.com/discovery/v2/venues.json?${params}`,{signal:AbortSignal.timeout(12000)})
  if(!response.ok)throw Error('Venue search is unavailable. Try again later.')
  const data=await response.json()
  if(!data.page||data._embedded?.venues&&!Array.isArray(data._embedded.venues))throw Error('Venue search response could not be read.')
  const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  return {venues:(data._embedded?.venues||[]).filter(v=>v.name&&(!city||normalize(v.city?.name)===normalize(city))).map(v=>({id:v.id,name:v.name,city:v.city?.name||'',country:v.country?.name||'',countryCode:v.country?.countryCode||''})),notice:'Ticketmaster venue directory; coverage is limited. Refine the venue name if no match appears.'}
}
