import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSetlistRows, setlistSongs, mergeSetlistSongs, moveSetlistRow, performanceSongs, mapSetlistSongs, releaseNote, toMedley, matchesSongLinkFilter} from './setlistRows.js'
import {placeLegacyGuests, songGuestNames, filterSetlistPerformers, receiptSetlistRows} from './setlistRows.js'

test('performer filters keep support sets separate and include guest songs only once', () => {
  const section = {type:'section', label:'Encore'}
  const withGuest = {name:'Finale', guests:['Kata']}
  const support = {role:'support', songs:['Opening song', {name:'Duet', feat:'Kata'}]}
  const headliner = {role:'headliner', songs:['Solo song', section, 'Solo encore', withGuest, {type:'section', label:'Bows'}]}
  const sets = [support, headliner]

  assert.equal(filterSetlistPerformers(sets, 'all'), sets)
  assert.deepEqual(filterSetlistPerformers(sets, 'headliner'), [headliner])
  assert.deepEqual(filterSetlistPerformers(sets, 'support'), [support])
  assert.deepEqual(filterSetlistPerformers(sets, 'guests').map(set => set.songs), [[support.songs[1]], [section, withGuest]])
  assert.deepEqual(filterSetlistPerformers(sets, 'support-guests'), [support, {...headliner, songs:[section, withGuest]}])
})

test('receipt order retains independent headings, guest credits and whole medleys', () => {
  const ment = {type:'section', label:'MENT', sectionNote:'Thanked the crowd'}
  const end = {type:'section', label:'__SECTION_END__'}
  const one = {name:'Z title', albumName:'First', guests:['Kata']}
  const medley = {type:'medley', name:'Mix', albumName:'First', parts:['One', 'Two']}
  const rows = ['Acoustic song', ment, one, end, medley]

  assert.deepEqual(receiptSetlistRows(rows, 'performed'), rows)
  assert.deepEqual(receiptSetlistRows(rows, 'alpha'), ['Acoustic song', medley, one])
  assert.deepEqual(receiptSetlistRows(rows, 'album'), [{type:'section', label:'First'}, one, medley, 'Acoustic song'])
})

test('legacy guest picks move inline when the song is unique', () => {
  const song = {name:'One', feat:'Kata', spotifyId:'track'}
  const legacy = {kata:['one'], Paul:['One'], Support:['One']}
  const result = placeLegacyGuests([song, 'Two'], legacy, ['kata', 'Paul'])
  assert.deepEqual(result.rows, [{name:'One', guests:['kata', 'Paul'], spotifyId:'track'}, 'Two'])
  assert.deepEqual(result.unassigned, [])
  assert.equal(song.feat, 'Kata')
  assert.deepEqual(songGuestNames(song), ['Kata'])
})

test('repeated titles need assignment and removed guest picks stay removed', () => {
  const legacy = {Kata:['One', 'Two', 'Missing']}
  const rows = ['One', 'One', {name:'Two', guests:[]}]
  const result = placeLegacyGuests(rows, legacy, ['Kata'])
  assert.deepEqual(result.rows, rows)
  assert.deepEqual(result.unassigned, [{guest:'Kata', song:'One'}, {guest:'Kata', song:'Missing'}])
  rows[1] = {name:'One', guests:['Kata']}
  assert.deepEqual(placeLegacyGuests(rows, legacy, ['Kata']).unassigned, [{guest:'Kata', song:'Missing'}])
})

test('explicit medley conversion splits slash titles without assigning one Spotify track to every part',()=>{
 const row={name:' One / Two// Three / ',spotifyId:'original',info:'Keep this note',unreleasedAtShow:true}
 const medley=toMedley(row)
 assert.deepEqual(medley.parts.map(p=>p.name),['One','Two','Three'])
 assert.ok(medley.parts.every(p=>!p.spotifyId&&p.unreleasedAtShow))
 assert.equal(medley.info,row.info)
 assert.equal(toMedley({name:'One',spotifyId:'one'}).parts[0].spotifyId,'one')
 assert.equal(normalizeSetlistRows([row])[0].name,row.name)
})

test('unreleased performances have their own filter even after linking a later release',()=>{
 for(const spotifyId of [null,'track']){
   const song={unreleasedAtShow:true,spotifyId,releaseDate:'2027-01'}
   assert.equal(matchesSongLinkFilter(song,'unreleased'),true)
   assert.equal(matchesSongLinkFilter(song,'linked'),false)
   assert.equal(matchesSongLinkFilter(song,'unlinked'),false)
   assert.equal(matchesSongLinkFilter(song,'all'),true)
 }
 assert.equal(matchesSongLinkFilter({spotifyId:'track'},'linked'),true)
 assert.equal(matchesSongLinkFilter({},'unlinked'),true)
 assert.equal(matchesSongLinkFilter({},'unreleased'),false)
})

test('medley links preserve one performance, headings and unreleased memories',()=>{
 const rows=[{type:'section',label:'Encore'},{type:'medley',name:'Dance remix',parts:[{name:'Working title',unreleasedAtShow:true},'Two']}]
 assert.equal(setlistSongs(rows).length,2)
 const linked=mergeSetlistSongs(rows,[{...rows[1].parts[0],spotifyId:'one',releaseDate:'2027-03-14'},{name:'Two',spotifyId:'two'}])
 assert.equal(linked.length,2);assert.deepEqual(linked[0],rows[0]);assert.equal(linked[1].parts[1].spotifyId,'two')
 const songs=performanceSongs(JSON.parse(JSON.stringify(linked)))
 assert.equal(songs[0].medleyTitle,'Dance remix')
 assert.equal(releaseNote(songs[0]),'Unreleased at this show · released 2027-03-14')
 const patched=mapSetlistSongs(linked,s=>s.name==='Two'?{...s,albumName:'Album'}:s)
 assert.equal(patched[1].parts[1].albumName,'Album');assert.deepEqual(patched[0],rows[0])
})

test('song statistics count repeated parts once per medley, but separate performances separately',()=>{
 const medley={type:'medley',name:'Mix',parts:['One','One','Two']}
 assert.equal(performanceSongs([medley,'One']).length,3)
 assert.equal(setlistSongs([medley]).length,3)
 assert.equal(releaseNote({name:'Released song',releaseDate:'2020'}),'')
})
test('legacy headings become independent rows without losing song metadata',()=>{
 const song={name:'One',sectionLabel:'Encore',sectionCategory:'encores',spotifyId:'track',info:'note'}
 const rows=normalizeSetlistRows([song,'Two'])
 assert.deepEqual(rows,[{type:'section',label:'Encore',sectionCategory:'encores'},{name:'One',spotifyId:'track',info:'note'},'Two'])
 assert.deepEqual(normalizeSetlistRows(rows),rows)
 assert.equal(setlistSongs(rows).length,2)
})
test('sections move independently and deleting a heading keeps songs',()=>{
 const rows=[{type:'section',label:'Act I'},'One',{type:'section',label:'Encore'},'Two']
 assert.deepEqual(moveSetlistRow(rows,2,1),[rows[0],rows[2],'One','Two'])
 assert.deepEqual(setlistSongs(rows.filter((_,i)=>i!==2)),['One','Two'])
 assert.equal(moveSetlistRow(rows,0,-1),rows)
})
test('Spotify updates preserve consecutive and empty sections',()=>{
 const rows=[{type:'section',label:'Act I'},{type:'section',label:'Acoustic'},'One',{type:'section',label:'Encore'}]
 assert.deepEqual(mergeSetlistSongs(rows,[{name:'One',spotifyId:'id'}]),[rows[0],rows[1],{name:'One',spotifyId:'id'},rows[3]])
})

test('crying memories survive section moves, serialization and Spotify enrichment',()=>{
 const section={type:'section',label:'MENT',cried:true,criedNote:'When they thanked the fans'}
 const rows=JSON.parse(JSON.stringify([section,'One',{type:'section',label:'MENT 2',sectionNote:'They joked about stroopwafels'}]))
 const enriched=mergeSetlistSongs(normalizeSetlistRows(rows),[{name:'One',spotifyId:'track'}])
 assert.deepEqual(enriched[0],section)
 assert.deepEqual(moveSetlistRow(enriched,0,2)[2],section)
 assert.equal(enriched[2].sectionNote,'They joked about stroopwafels')
 assert.equal(enriched[2].cried,undefined)
 assert.equal(setlistSongs(enriched).length,1)
})
