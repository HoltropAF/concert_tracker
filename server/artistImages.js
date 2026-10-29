import {createHmac,timingSafeEqual} from 'node:crypto'
import https from 'node:https'
import {lookup} from 'node:dns/promises'
import {publicIPv4,venueUrl} from './venueWebsites.js'

export function imageToken(url,key,expires=Date.now()+3600000) {
  const payload=Buffer.from(JSON.stringify({url,expires})).toString('base64url')
  return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url')
}
export function tokenImage(token,key) {
  if(typeof token!=='string'||token.length>12000)throw Error('Invalid image selection.')
  const [payload,signature]=token.split('.')
  const expected=createHmac('sha256',key).update(payload||'').digest('base64url')
  if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error('Invalid image selection.')
  const data=JSON.parse(Buffer.from(payload,'base64url').toString())
  if(!Number.isFinite(data.expires)||data.expires<Date.now())throw Error('Image selection expired. Search again.')
  return venueUrl(data.url).href
}
export async function searchArtistImages(query,key,fetcher=fetch) {
  const params=new URLSearchParams({engine:'google_images',q:query,api_key:key,safe:'active'})
  const response=await fetcher('https://serpapi.com/search.json?'+params,{signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw Error(response.status===429?'Image search allowance reached. Try again later.':'Image search unavailable. Check the SerpApi key in Vercel settings.')
  const data=await response.json()
  if(data.error)throw Error('Image search unavailable. Check the API key and free search allowance.')
  return (data.images_results||[]).slice(0,30).flatMap(item=>{
    try {
      const original=venueUrl(item.original).href,thumbnail=venueUrl(item.thumbnail).href,source=venueUrl(item.link).href
      return [{title:String(item.title||'Artist photo').slice(0,240),thumbnail,source,token:imageToken(original,key)}]
    } catch {return []}
  })
}
// Only signed search results can be imported. Validate and pin DNS again on redirects.
export async function downloadArtistImage(value,redirects=0,deadline=Date.now()+12000) {
  const url=venueUrl(value)
  if(Date.now()>=deadline)throw Error('Photo download timed out.')
  const addresses=await Promise.race([lookup(url.hostname,{all:true,family:4}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Photo lookup timed out.')),3000);t.unref?.()})])
  if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('Photo address is not public.')
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{Accept:'image/jpeg,image/png,image/webp','User-Agent':'SetTracker/1.0'},lookup:(_host,opts,cb)=>opts?.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4)},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){
        res.resume()
        if(redirects>=3||!res.headers.location)return reject(Error('Photo redirect failed.'))
        try{resolve(downloadArtistImage(venueUrl(res.headers.location,url).href,redirects+1,deadline))}catch(e){reject(e)}
        return
      }
      const type=(res.headers['content-type']||'').split(';')[0].trim()
      if(res.statusCode!==200||!['image/jpeg','image/png','image/webp'].includes(type)){res.resume();return reject(Error('This website blocks importing or uses an unsupported image. Choose another photo.'))}
      const chunks=[];let size=0
      res.on('data',chunk=>{size+=chunk.length;if(size>4000000)req.destroy(Error('Photo is too large. Choose another.'));else chunks.push(chunk)})
      res.on('error',reject);res.on('end',()=>resolve({body:Buffer.concat(chunks),type}))
    })
    const timer=setTimeout(()=>req.destroy(Error('Photo download timed out.')),Math.max(1,deadline-Date.now()))
    req.on('close',()=>clearTimeout(timer));req.on('error',reject)
  })
}
