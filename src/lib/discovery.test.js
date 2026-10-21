import test from 'node:test'
import assert from 'node:assert/strict'
import {parseUpcomingPage,searchUpcoming} from '../../server/upcoming.js'
import handler from '../../api/upcoming.js'
import {discoveryDuplicate,wishlistDraft,discoveryInvite} from './discovery.js'

const event={id:'1',title:'Test band',url:'/event/1',timeZone:'Europe/Amsterdam',venue:{name:'Paradiso',city:'Amsterdam',countryCode:'NL'},dates:{startDate:'2027-03-20T19:00:00Z',onsaleDate:'2026-11-01T09:00:00Z'}}
const page=events=>`<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{initialReduxState:{api:{queries:{search:{endpointName:'searchEvents',data:{events,total:events.length}}}}}}}})}</script></html>`
const query={artist:'Test band',venue:'Paradiso',city:'Amsterdam',country:'NL',today:'2026-10-13',page:1}
const parse=events=>parseUpcomingPage(page(events),query,query.today,'2026-10-13T12:00:00Z')
test('discovery filters past shows and wrong locations, deduplicates source IDs and retains ticket status',()=>{
  const found=parse([event,event,{...event,id:'old',dates:{startDate:'2025-01-01T12:00:00Z'}},{...event,id:'other',venue:{name:'Other',city:'Amsterdam',countryCode:'NL'}},{...event,id:'sold',soldOut:true}])
  assert.equal(found.events.length,2)
  assert.equal(found.events[0].status,'Check ticket site')
  assert.equal(found.events[1].status,'Sold out')
  assert.equal(found.events[0].country,'Netherlands')
  assert.equal(found.events[0].url,'https://www.ticketmaster.nl/event/1')
})
test('unreadable source is an error, valid zero results stay empty and unsafe URLs are rejected',()=>{
  assert.throws(()=>parseUpcomingPage('<html>blocked</html>',query,query.today),/could not be read/)
  assert.throws(()=>parseUpcomingPage('<script id="__NEXT_DATA__">{}</script>',query,query.today),/format/)
  assert.deepEqual(parse([]).events,[])
  assert.deepEqual(parse([{...event,url:'javascript:alert(1)'},{...event,url:'https://evil.example/'}]).events,[])
})
test('source uses venue timezone at midnight and keeps cancelled status visible',()=>{
  const result=parse([{...event,cancelled:true,dates:{startDate:'2027-03-20T23:30:00Z'}}]).events[0]
  assert.equal(result.date,'2027-03-21')
  assert.equal(result.status,'Cancelled')
})
test('wishlist draft keeps provenance and does not assume festival attendance or tickets',()=>{
  const item=parse([event]).events[0],draft=wishlistDraft(item,'festival')
  assert.equal(draft.type,'festival');assert.equal(draft.wishlist,true)
  assert.equal(draft.discovery.id,item.id);assert.equal(draft.ticketSaleLink,item.url)
  assert.equal(draft.acts,undefined);assert.equal(draft.tickets,undefined)
  assert.equal(discoveryDuplicate(item,[{...draft,id:'saved'}]),true)
  assert.equal(discoveryDuplicate(item,[{artist:'TEST BAND',date:item.date,venue:'Paradíso'}]),true)
  assert.equal(discoveryDuplicate(item,[{artist:item.artist,date:item.date,venue:'Other'}]),false)
  assert.match(discoveryInvite(item),/https:\/\/www.ticketmaster.nl/)
})
test('HTTP boundary reads provider response, reports failure and rejects invalid filters without searching',async()=>{
  const result=await searchUpcoming(query,async()=>new Response(page([event])))
  assert.equal(result.events.length,1)
  await assert.rejects(searchUpcoming(query,async()=>new Response('',{status:403})),/HTTP 403/)
  let status,body
  await handler({method:'GET',query:{artist:['bad'],today:'2026-10-13'}},{status(n){status=n;return this},json(v){body=v}})
  assert.equal(status,400);assert.match(body.error,/Invalid/)
})
