import {test} from 'node:test'
import assert from 'node:assert/strict'
import {showsToday,anniversaryShows,showCountdown,preparationItems,eveningPlanRows,eveningStops} from './showDay.js'

test('evening plans preserve the old meetup and interleave timed rows with the schedule', () => {
 const concert = {venue:'Venue', city:'Amsterdam', meetupTime:'17:00', meetupLocation:'North entrance', doorsTime:'19:00', showTime:'20:00'}
 assert.equal(eveningPlanRows(concert, false)[0].label, 'Meet at North entrance')
 assert.match(eveningPlanRows(concert, false)[0].link, /North%20entrance/)
 assert.deepEqual(eveningPlanRows(concert, true), [])
 const eveningPlans = [{id:'train', label:'Train', time:'19:30', note:'Platform 2', link:'https://example.org', linkText:'Train times'}]
 const stops = eveningStops({...concert, eveningPlans}, false)
 assert.deepEqual(stops.map(row => row.label), ['Doors open', 'Train', 'Show starts'])
 assert.equal(stops[1].linkText, 'Train times')
 assert.deepEqual(eveningStops({...concert, eveningPlans:[]}, false).map(row => row.key), ['doors', 'show'])
})
test('expected end appears in the evening and an after-midnight end follows the show', () => {
 const concert = { eveningPlans:[], doorsTime:'19:00', showTime:'20:00', endTime:'22:30' }
 const later = { id:'train', time:'23:00', label:'Train home' }
 assert.deepEqual(eveningStops({...concert, eveningPlans:[later]}, false).map(row => row.label),
   ['Doors open', 'Show starts', 'Expected end', 'Train home'])
 assert.deepEqual(eveningStops({...concert, endTime:'00:30'}, false).at(-1),
   { key:'end', time:'00:30', label:'Expected end' })
})
test('show day uses local dates, includes festival days and excludes wishes and unknown dates',()=>{
 const now=new Date(2026,10,6,15)
 const shows=[{id:1,date:'2026-11-06'},{id:2,date:'2026-11-05',endDate:'2026-11-07'},{id:3,date:'2026-11-06',wishlist:true},{id:4,date:'2026-11-07'},{id:5,date:'9999-12-31'}]
 assert.deepEqual(showsToday(shows,now).map(c=>c.id),[1,2])
 assert.equal(showCountdown({showTime:'20:00'},now),'5h 0m until the show')
 assert.equal(showCountdown({},now),null)
 assert.equal(showCountdown({showTime:'14:00'},now),'Show time!')
})
test('today prioritizes the next known start and retains custom preparation items',()=>{
 const date='2026-11-06',now=new Date(2026,10,6,15)
 const shows=[{id:'later',date,showTime:'20:00'},{id:'started',date,showTime:'14:00'},{id:'unknown',date},{id:'next',date,showTime:'17:00'}]
 assert.deepEqual(showsToday(shows,now).map(s=>s.id),['next','later','unknown','started'])
 assert.deepEqual(preparationItems({showChecklistText:'Pack earplugs\n\n Check train\nPack earplugs'}),['Pack earplugs','Check train'])
 assert.deepEqual(preparationItems({showChecklistText:''}),[])
})

test('On this day uses the local date and excludes wishlist and current-year shows',()=>{
 const shows=[{id:'memory',date:'2025-11-11'},{id:'current',date:'2026-11-11'},{id:'wish',date:'2024-11-11',wishlist:true},{id:'other',date:'2025-11-10'}]
 assert.deepEqual(anniversaryShows(shows,new Date(2026,10,11,0,5)).map(show=>show.id),['memory'])
 assert.deepEqual(anniversaryShows(shows,new Date(2026,10,12)).map(show=>show.id),[])
})
