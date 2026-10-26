import https from 'node:https'
import {lookup} from 'node:dns/promises'
import {isIP} from 'node:net'
import {validDate} from '../src/lib/calendar.js'
import {readSupportedAgenda} from './venueAgendas.js'

export function publicIPv4(ip) {
  if(isIP(ip)!==4)return false
  const [a,b]=ip.split('.').map(Number)
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===2||a===198&&b===51||a===203&&b===0)
}
export function venueUrl(value,base) {
  const u=new URL(value,base)
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||isIP(u.hostname)||!u.hostname.includes('.')||/\.(local|localhost|internal)$/i.test(u.hostname))throw Error('Use a public HTTPS venue website.')
  u.hash=''
  return u
}
// Pin the validated public address on every request, including redirects.
async function readVenuePageUncached(value, redirects=0, deadline=Date.now()+3000) {
  const url=venueUrl(value)
  const addresses=await Promise.race([lookup(url.hostname,{all:true,family:4}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Venue DNS lookup timed out.')),3000);timer.unref?.()})])
  if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('Venue website address is not public.')
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{Accept:'text/html','User-Agent':'SetTracker/1.0 (user-requested concert lookup)'},lookup:(_host,opts,cb)=>opts?.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4)},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){
        res.resume()
        if(redirects>=3||!res.headers.location)return reject(Error('Venue redirect could not be followed.'))
        try {resolve(readVenuePageUncached(venueUrl(res.headers.location,url).href,redirects+1,deadline))}catch(e){reject(e)}
        return
      }
      if(res.statusCode!==200){res.resume();reject(Error(`Venue returned HTTP ${res.statusCode}.`));return}
      if(!/text\/html/i.test(res.headers['content-type']||'')){res.resume();reject(Error('Venue did not return a readable page.'));return}
      const chunks=[];let size=0
      res.on('data',chunk=>{size+=chunk.length;if(size>2000000)req.destroy(Error('Venue page is too large.'));else chunks.push(chunk)})
      res.on('error',reject)
      res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),url:url.href}))
    })
    const timer=setTimeout(()=>req.destroy(Error('Venue timed out.')),Math.max(1,deadline-Date.now()))
    req.on('close',()=>clearTimeout(timer));req.on('error',reject)
  })
}
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
export function parseVenueEvents(html,page,query) {
  const events=[];let readable=false
  const visit=node=>{
    if(!node||typeof node!=='object')return
    if([].concat(node['@type']||[]).some(t=>/^(MusicEvent|Event|Festival)$/.test(t))){
      readable=true
      const artist=String(node.name||''),date=String(node.startDate||'').slice(0,10)
      if(normalize(query.artist).split(' ').filter(Boolean).every(w=>normalize(artist).split(' ').includes(w))&&validDate(date)&&date>=query.today){
        const loc=node.location||{},addr=loc.address||{}
        let url;try{url=venueUrl(node.url||page,page);if(url.origin!==new URL(page).origin)return}catch{return}
        events.push({id:`venue:${url.href}:${date}`,artist,date,venue:loc.name||query.venueName||'',city:addr.addressLocality||'',country:typeof addr.addressCountry==='string'?addr.addressCountry:addr.addressCountry?.name||'',url:url.href,source:query.venueName||url.hostname,status:'Check venue website for tickets',checkedAt:new Date().toISOString(),venueWebsite:true})
      }
    }
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}
  }
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(match[1]))}catch{/* Other scripts may still contain valid events. */}}
  return {events,readable}
}
export async function searchVenueWebsite(query,read=readVenuePage) {
  venueUrl(query.website)
  const agenda=await readSupportedAgenda(query,read)
  if(agenda)return agenda
  const deadline=Date.now()+9000
  const first=await read(query.website),queue=[first],seen=new Set([first.url]),events=new Map()
  let pages=0,readable=false,failed=false,limited=false
  while(queue.length&&pages<3){
    const page=queue.shift();pages++
    const parsed=parseVenueEvents(page.html,page.url,query);readable ||= parsed.readable
    parsed.events.forEach(e=>events.set(e.id,e))
    const links=[]
    for(const match of page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
      try{
        const url=venueUrl(match[1].replace(/&amp;/g,'&'),page.url)
        if(url.origin!==new URL(first.url).origin||seen.has(url.href)||/\.(pdf|jpg|png|zip)$/i.test(url.pathname))continue
        const text=normalize(match[2].replace(/<[^>]+>/g,'')+' '+url.pathname)
        const artist=normalize(query.artist).split(' ').filter(Boolean).every(w=>text.split(' ').includes(w))
        if(artist||/\b(agenda|calendar|programma|events|concerts)\b/.test(text))links.push({url:url.href,artist})
      }catch{/* Ignore non-web links. */}
    }
    for(const link of links.sort((a,b)=>Number(b.artist)-Number(a.artist))){
      if(seen.has(link.url))continue
      if(pages+queue.length>=3||Date.now()>deadline-3000){limited=true;break}
      seen.add(link.url)
      try{queue.push(await read(link.url))}catch{failed=true}
    }
  }
  return {events:[...events.values()],hasMore:false,notice:`Checked ${pages} pages; venue coverage may be incomplete.`,warning:failed?'Some venue pages could not be read.':!readable?'No readable event data found; check the venue website manually.':limited?'Venue page limit reached; other listings may exist.':'Venue check covers linked pages only; other listings may exist.'}
}

// Share public pages across different wishes; never cache failures.
const pageCache=new Map()
export async function readVenuePage(value){
  const key=venueUrl(value).href,hit=pageCache.get(key)
  if(hit&&hit.expires>Date.now())return hit.promise
  if(pageCache.size>=30)pageCache.delete(pageCache.keys().next().value)
  const entry={expires:Date.now()+300000,promise:null}
  entry.promise=readVenuePageUncached(key).catch(error=>{if(pageCache.get(key)===entry)pageCache.delete(key);throw error})
  pageCache.set(key,entry)
  return entry.promise
}
