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
