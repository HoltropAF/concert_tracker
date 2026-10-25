import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWishUpdates, checkWish, isSameWish, proposedChanges, safeTicketUrl } from './wishlistUpdates.js'

const event = { id: 'ticketmaster:1', artist: 'Artist', date: '2027-06-18', venue: 'Venue', city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', url: 'https://www.ticketmaster.nl/event/1', status: 'Check ticket site', source: 'Ticketmaster', checkedAt: '2026-10-20T12:00:00Z' }
test('artist-only wishes are possible matches, not confirmed shows', () => {
  assert.equal(isSameWish({ artist: 'Artist', date: '9999-12-31' }, event), false)
  assert.equal(isSameWish({ artist: 'Artist', date: event.date, venue: 'Venue' }, event), true)
  assert.equal(isSameWish({ artist: 'Another artist', date: event.date, venue: 'Venue' }, event), false)
  assert.equal(isSameWish({ discovery: { id: event.id } }, { ...event, date: '2027-06-20' }), true)
})
test('review only updates selected fields and preserves personal data and identity', () => {
  const wish = { id: 'mine', artist: 'My artist label', wishlist: true, date: '9999-12-31', notes: 'Standing only', tags: ['Favourite'], photo: 'photo.jpg', venue: 'My venue' }
  const updated = applyWishUpdates(wish, event, ['date', 'notes', 'artist'])
  assert.equal(updated.id, 'mine')
  assert.equal(updated.artist, 'My artist label')
  assert.equal(updated.date, event.date)
  assert.equal(updated.venue, 'My venue')
  assert.equal(updated.notes, 'Standing only')
  assert.equal(updated.photo, 'photo.jpg')
  assert.deepEqual(updated.tags, ['Favourite'])
  assert.equal(updated.wishlist, true)
  assert.equal(wish.date, '9999-12-31')
  assert.throws(() => applyWishUpdates({ ...wish, wishlist: false }, event, []))
})
test('missing fields never erase saved details; unsafe seller links cannot be imported', () => {
  const changes = proposedChanges({ venue: 'My venue' }, { ...event, venue: '', url: 'javascript:alert(1)' })
  assert.equal(changes.some(c => ['venue', 'ticketSaleLink'].includes(c.key)), false)
  assert.equal(safeTicketUrl('https://ticketmaster.nl.evil.example'), '')
})
test('checks paginate and distinguish empty results from provider failures', async () => {
  const pages = []
  const fetcher = async url => {
    const page = new URL(url, 'https://app.test').searchParams.get('page')
    pages.push(page)
    return { ok: true, json: async () => ({ events: page === '1' ? [] : [event], hasMore: page === '1', checkedAt: event.checkedAt }) }
  }
  const result = await checkWish({ artist: 'Artist', country: 'Netherlands' }, { fetcher, sources: ['ticketmaster'] })
  assert.deepEqual(pages, ['1', '2'])
  assert.equal(result.exact, false)
  assert.equal(result.events.length, 1)
  const empty = await checkWish({ artist: 'Artist' }, { fetcher: async () => ({ ok: true, json: async () => ({ events: [], hasMore: false }) }) })
  assert.equal(empty.status, 'empty')
  assert.equal((await checkWish({ artist: 'Artist' }, { fetcher: async () => ({ ok: false, json: async () => ({ error: 'Source unavailable' }) }) })).status, 'error')
})

test('a failed later page preserves earlier source results', async()=>{
 let calls=0
 const result=await checkWish({artist:'Artist'},{sources:['ticketmaster'],fetcher:async()=>({ok:++calls===1,json:async()=>calls===1?{events:[event],hasMore:true}:{error:'blocked'}})})
 assert.equal(result.events.length,1)
 assert.equal(result.status,'found')
 assert.equal(result.reports[0].error,'blocked')
 assert.equal(result.limited,true)
})

test('empty working source plus failed source is incomplete, not total failure',async()=>{
 const result=await checkWish({artist:'Artist'},{fetcher:async url=>({ok:!url.includes('source=ticketmaster'),json:async()=>url.includes('source=ticketmaster')?{error:'Refused'}:{events:[],hasMore:false}})})
 assert.equal(result.status,'partial')
 assert.equal(result.reports[1].pages,1)
})

test('stalled sources cannot hold up successful matches or exceed the check budget',async()=>{
 const progress=[];let active=0,maxActive=0
 const result=await checkWish({artist:'Artist'},{sources:['ticketmaster','mojo'],budgetMs:40,sourceMs:20,onProgress:p=>progress.push(p),fetcher:async url=>{
  active++;maxActive=Math.max(active,maxActive)
  if(url.includes('source=ticketmaster'))return new Promise(()=>{})
  await new Promise(resolve=>setTimeout(resolve,2));active--
  return {ok:true,json:async()=>({events:[event],hasMore:false})}
 }})
 assert.equal(maxActive,2);assert.equal(result.status,'found');assert.equal(result.events.length,1)
 assert.equal(result.reports[0].error,'Source timed out.');assert.equal(progress.at(-1).done,2)
})
test('budget exhaustion explicitly marks sites not checked',async()=>{
 const venues=Array.from({length:7},(_,i)=>({name:'Venue '+i,url:'https://v'+i+'.example'}))
 const result=await checkWish({artist:'Artist'},{sources:[],venues,budgetMs:15,sourceMs:100,fetcher:()=>new Promise(()=>{})})
 assert.equal(result.reports.length,7);assert.equal(result.checkedSources,0);assert.equal(result.status,'error')
 assert.ok(result.reports.some(r=>r.error==='Not checked within the time limit.'))
})
test('stop aborts a hung request and returns without losing source reports',async()=>{
 const controller=new AbortController()
 const task=checkWish({artist:'Artist'},{sources:['ticketmaster'],signal:controller.signal,fetcher:()=>new Promise(()=>{})})
 controller.abort()
 const result=await task
 assert.equal(result.reports[0].error,'Check stopped.')
})
