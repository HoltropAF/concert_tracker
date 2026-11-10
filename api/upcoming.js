import {searchTicketmasterApi} from '../server/ticketmasterApi.js'
import {searchMojo} from '../server/mojo.js'
import {searchUpcoming} from '../server/upcoming.js'
import {discoveryCountries} from '../src/lib/discovery.js'
import {validDate} from '../src/lib/calendar.js'

// Only explicit searches; there are no background jobs or notifications.
const cache=new Map()
export default async function handler(req,res) {
  if(req.method!=='GET')return res.status(405).json({error:'Use GET to search.'})
  const source=req.query.source || 'ticketmaster'
  if(!['ticketmaster','mojo','combined'].includes(source))return res.status(400).json({error:'Unknown source.'})
  const query={}
  for(const name of ['artist','venue','city','country','today','page']) {
    const value=req.query[name] ?? ''
    if(typeof value!=='string' || value.length>160)return res.status(400).json({error:'Invalid search filters.'})
    query[name]=value.trim()
  }
  query.page=Number(query.page || 1)
  if((!query.artist && !query.venue) || !validDate(query.today) || (query.country && !discoveryCountries[query.country]) || !Number.isInteger(query.page) || query.page<1 || query.page>5)return res.status(400).json({error:'Enter an artist or venue and valid filters.'})
  if(source==='mojo' && query.country && query.country!=='NL')return res.status(200).json({events:[],skipped:'MOJO covers Netherlands only.',hasMore:false,source:'MOJO',checkedAt:new Date().toISOString()})
  const key=JSON.stringify({source,...query}),hit=cache.get(key)
  if(hit && hit.expires>Date.now())return res.status(200).json(hit.data)
  try {
    const ticketmaster=()=>process.env.TICKETMASTER_API_KEY?searchTicketmasterApi(query,process.env.TICKETMASTER_API_KEY):searchUpcoming(query)
    if(source==='combined'){
      const providers=[['Ticketmaster',ticketmaster],...(!query.country||query.country==='NL'?[['MOJO',()=>searchMojo(query)]]:[])]
      const results=await Promise.allSettled(providers.map(([,run])=>run()))
      const available=providers.filter((_,i)=>results[i].status==='fulfilled').map(([name])=>name)
      if(!available.length)throw results[0].reason
      const events=results.flatMap(result=>result.status==='fulfilled'?result.value.events:[])
      const hasMore=results.some((result,i)=>result.status==='fulfilled'&&(i===0?query.page<5&&result.value.total>query.page*20:query.page<3&&result.value.events.length>=10))
      const unavailable=providers.filter((_,i)=>results[i].status==='rejected').map(([name])=>name)
      const notice=[`Results from ${available.join(' and ')}. Check ticket availability with the seller.`,unavailable.length?`${unavailable.join(' and ')} unavailable.`:''].filter(Boolean).join(' ')
      const data={events,source:available.join(' and '),checkedAt:new Date().toISOString(),hasMore,page:query.page,notice}
      if(cache.size>=100)cache.delete(cache.keys().next().value)
      cache.set(key,{expires:Date.now()+300000,data})
      return res.status(200).json(data)
    }
    const result=await (source==='mojo'?searchMojo(query):ticketmaster())
    const data={events:result.events,source:source==='mojo'?'MOJO':'Ticketmaster',checkedAt:new Date().toISOString(),hasMore:source==='mojo'?query.page<3 && result.events.length>=10:query.page<5 && result.total>query.page*20,page:query.page,notice:`Results from ${source==='mojo'?'MOJO':'Ticketmaster Netherlands'}; coverage is not exhaustive. Availability must be checked with the seller.`}
    if(cache.size>=100)cache.delete(cache.keys().next().value)
    cache.set(key,{expires:Date.now()+300000,data})
    return res.status(200).json(data)
  }catch(error){
    const label=source==='mojo'?'MOJO':'Ticketmaster'
    const status=Number(error.sourceStatus)
    const reason=error.publicMessage || (status===403?'The source refused the server request.':status===429?'The source is rate-limiting requests.':status>=400?`The source returned HTTP ${status}.`:error.name==='TimeoutError'?'The source timed out.':/format|readable|read|JSON/i.test(error.message)?'The source page could not be read.':'The source could not be reached.')
    console.warn('Concert search failure',{source,reason,name:error.name})
    return res.status(502).json({error:reason,source:label})
  }
}
