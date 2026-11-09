import {timeValue,showTimeFields,supportActName} from '../src/lib/showTimes.js'
const host='https://www.ziggodome.nl'
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
const matches=(event,q)=>String(event?.showDate||'').slice(0,10)===q.date && norm(event?.performerName)===norm(q.artist)
export function ziggoEventId(value){try{const u=new URL(value);return u.protocol==='https:'&&['www.ziggodome.nl','ziggodome.nl'].includes(u.hostname)?u.pathname.match(/^\/(?:en\/)?events\/([a-f0-9-]{36})\/?$/i)?.[1]||'':''}catch{return ''}}
export function parseZiggoSchedule(payload,q){
 const event=payload.data?.find(e=>matches(e,q));if(!event)return null
 const times={},supportActs=[],conflicts=new Set()
 const source=`${host}/events/${event.id}/`
 for(const row of (payload.program||[]).flatMap(p=>p.program||[])){
   const label=String(row.title_en||row.title||'').trim(),value=timeValue(row.time)
   const support=supportActName(label,true)
   if(support){supportActs.push({name:support,time:value,source});continue}
   const name=norm(label)
   const key=/^(doors open|deuren open|zaal open)$/.test(name)?'doorsTime':/^(expected end(?:ing)?|verwachte eindtijd|eindtijd)$/.test(name)?'endTime':/^(vip (?:starts?|check in|inloop|entry|doors open))$/.test(name)?'vipTime':name===norm(event.performerName)||/^(show starts?|aanvang show)$/.test(name)?'showTime':null
   if(!key||!value||conflicts.has(key))continue
   if(times[key]&&times[key].value!==value){delete times[key];conflicts.add(key);continue}
   times[key]={value,label:showTimeFields[key],source,confirmed:true}
 }
 if(!supportActs.length){const name=String(event.supportActDescription||'').match(/^\s*<p>\s*<strong>([^<>]{1,100})<\/strong>\s*<\/p>/i)?.[1]?.trim();if(name)supportActs.push({name,source})}
 return {times,supportActs,source}
}
export async function readZiggoSchedule(q,fetcher=fetch){
 const read=async path=>{const r=await fetcher(host+path,{signal:AbortSignal.timeout(6000),redirect:'error'});if(!r.ok)throw Error('Ziggo Dome unavailable');const body=await r.text();if(body.length>2000000)throw Error('Ziggo Dome response too large');return JSON.parse(body)}
 let id=ziggoEventId(q.url)
 if(!id){const search=await read(`/api/search/${encodeURIComponent(q.artist)}/`);const exact=(search.resultsEvents||[]).filter(e=>matches(e,q));if(exact.length!==1)return null;id=exact[0].id}
 if(!/^[a-f0-9-]{36}$/i.test(id))return null
 return parseZiggoSchedule(await read(`/api/agenda/events/${id}/`),q)
}
