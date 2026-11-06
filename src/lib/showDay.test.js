import {test} from 'node:test'
import assert from 'node:assert/strict'
import {showsToday,showCountdown} from './showDay.js'
test('show day uses local dates, includes festival days and excludes wishes and unknown dates',()=>{
 const now=new Date(2026,10,6,15)
 const shows=[{id:1,date:'2026-11-06'},{id:2,date:'2026-11-05',endDate:'2026-11-07'},{id:3,date:'2026-11-06',wishlist:true},{id:4,date:'2026-11-07'},{id:5,date:'9999-12-31'}]
 assert.deepEqual(showsToday(shows,now).map(c=>c.id),[1,2])
 assert.equal(showCountdown({showTime:'20:00'},now),'5h 0m until the show')
 assert.equal(showCountdown({},now),null)
 assert.equal(showCountdown({showTime:'14:00'},now),'Show time!')
})
