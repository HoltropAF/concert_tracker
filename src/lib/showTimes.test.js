import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseShowTimes,timeValue} from './showTimes.js'
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
