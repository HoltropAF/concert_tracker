import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSetlistRows, setlistSongs, mergeSetlistSongs, moveSetlistRow} from './setlistRows.js'
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
