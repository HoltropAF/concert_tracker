import test from 'node:test'
import assert from 'node:assert/strict'
import {createCompleteBackup,restoreCompleteBackup,validateBackup,BACKUP_FORMAT} from './completeBackup.js'
import {createSaveQueue} from './saveQueue.js'
import {parseCoordinates,venueLocations} from './venueCoordinates.js'
import {frequentVenues} from './quickEntry.js'

const photo = 'data:image/png;base64,iVBORw0KGgo='
const concert = {id:'show-1',artist:'Test artist',date:'2026-01-01',photo:'old-user/show.jpg',songs:[{title:'Encore',rating:4}],notes:'Line one\nLine two'}
async function fixture() {
  return createCompleteBackup({concerts:[concert],settings:{theme:'dark',artistPhotos:{Artist:concert.photo},venueInfo:{Room:{lat:52,lng:4}},spotifyAccessToken:'secret',spotifyRefreshToken:'secret'},listPhotos:async()=>[{path:concert.photo}],readPhoto:async()=>photo})
}
test('complete backup restores bytes and remaps concert and artist paths, excluding tokens',async()=>{
  const backup = await fixture()
  assert.equal(backup.settings.spotifyAccessToken,undefined)
  assert.equal(backup.settings.spotifyRefreshToken,undefined)
  let written, settings
  const result = await restoreCompleteBackup({backup,currentSettings:{spotifyAccessToken:'current',other:true},uploadPhoto:async bytes=>{assert.equal(bytes,photo);return 'new-user/new-photo.png'},saveConcert:async c=>{written=c;return {error:null}},saveSettings:async s=>{settings=s;return {error:null}}})
  assert.deepEqual(result,{saved:1,photos:1})
  assert.equal(written.photo,'new-user/new-photo.png')
  assert.deepEqual(written.songs,concert.songs)
  assert.equal(written.notes,concert.notes)
  assert.equal(settings.artistPhotos.Artist,written.photo)
  assert.equal(settings.spotifyAccessToken,'current')
  assert.equal(settings.other,true)
  assert.equal(backup.concerts[0].photo,concert.photo)
})
test('backup stops on storage read failures rather than exporting incomplete data',async()=>{
  await assert.rejects(createCompleteBackup({concerts:[],settings:{},listPhotos:async()=>{throw Error('offline')}}),/offline/)
  await assert.rejects(createCompleteBackup({concerts:[concert],settings:{},listPhotos:async()=>[]}),/missing/)
})
test('restore validates all input before writes and reports partial failures',async()=>{
  const backup=await fixture();let writes=0
  await assert.rejects(restoreCompleteBackup({backup:{...backup,concerts:[concert,concert]},uploadPhoto:async()=>{writes++}}),/duplicate/)
  assert.equal(writes,0)
  await assert.rejects(restoreCompleteBackup({backup,currentSettings:{},uploadPhoto:async()=> 'new/path',saveConcert:async()=>({error:Error('offline')}),saveSettings:async()=>{writes++}}),/0 concerts and 1 photos.*offline/)
  assert.equal(writes,0)
  assert.throws(()=>validateBackup({...backup,photos:[{path:concert.photo,data:'data:image/png;base64,a'}]}),/bytes/)
})
test('external image links remain links and an empty library is a valid backup',async()=>{
  assert.equal(validateBackup({format:BACKUP_FORMAT,version:1,concerts:[{...concert,photo:'https://example.com/photo.jpg'}],settings:{},photos:[]}).photos.length,0)
  const backup=await createCompleteBackup({concerts:[],settings:{},listPhotos:async()=>[]})
  assert.deepEqual(backup.concerts,[])
})
test('save queue serializes writes, catches thrown errors and retries failures',async()=>{
  const statuses=[], order=[];const queue=createSaveQueue(s=>statuses.push(s));let fail=true
  const a=queue.run('a',async()=>{order.push('a');if(fail)throw Error('offline')})
  const b=queue.run('b',async()=>{order.push('b');return {error:null}})
  assert.ok((await a).error);await b
  assert.deepEqual(order,['a','b']);assert.equal(statuses.at(-1).failed,1)
  fail=false;await queue.retry()
  assert.deepEqual(order,['a','b','a']);assert.equal(statuses.at(-1).failed,0);assert.equal(statuses.at(-1).pending,0)
})
test('a newer successful concert edit replaces its failed retry',async()=>{
  const queue=createSaveQueue();let calls=0
  await queue.run('concert:a',()=>{calls++;return {error:Error('offline')}})
  await queue.run('concert:a',()=>{calls++;return {error:null}})
  await queue.retry();assert.equal(calls,2)
})
test('map input validates bounds and excludes online events',()=>{
  assert.deepEqual(parseCoordinates('0','0'),{lat:0,lng:0})
  for(const [lat,lng] of [['','4'],['NaN',4],[91,4],[52,181],['52oops',4]]) assert.equal(parseCoordinates(lat,lng),null)
  assert.deepEqual(venueLocations([{venue:'Room',city:'City'},{venue:'Stream',attendanceMode:'online'}],[{name:'Saved'}]).map(v=>v.name),['Room','Saved'])
})
test('quick venue suggestions rank frequency then recency without online or wishlist entries',()=>{
  assert.deepEqual(frequentVenues([{venue:'A',date:'2026-01-01'},{venue:'A',date:'2026-01-02'},{venue:'B',date:'2026-02-01'},{venue:'C',wishlist:true},{venue:'Stream',attendanceMode:'online'}]),['A','B'])
})
