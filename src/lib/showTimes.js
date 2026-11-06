export const showTimeFields={doorsTime:'Doors open',vipTime:'VIP starts',showTime:'Show starts',endTime:'Expected end'}
export function timeValue(value){const m=String(value||'').match(/(?:T|^)([01]\d|2[0-3]):([0-5]\d)/);return m?`${m[1]}:${m[2]}`:''}
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
export function parseShowTimes(html,{artist,date}){
 const candidates=[]
 const visit=node=>{if(!node||typeof node!=='object')return;if([].concat(node['@type']||[]).some(t=>/^(MusicEvent|Event|Festival)$/.test(t))&&String(node.startDate||'').slice(0,10)===date&&norm(artist).split(' ').filter(Boolean).every(w=>norm(node.name).split(' ').includes(w)))candidates.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}}
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]))}catch{}}
 if(candidates.length!==1)return {times:{},notice:'No single matching event could be confirmed. Check the source or enter times manually.'}
 const event=candidates[0],times={}
 if(timeValue(event.doorTime))times.doorsTime={value:timeValue(event.doorTime),label:'Doors open'}
 if(timeValue(event.startDate))times.showTime={value:timeValue(event.startDate),label:'Listed event start — confirm this is show time'}
 if(timeValue(event.endDate))times.endTime={value:timeValue(event.endDate),label:'Listed end — may be an estimate'}
 // Only use labelled page times on a page with exactly one event, so an agenda
 // cannot contribute another show's doors or VIP times.
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ')
 const allEvents=(html.match(/"@type"\s*:\s*"(?:MusicEvent|Event|Festival)"/g)||[]).length
 if(allEvents===1){for(const [key,pattern] of Object.entries({doorsTime:/(?:doors(?:\s+open)?|deuren(?:\s+open)?|zaal\s+open)\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig,vipTime:/(?:VIP\s*(?:check[ -]?in|starts?|start|entry|inloop|doors))\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig,showTime:/(?:show\s*(?:starts?|start)|aanvang(?:\s+show)?)\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig,endTime:/(?:expected\s+end|verwacht(?:e)?\s+eind(?:e|tijd)?|eindtijd)\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig})){const found=[...text.matchAll(pattern)].map(m=>timeValue(m[1].replace('.',':'))).filter(Boolean);if(new Set(found).size===1)times[key]={value:found[0],label:showTimeFields[key]}}}
 return {times,notice:Object.keys(times).length?'Review the source and accept each time. Times are local to the venue.':'The event matched, but no readable times were found. Check the source manually.'}
}
