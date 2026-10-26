import test from 'node:test'
import assert from 'node:assert/strict'
import {parseAfasAgenda,readSupportedAgenda} from '../../server/venueAgendas.js'
const card=(artist,date,status='')=>`<article class="agendaV2-item ${status}"><a href="https://www.afaslive.nl/agenda/test"><h4>${artist}</h4><p class="date"><span>${date}</span></p></a></article>`
const html=card('Treasure','zaterdag 31 oktober 2026')+card('Other Artist','vrijdag 30 oktober 2026','st-canceled')
test('AFAS reader extracts local dates and cancellation without inventing availability',()=>{
 const events=parseAfasAgenda(html)
 assert.equal(events[0].date,'2026-10-31');assert.equal(events[1].status,'Cancelled')
 assert.equal(events[0].status,'Check venue website for tickets')
 assert.throws(()=>parseAfasAgenda('<html>Blocked</html>'))
})
test('different artists share one agenda request and retain original freshness',async()=>{
 let calls=0;const read=async()=>{calls++;return {html}}
 const query={website:'https://www.afaslive.nl/',artist:'Treasure',today:'2026-10-26'}
 const [a,b]=await Promise.all([readSupportedAgenda(query,read),readSupportedAgenda({...query,artist:'Other Artist'},read)])
 assert.equal(calls,1);assert.equal(a.events.length,1);assert.equal(b.events.length,1);assert.equal(b.cached,true);assert.equal(a.checkedAt,b.checkedAt)
 assert.equal((await readSupportedAgenda({...query,today:'2027-01-01'},read)).events.length,0)
 assert.equal(await readSupportedAgenda({...query,website:'https://afaslive.nl.evil.example'},read),null)
})
test('failed agendas can be retried and never become empty successes',async()=>{
 let calls=0;const read=async()=>{if(!calls++)throw Error('Timeout');return {html}}
 const query={website:'https://afaslive.nl',artist:'Treasure',today:'2026-10-26'}
 await assert.rejects(readSupportedAgenda(query,read));assert.equal((await readSupportedAgenda(query,read)).events.length,1)
})
