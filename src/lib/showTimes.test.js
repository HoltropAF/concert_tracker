import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseShowTimes,timeValue,pendingShowTime,pendingSupportActs,timetableRows} from './showTimes.js'
import {hasScheduleSuggestions,scheduleRequest,showsDueForSchedule} from './showScheduleLookup.js'
import {lookupShowTimes} from '../../server/showTimes.js'
const event={ '@type':'MusicEvent',name:'Test Artist',startDate:'2026-11-10T20:00:00+01:00',endDate:'2026-11-10T22:30:00+01:00'}
const page=e=>`<script type="application/ld+json">${JSON.stringify(e)}</script>`
test('a changed source cannot replace an accepted, manual, or deliberately cleared time', () => {
 const found = {value:'19:00'}
 assert.equal(pendingShowTime({}, 'doorsTime', found), found)
 assert.equal(pendingShowTime({doorsTime:'18:00', scheduleSources:{doorsTime:{url:'https://example.org'}}}, 'doorsTime', found), null)
 assert.equal(pendingShowTime({doorsTime:'', scheduleSources:{doorsTime:{manual:true}}}, 'doorsTime', found), null)
})
test('saved support and corrected source names suppress repeated suggestions', () => {
 const saved = ['Opener', {name:'Corrected act', scheduleSourceName:'Listed act', time:'19:30'}, {name:'Guest artist', role:'guest'}]
 const found = [{name:' opener ',time:'18:30'}, {name:'LISTED ACT',time:'20:00'}, {name:'Guest artist'}, {name:'Second opener'}]
 assert.deepEqual(pendingSupportActs(saved, found), [{name:'Second opener'}])
})
test('saved support appears among schedule times and never counts a guest as support', () => {
 const concert={doorsTime:'18:30',vipTime:'17:00',showTime:'20:00',endTime:'00:15',
   support:[{name:'Opener',time:'19:00'},{name:'Guest',role:'guest',time:'21:30'}]}
 assert.deepEqual(timetableRows(concert,{}).map(row=>row.label),['VIP starts','Doors open','Opener','Show starts','Expected end'])
})
test('prechecks target the next three days and review ignores already-saved suggestions', () => {
 const shows=['2026-11-09','2026-11-10','2026-11-13','2026-11-14'].map(date=>({id:date,date,artist:'Band'}))
 assert.deepEqual(showsDueForSchedule([...shows,{...shows[1],wishlist:true}],new Date(2026,10,10)).map(c=>c.date),['2026-11-10','2026-11-13'])
 const concert={...shows[1],showTime:'20:00',support:['Opener'],discovery:{sources:[{source:'MOJO',url:'https://www.mojo.nl/event'}]}}
 assert.equal(scheduleRequest(concert).url,'https://www.mojo.nl/event')
 assert.equal(hasScheduleSuggestions(concert,{}, {times:{showTime:{value:'21:00'}},supportActs:[{name:'Opener'}]}),false)
 assert.equal(hasScheduleSuggestions(concert,{}, {times:{doorsTime:{value:'18:30'}}}),true)
})
test('support names and start times come from timetable rows and lineup buttons', () => {
 const html = page(event) + '<button>Support act <span>J. Artist</span></button><h3>Opener: J. Artist</h3><div>19:15</div>' +
   '<li>20:10 Support act | 두 번째</li><button>Special guest Third &amp; Fourth</button><h3>Voorprogramma: TBA</h3>' +
   '<p>Opener: J. Artist en Support act: 두 번째</p>'
 const result = parseShowTimes(html,{artist:'Test Artist',date:'2026-11-10'})
 assert.deepEqual(result.supportActs,[{name:'J. Artist',time:'19:15'},{name:'두 번째',time:'20:10'},{name:'Third & Fourth'}])
})
test('lookup fills a missing support time and leaves conflicting support times for review',async()=>{
 const q={artist:'Test Artist',date:'2026-11-10',venue:'Ziggo Dome',url:'https://example.com/event'}
 const deps={key:'test-only',tm:async()=>({events:[]}),mojo:async()=>({events:[]}),ziggo:async()=>({times:{},supportActs:[{name:'Opener'}],source:'https://www.ziggodome.nl/'}),
   read:async url=>({url,html:page(event)+'<h3>Support act | Opener</h3><p>19:00</p>'})}
 assert.equal((await lookupShowTimes(q,deps)).supportActs[0].time,'19:00')
 const conflict = await lookupShowTimes(q,{...deps,ziggo:async()=>({times:{},supportActs:[{name:'Opener',time:'19:30'}]})})
 assert.equal(conflict.supportActs[0].time,undefined)
 assert.match(conflict.notice,/disagree/)
})
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
 const deps={key:'test-only',ziggo:async()=>null,venue:async()=>({events:[]}),tm:async()=>({events:[{...match,date:'2026-11-11'},match]}),mojo:async()=>({events:[]}),read:async url=>({url,html:page(event)+'Doors open 18:30'})}
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
