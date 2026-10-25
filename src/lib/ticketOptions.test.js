import test from 'node:test'
import assert from 'node:assert/strict'
import {groupTicketEvents,mergeTicketOptions,sellerLink,ticketSaleOpen,wishStepStates} from './ticketOptions.js'
import {applyWishUpdates,proposedChanges} from './wishlistUpdates.js'
const base={id:'standard',artist:'ENHYPEN',date:'2027-03-20',venue:'Arena',city:'Amsterdam',url:'https://ticketmaster.nl/event/1'}
test('packages group only with same artist, date, venue and known time',()=>{
 const results=groupTicketEvents([base,{...base,id:'vip',artist:'ENHYPEN | VIP1',url:'https://ticketmaster.nl/event/2'},{...base,id:'other-night',date:'2027-03-21'},{...base,id:'other-venue',venue:'Other Arena'},{...base,id:'matinee',startTime:'14:00:00'}])
 assert.equal(results.length,4);assert.equal(results[0].ticketOptions.length,2);assert.equal(results[0].ticketOptions[1].label,'VIP1')
 assert.equal(groupTicketEvents([base,{...base,id:'other',artist:'Another Artist'}]).length,2)
})
test('options require explicit acceptance, preserve manual options and deduplicate',()=>{
 const event=groupTicketEvents([base])[0],wish={wishlist:true,ticketOptions:[{id:'manual',label:'GA',url:'https://seller.example/ga'}]}
 assert.equal(applyWishUpdates(wish,event,['date']).ticketOptions.length,1)
 const saved=applyWishUpdates(wish,event,['ticketOptions'])
 assert.equal(saved.ticketOptions.length,2)
 assert.equal(mergeTicketOptions(saved.ticketOptions,event.ticketOptions).length,2)
})
test('saved, pending and missing states reflect actual changes',()=>{
 assert.deepEqual(wishStepStates({artist:'ENHYPEN'},[],proposedChanges),['saved','missing','missing','missing'])
 const event=groupTicketEvents([base])[0]
 assert.deepEqual(wishStepStates({artist:'ENHYPEN'},[event],proposedChanges),['saved','pending','pending','pending'])
 const saved=applyWishUpdates({wishlist:true,artist:'ENHYPEN'},event,proposedChanges({},event).map(c=>c.key))
 assert.deepEqual(wishStepStates(saved,[event],proposedChanges),['saved','saved','saved','saved'])
})
test('seller links are safe and cancelled or future sales do not open as on sale',()=>{
 assert.equal(sellerLink('javascript:alert(1)'), '')
 assert.equal(sellerLink('https://user:password@example.com'),'')
 assert.equal(ticketSaleOpen({ticketSaleAt:'2027-01-01'},Date.parse('2026-01-01')),false)
 assert.equal(ticketSaleOpen({ticketSaleAt:'2025-01-01'},Date.parse('2026-01-01')),true)
 assert.equal(ticketSaleOpen({ticketSaleAt:'2025-01-01',discovery:{status:'Cancelled'}}),false)
})
