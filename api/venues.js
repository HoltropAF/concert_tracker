import {searchVenues} from '../server/venueSearch.js'
const cache=new Map()
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Use GET.'})
  const query={}
  for(const field of ['name','city','country']){
    const value=req.query[field]||''
    if(typeof value!=='string'||value.length>160)return res.status(400).json({error:'Invalid venue filters.'})
    query[field]=value.trim()
  }
  if((!query.name&&!query.city)||(query.country&&!/^[A-Z]{2}$/.test(query.country)))return res.status(400).json({error:'Enter a venue name or city and a two-letter country code.'})
  if(!process.env.TICKETMASTER_API_KEY)return res.status(503).json({error:'Connect Ticketmaster in server settings to search venues.'})
  const key=JSON.stringify(query),hit=cache.get(key)
  if(hit?.expires>Date.now())return res.status(200).json(hit.data)
  try{
    const data=await searchVenues(query,process.env.TICKETMASTER_API_KEY)
    if(cache.size>=100)cache.delete(cache.keys().next().value)
    cache.set(key,{data,expires:Date.now()+300000})
    return res.status(200).json(data)
  }catch{return res.status(502).json({error:'Venue search is unavailable. Try again or enter the venue manually.'})}
}
