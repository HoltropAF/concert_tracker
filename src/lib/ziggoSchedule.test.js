import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readZiggoSchedule} from '../../server/ziggoSchedule.js'
import {lookupShowTimes} from '../../server/showTimes.js'
const q={artist:'Test Artist',date:'2026-11-28',venue:'Ziggo Dome',country:'NL'}
const id='6fcef90b-977c-4b26-89f5-da3a1832407d',event={id,performerName:q.artist,showDate:q.date+' 19:00:00'}
const detail={data:[event],program:[{program:[{time:'19:00',title:'Deuren open'},{time:'20:00',title:'Support act | Opener'},{time:'20:50',title:q.artist},{time:'22:50',title:'Verwachte eindtijd'}]}]}
test('Ziggo event search reads the separate headliner and support timetable, never treats listing time as show start',async()=>{
 const ziggo=()=>readZiggoSchedule(q,async url=>new Response(JSON.stringify(url.includes('/api/search/')?{resultsEvents:[{...event,showDate:'2026-11-29'},event]}:detail)))
 const result=await lookupShowTimes(q,{key:'fixture',tm:async()=>({events:[{...q,url:'https://example.com/ticket',startTime:'19:00'}]}),mojo:async()=>({events:[]}),ziggo,read:async url=>({url,html:''})})
 assert.equal(result.times.doorsTime.value,'19:00');assert.equal(result.times.showTime.value,'20:50');assert.equal(result.times.endTime.value,'22:50')
 assert.equal(result.supportActs[0].name,'Opener');assert.equal(result.supportActs[0].time,'20:00')
 assert.equal(await readZiggoSchedule({...q,date:'2026-11-27'},async()=>new Response(JSON.stringify({resultsEvents:[event]}))),null)
})
