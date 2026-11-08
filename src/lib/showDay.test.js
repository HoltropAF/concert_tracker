import {test} from 'node:test'
import assert from 'node:assert/strict'
import {showsToday,showCountdown,preparationItems} from './showDay.js'
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
