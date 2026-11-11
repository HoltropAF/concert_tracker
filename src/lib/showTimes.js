export const showTimeFields={doorsTime:'Doors open',vipTime:'VIP starts',showTime:'Show starts',endTime:'Expected end'}
export const visibleShowTimeFields=(concert,settings={})=>Object.entries(showTimeFields).filter(([key])=>key!=='vipTime'||(concert.showVipTime??settings.showVipTime??true))
export function needsShowTimes(concert, settings = {}) {
 return visibleShowTimeFields(concert, settings).some(([key]) => !concert[key] && !concert.scheduleSources?.[key]?.manual)
   || (concert.support || []).some(act => act?.role !== 'guest' && (typeof act === 'string' ? act : act?.name) && !act?.time && !act?.timeManuallySet)
}
export function timetableRows(concert,settings,ordered = true) {
 const acts = (concert.support || []).flatMap((act,index) => {
   const name = typeof act === 'string' ? act : act?.name
   return name && act?.role !== 'guest' ? [{key:'support-'+index,label:name,time:act.time,supportIndex:index}] : []
 })
 const rows = visibleShowTimeFields(concert,settings).flatMap(([key,label]) => [
   ...(key === 'showTime' ? acts : []), {key,label,time:concert[key]},
 ])
 if (!ordered) return rows
 const start = concert.showTime || concert.doorsTime
 const order = row => row.key === 'endTime' && start && row.time < start ? '24:' + row.time : row.time
 const timed = rows.filter(row => /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time || '')).sort((a,b)=>order(a).localeCompare(order(b)))
 let index = 0
 return rows.map(row => /^([01]\d|2[0-3]):[0-5]\d$/.test(row.time || '') ? timed[index++] : row)
}
export const pendingShowTime = (concert, key, found) => found?.value && !concert[key] && !concert.scheduleSources?.[key]?.manual ? found : null
export function timeValue(value){const m=String(value||'').match(/(?:T|^)([01]\d|2[0-3]):([0-5]\d)/);return m?`${m[1]}:${m[2]}`:''}
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()

export function supportActName(label, allowSpace = false) {
 const match = label.trim().match(/^(?:support act|opening act|opener|voorprogramma|special guest)(?:\s*[:|–—-]\s*|(\s+))(.{1,100})$/i)
 if (!match || (match[1] && !allowSpace)) return ''
 const name = match[2].replace(/&amp;/gi,'&').replace(/&(?:nbsp|#160);/gi,' ').replace(/&#(?:39|x27);|&apos;/gi,"'").trim()
 return /^(?:tba|tbc|tbd|to be announced|nog niet bekend|nader bekend te maken)$/i.test(name) ? '' : name
}

export function supportNameKey(name) {
 return String(name || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
}

export function pendingSupportActs(saved, found) {
 const covered = new Set(saved.flatMap(act => [
   supportNameKey(typeof act === 'string' ? act : act?.name),
   supportNameKey(act?.scheduleSourceName),
 ]))
 return found.filter(act => !covered.has(supportNameKey(act.name)))
}

function readSupportActs(description, html) {
 const acts = new Map()
 const conflicts = new Set()
 const clock = '[0-2]?\\d[:.][0-5]\\d'
 const clockOnly = new RegExp('^' + clock + '$')
 const timedLabel = new RegExp('^(' + clock + ')\\s+(.+)$|^(.+?)\\s+(?:at\\s+|om\\s+)?(' + clock + ')$', 'i')
 const normalizeTime = value => timeValue(value?.replace('.',':').padStart(5,'0'))
 const add = (name,time) => {
   if (!name) return
   const key = supportNameKey(name)
   const previous = acts.get(key)
   if (previous?.time && time && previous.time !== time) conflicts.add(key)
   const accepted = conflicts.has(key) ? '' : previous?.time || time
   acts.set(key, { name: previous?.name || name, ...(accepted ? {time:accepted} : {}) })
 }
 const addLabels = (label,time,allowSpace = false) => {
   const labels = label.split(/(?:\s+(?:en|and|&(?:amp;)?)\s+|\s*[;,]\s*)(?=(?:support act|opening act|opener|voorprogramma|special guest)(?:\s|[:|–—-]))/i)
   const names = labels.map(part => supportActName(part,allowSpace))
   if (!names[0]) return
   for (const name of names) add(name,names.length === 1 ? time : '')
 }
 const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
 const lines = (description + '\n' + stripped).replace(/<\/(?:p|li|div|h[1-6]|button|time|td)>|<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').split(/\r?\n/).map(line=>line.trim().replace(/\s+/g,' ')).filter(Boolean)
 for (let i = 0; i < lines.length; i++) {
   const parts = lines[i].match(timedLabel)
   const time = parts?.[1] || parts?.[4] || (clockOnly.test(lines[i+1] || '') ? lines[i+1] : '')
   addLabels(parts?.[2] || parts?.[3] || lines[i],normalizeTime(time))
 }
 for (const match of stripped.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
   const label = match[1].replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/\s+/g,' ')
   addLabels(label,'',true)
 }
 return [...acts.values()]
}

export function parseShowTimes(html,{artist,date,verifiedEvent=false}){
 const candidates=[]
 const visit=node=>{if(!node||typeof node!=='object')return;if([].concat(node['@type']||[]).some(t=>/^(MusicEvent|Event|Festival)$/.test(t))&&String(node.startDate||'').slice(0,10)===date&&norm(artist).split(' ').filter(Boolean).every(w=>norm(node.name).split(' ').includes(w)))candidates.push(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)}}
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]))}catch{}}
 if(candidates.length!==1&&!(verifiedEvent&&candidates.length===0))return {times:{},notice:'No single matching event could be confirmed. Check the source or enter times manually.'}
 const event=candidates[0]||{},times={}
 if(timeValue(event.doorTime))times.doorsTime={value:timeValue(event.doorTime),label:'Doors open'}
 if(timeValue(event.startDate))times.showTime={value:timeValue(event.startDate),label:'Listed event start — confirm this is show time'}
 if(timeValue(event.endDate))times.endTime={value:timeValue(event.endDate),label:'Listed end — may be an estimate'}
 // Only use labelled page times on a page with exactly one event, so an agenda
 // cannot contribute another show's doors or VIP times.
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ')
 const allEvents=(html.match(/"@type"\s*:\s*"(?:MusicEvent|Event|Festival)"/g)||[]).length
 const readLabels=allEvents===1||(verifiedEvent&&allEvents===0)
 if(readLabels){for(const [key,pattern] of Object.entries({doorsTime:/(?:doors(?:\s+open)?|deuren(?:\s+open)?|zaal\s+open)\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig,vipTime:/(?:VIP\s*(?:check[ -]?in|starts?|start|entry|inloop|doors))\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig,showTime:/(?:show\s*(?:starts?|start)|aanvang(?:\s+show)?)\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig,endTime:/(?:expected\s+end|verwacht(?:e)?\s+eind(?:e|tijd)?|eindtijd)\s*[:–-]?\s*([0-2]?\d[:.][0-5]\d)/ig})){const found=[...text.matchAll(pattern)].map(m=>timeValue(m[1].replace('.',':'))).filter(Boolean);if(new Set(found).size===1)times[key]={value:found[0],label:showTimeFields[key],confirmed:true}}}
 const supportActs = readLabels ? readSupportActs(String(event.description || ''),html) : []
 return {times,supportActs,notice:Object.keys(times).length||supportActs.length?'Review the source and accept the details. Times are local to the venue.':'The event matched, but no readable times were found. Check the source manually.'}
}
