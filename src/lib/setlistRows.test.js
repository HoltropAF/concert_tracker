import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSetlistRows, setlistSongs, mergeSetlistSongs, moveSetlistRow, performanceSongs, mapSetlistSongs, releaseNote} from './setlistRows.js'

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
