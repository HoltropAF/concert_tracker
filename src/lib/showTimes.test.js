import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseShowTimes,timeValue} from './showTimes.js'
import {lookupShowTimes} from '../../server/showTimes.js'
const event={ '@type':'MusicEvent',name:'Test Artist',startDate:'2026-11-10T20:00:00+01:00',endDate:'2026-11-10T22:30:00+01:00'}
const page=e=>`<script type="application/ld+json">${JSON.stringify(e)}</script>`
test('time lookup requires an unambiguous matching artist and date and keeps event start distinct from doors',()=>{
 const query={artist:'Test Artist',date:'2026-11-10'}
 assert.equal(parseShowTimes(page(event),query).times.showTime.value,'20:00')
 assert.equal(parseShowTimes(page(event),query).times.doorsTime,undefined)
 const result=parseShowTimes(page(event)+'Doors open: 18:30 VIP check-in: 17:00',query)
 assert.equal(result.times.doorsTime.value,'18:30');assert.equal(result.times.vipTime.value,'17:00');assert.equal(result.times.endTime.value,'22:30')
 assert.deepEqual(parseShowTimes(page(event),{...query,date:'2026-11-11'}).times,{})
 assert.deepEqual(parseShowTimes(page([event,event]),query).times,{})
 assert.equal(parseShowTimes(page(event)+'Doors open 18:00 Doors open 19:00',query).times.doorsTime,undefined)
 assert.equal(timeValue('29:99'),'')
})
test('automatic lookup finds the exact show without a supplied link, preserves source and rejects conflicting times',async()=>{
 const q={artist:'Test Artist',date:'2026-11-10',venue:'Ziggo Dome',country:'Netherlands'}
 const match={artist:q.artist,date:q.date,venue:q.venue,url:'https://example.com/event',startTime:'20:00:00'}
 const deps={key:'test-only',venue:async()=>({events:[]}),tm:async()=>({events:[{...match,date:'2026-11-11'},match]}),mojo:async()=>({events:[]}),read:async url=>({url,html:page(event)+'Doors open 18:30'})}
 const result=await lookupShowTimes(q,deps)
 assert.equal(result.times.showTime.value,'20:00')
 assert.equal(result.times.doorsTime.value,'18:30')
 assert.equal(result.times.showTime.source,match.url)
 const conflict=await lookupShowTimes(q,{...deps,read:async url=>({url,html:page({...event,startDate:'2026-11-10T21:00:00+01:00'})})})
 assert.equal(conflict.times.showTime,undefined)
 assert.match(conflict.notice,/disagree/)
 const failure=await lookupShowTimes(q,{...deps,tm:async()=>{throw Error('Unavailable')},read:async()=>{throw Error('Blocked')}})
 assert.deepEqual(failure.times,{})
 assert.equal(failure.sources[0].status,'Unavailable')
})
