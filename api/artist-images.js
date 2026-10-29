import {searchArtistImages,tokenImage,downloadArtistImage} from '../server/artistImages.js'
const cache=new Map()
let searches=[]
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store')
  if(req.method!=='GET')return res.status(405).json({error:'Use GET.'})
  const key=process.env.SERPAPI_API_KEY
  if(!key)return res.status(503).json({error:'Online photos need setup: add SERPAPI_API_KEY to this project in Vercel, then redeploy.'})
  try {
    if(req.query.image){
      const image=await downloadArtistImage(tokenImage(req.query.image,key))
      res.setHeader('Content-Type',image.type);res.setHeader('X-Content-Type-Options','nosniff')
      return res.status(200).send(image.body)
    }
    const query=req.query.q
    if(typeof query!=='string'||!query.trim()||query.length>160)return res.status(400).json({error:'Enter an artist name (up to 160 characters).'})
    const normalized=query.trim(),hit=cache.get(normalized.toLowerCase())
    if(hit?.expires>Date.now())return res.status(200).json({images:await hit.promise})
    searches=searches.filter(time=>time>Date.now()-60000)
    if(searches.length>=10)return res.status(429).json({error:'Please wait a minute before searching again.'})
    searches.push(Date.now())
    if(cache.size>=100)cache.delete(cache.keys().next().value)
    const entry={expires:Date.now()+1800000,promise:searchArtistImages(normalized,key)}
    cache.set(normalized.toLowerCase(),entry)
    try{return res.status(200).json({images:await entry.promise})}
    catch(error){cache.delete(normalized.toLowerCase());throw error}
  }catch(error){return res.status(502).json({error:error.message||'Could not load photos.'})}
}
