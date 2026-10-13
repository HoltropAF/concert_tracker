import test from 'node:test'
import assert from 'node:assert/strict'
import {concertCalendar} from './calendar.js'
import handler from '../../api/setlist.js'
test('calendar uses exclusive all-day end dates and escapes event text',()=>{
  const event=concertCalendar({id:'a',artist:'Band, X\nY',date:'2026-12-31',endDate:'2027-01-02'})
  assert.match(event,/DTSTART;VALUE=DATE:20261231/)
  assert.match(event,/DTEND;VALUE=DATE:20270103/)
  assert.match(event,/SUMMARY:Band\\, X\\nY/)
  assert.throws(()=>concertCalendar({date:'9999-12-31'}),/valid date/)
  assert.throws(()=>concertCalendar({date:'2026-02-30'}),/valid date/)
})
test('sale events preserve entered local time and folded lines stay within 75 bytes',()=>{
  const event=concertCalendar({id:'b',artist:'🎵'.repeat(100),ticketSaleAt:'2026-10-15T10:30'},'sale')
  assert.match(event,/DTSTART:20261015T103000/)
  assert.match(event,/DURATION:PT15M/)
  for(const line of event.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75)
})
test('concert search returns choices, preserves pagination and rejects ambiguous legacy auto-fill',async()=>{
  const original=global.fetch,key=process.env.SETLISTFM_API_KEY
  process.env.SETLISTFM_API_KEY='test-only'
  let requested
  global.fetch=async url=>{requested=String(url);return {ok:true,status:200,json:async()=>({page:2,total:40,itemsPerPage:20,setlist:[{artist:{name:'Band'},eventDate:'01-10-2026',venue:{name:'Room'},sets:{set:[]}},{artist:{name:'Band'},eventDate:'02-10-2026',sets:{set:[]}}]})}}
  async function call(query){let status,body;await handler({method:'GET',query},{setHeader(){},status(s){status=s;return this},json(b){body=b;return this}});return {status,body}}
  try {
    const found=await call({search:'1',artist:'Band',city:'Amsterdam',page:'2'})
    assert.equal(found.status,200);assert.equal(found.body.results.length,2);assert.equal(found.body.page,2)
    assert.ok(requested.includes('cityName=Amsterdam'));assert.equal(found.body.results[0].date,'2026-10-01')
    const past=await call({search:'1',artist:'Band',period:'past',today:'2026-10-02',country:'NL'})
    assert.equal(past.status,200);assert.equal(past.body.results.length,1)
    assert.equal(past.body.results[0].date,'2026-10-01')
    assert.ok(requested.includes('countryCode=NL'))
    assert.equal((await call({search:'1',artist:'Band',period:'past',today:'invalid'})).status,400)
    assert.equal((await call({artist:'Band',date:'2026-10-01'})).status,409)
    delete process.env.SETLISTFM_API_KEY
    assert.equal((await call({search:'1',artist:'Band'})).status,501)
  }finally{global.fetch=original;if(key===undefined)delete process.env.SETLISTFM_API_KEY;else process.env.SETLISTFM_API_KEY=key}
})
