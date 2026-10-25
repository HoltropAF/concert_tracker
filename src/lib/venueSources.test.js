import test from 'node:test'
import assert from 'node:assert/strict'
import {savedVenueSources} from './venueSources.js'
import {parseVenueEvents,searchVenueWebsite,publicIPv4,venueUrl} from '../../server/venueWebsites.js'
import {checkWish,applyWishUpdates} from './wishlistUpdates.js'
const query={artist:'Test Artist',today:'2026-10-25',website:'https://venue.example',venueName:'Venue'}
const html='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'MusicEvent',name:'Test Artist',startDate:'2027-03-20T20:00:00+01:00',url:'/event/test',location:{name:'Venue',address:{addressLocality:'Amsterdam',addressCountry:'NL'}}})+'</script>'
test('saved venue sources include legacy and current links and deduplicate',()=>{
 assert.deepEqual(savedVenueSources({venueUrls:{A:'http://venue.example',B:'https://venue.example'},venueInfo:{C:{url:'https://other.example'}},savedVenues:[{name:'D',url:'https://third.example'}]}).map(s=>s.url).sort(),['https://other.example/','https://third.example/','https://venue.example/'])
})
test('venue fetch disallows local and special addresses and credential URLs',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','::1'])assert.equal(publicIPv4(ip),false)
 assert.equal(publicIPv4('8.8.8.8'),true)
 for(const url of ['http://venue.example','https://127.0.0.1','https://user:pass@venue.example','https://venue.example:8080'])assert.throws(()=>venueUrl(url))
})
test('venue events preserve local dates and require an artist match',()=>{
 const result=parseVenueEvents(html,'https://venue.example',query)
 assert.equal(result.events[0].date,'2027-03-20')
 assert.equal(result.events[0].url,'https://venue.example/event/test')
 assert.equal(parseVenueEvents(html,'https://venue.example',{...query,artist:'Someone Else'}).events.length,0)
 const saved=applyWishUpdates({wishlist:true,notes:'Keep'},result.events[0],['ticketSaleLink'])
 assert.equal(saved.ticketSaleLink,'https://venue.example/event/test');assert.equal(saved.notes,'Keep')
})
test('venue crawler follows agenda and artist links but reports incomplete coverage',async()=>{
 const visited=[]
 const result=await searchVenueWebsite(query,async url=>{visited.push(url);return {url,html:url.includes('agenda')?html:'<a href="/agenda">Agenda</a><a href="https://unrelated.example">Other</a>'}})
 assert.equal(result.events.length,1);assert.equal(visited.length,2);assert.ok(result.warning)
})
test('all venue sites checked, failures isolated, and unknown formats are not empty successes',async()=>{
 const called=[]
 const result=await checkWish({artist:'Test Artist'},{sources:[],venues:[{name:'A',url:'https://a.example'},{name:'B',url:'https://b.example'}],fetcher:async url=>{called.push(url);return called.length===1?{ok:false,json:async()=>({error:'Blocked'})}:{ok:true,json:async()=>({events:[],warning:'No readable event data'})}}})
 assert.equal(called.length,2);assert.equal(result.status,'partial');assert.equal(result.reports.length,2)
})
