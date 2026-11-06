import {searchTicketmasterApi} from './ticketmasterApi.js'
import {searchMojo} from './mojo.js'
import {readVenuePage,searchVenueWebsite} from './venueWebsites.js'
import {discoveryCountry} from '../src/lib/discovery.js'
import {parseShowTimes,timeValue} from '../src/lib/showTimes.js'
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
export function exactShow(event,q){return event.date===q.date && norm(q.artist).split(' ').filter(Boolean).every(w=>norm(event.artist).split(' ').includes(w)) && (!q.venue||norm(event.venue)===norm(q.venue))}
export async function lookupShowTimes(q,{key=process.env.TICKETMASTER_API_KEY,tm=searchTicketmasterApi,mojo=searchMojo,venue=searchVenueWebsite,read=readVenuePage}={}){
 const query={artist:q.artist,venue:q.venue||'',city:'',country:discoveryCountry(q.country),today:q.date,page:1}
 const website=q.website || ({'ziggo dome':'https://www.ziggodome.nl/agenda/','afas live':'https://www.afaslive.nl/agenda'}[norm(q.venue)] || '')
 const sources=[],events=[],times={},conflicts=new Set()
 const add=(field,candidate,source)=>{if(!candidate?.value||conflicts.has(field))return;if(times[field]&&times[field].value!==candidate.value){delete times[field];conflicts.add(field);return}times[field]={...candidate,source}}
 const searches=[['Ticketmaster',key?()=>tm(query,key):()=>Promise.reject(Error('API key unavailable'))],['MOJO',()=>mojo(query)]]
 if(website)searches.push(['Venue',()=>venue({website,artist:q.artist,today:q.date,venueName:q.venue||''})])
 const results=await Promise.allSettled(searches.map(([,run])=>run()))
 results.forEach((result,i)=>{const name=searches[i][0];if(result.status==='rejected'){sources.push({name,status:'Unavailable'});return}const found=result.value.events.filter(e=>exactShow(e,q));sources.push({name,...(name==='Venue'?{url:website}:{}),status:found.length===1?'Event matched':found.length?'Multiple matches; check manually':'No matching readable event'});if(found.length===1){events.push(found[0]);if(name==='Ticketmaster'&&timeValue(found[0].startTime))add('showTime',{value:timeValue(found[0].startTime),label:'Ticketmaster listed event start — confirm show time'},found[0].url)}})
 const pages=[...new Set([q.url,...events.map(e=>e.url)].filter(Boolean))].slice(0,4)
 const reads=await Promise.allSettled(pages.map(async url=>{const page=await read(url);return {...parseShowTimes(page.html,q),source:page.url}}))
 reads.forEach((r,i)=>{sources.push({name:new URL(pages[i]).hostname,url:pages[i],status:r.status==='fulfilled'?Object.keys(r.value.times).length?'Times found':'No readable times':'Page unavailable'});if(r.status==='fulfilled')Object.entries(r.value.times).forEach(([field,value])=>add(field,value,r.value.source))})
 return {times,sources,source:pages[0]||'',notice:conflicts.size?'Sources disagree on some times; those were left for manual checking.':Object.keys(times).length?'Review and accept the detected times. Event start is not necessarily doors or show start.':'No confirmed times found. Use the source links or enter times manually.'}
}
