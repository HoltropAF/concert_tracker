import {searchUpcoming} from '../server/upcoming.js'
import {discoveryCountries} from '../src/lib/discovery.js'
import {validDate} from '../src/lib/calendar.js'

// Only explicit searches; there are no background jobs or notifications.
const cache=new Map()
export default async function handler(req,res) {
  if(req.method!=='GET')return res.status(405).json({error:'Use GET to search.'})
  const query={}
  for(const name of ['artist','venue','city','country','today','page']) {
    const value=req.query[name] ?? ''
    if(typeof value!=='string' || value.length>160)return res.status(400).json({error:'Invalid search filters.'})
    query[name]=value.trim()
  }
  query.page=Number(query.page || 1)
  if((!query.artist && !query.venue) || !validDate(query.today) || (query.country && !discoveryCountries[query.country]) || !Number.isInteger(query.page) || query.page<1 || query.page>5)return res.status(400).json({error:'Enter an artist or venue and valid filters.'})
  const key=JSON.stringify(query),hit=cache.get(key)
  if(hit && hit.expires>Date.now())return res.status(200).json(hit.data)
  try {
    const result=await searchUpcoming(query)
    const data={events:result.events,source:'Ticketmaster',checkedAt:new Date().toISOString(),hasMore:query.page<5 && result.total>query.page*20,page:query.page,notice:'Results from Ticketmaster Netherlands; coverage is not exhaustive. City and venue filters apply to each result page. Ticket availability may change.'}
    if(cache.size>=100)cache.delete(cache.keys().next().value)
    cache.set(key,{expires:Date.now()+300000,data})
    return res.status(200).json(data)
  }catch{return res.status(502).json({error:'Ticketmaster could not be searched. Try again later or use its website; this does not mean there are no shows.',source:'Ticketmaster'})}
}
