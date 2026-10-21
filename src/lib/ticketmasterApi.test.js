import test from 'node:test'
import assert from 'node:assert/strict'
import {searchTicketmasterApi} from '../../server/ticketmasterApi.js'
test('official API preserves local date, status and safe ticket links',async()=>{
 const result=await searchTicketmasterApi({artist:'Artist',today:'2026-10-21',page:2,country:'NL'},'test-key',async url=>{
   const query=new URL(url).searchParams
   assert.equal(query.get('page'),'1');assert.equal(query.get('countryCode'),'NL')
   return {ok:true,json:async()=>({page:{totalElements:21},_embedded:{events:[{id:'one',name:'Artist',url:'https://www.ticketmaster.nl/event/one',dates:{start:{localDate:'2027-01-01'},status:{code:'onsale'}},_embedded:{venues:[{name:'Venue',city:{name:'Amsterdam'},country:{countryCode:'NL'}}]}}]}})}
 })
 assert.equal(result.events[0].date,'2027-01-01')
 assert.match(result.events[0].status,/check seller/)
 assert.equal(result.total,21)
})
test('official API reports invalid keys without exposing credentials',async()=>{
 await assert.rejects(searchTicketmasterApi({artist:'Artist',today:'2026-10-21',page:1},'secret',async()=>({ok:false,status:401})),error=>error.sourceStatus===401&&!error.message.includes('secret')&&/key/.test(error.publicMessage))
})
