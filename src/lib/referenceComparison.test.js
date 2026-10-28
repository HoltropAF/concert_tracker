import test from 'node:test'
import assert from 'node:assert/strict'
import {parseReference,compareReference,applyReference,referenceUrl} from './referenceComparison.js'
test('pasted labelled text and exported JSON normalize without guessing ambiguous dates',()=>{
 const ref=parseReference('Artist: Artist\nDate: 2026-10-28\nVenue: Venue\nSetlist:\n1. One\n2. Two')
 assert.deepEqual(ref.setlist,['One','Two']);assert.equal(ref.date,'2026-10-28')
 assert.deepEqual(parseReference(JSON.stringify(ref)),ref)
 assert.throws(()=>parseReference('Date: 10/11/2026'))
 assert.throws(()=>parseReference('Some arbitrary website text'))
 assert.throws(()=>referenceUrl('javascript:alert(1)'))
})
test('comparison distinguishes missing, conflicting and matching information',()=>{
 const report=compareReference({artist:'Artist',date:'2026-10-28',venue:'Old'},parseReference('Artist: ARTIST\nDate: 2026-10-29\nVenue: New\nCity: Amsterdam'))
 assert.equal(report.fields.find(f=>f.key==='artist').status,'match')
 assert.equal(report.fields.find(f=>f.key==='date').status,'conflict')
 assert.equal(report.fields.find(f=>f.key==='city').status,'addition')
})
test('selected additions preserve personal data, medleys and section metadata and record provenance',()=>{
 const concert={artist:'Artist',date:'2026-10-28',notes:'Personal',criedSong:'One',friends:['A'],setlist:[{type:'section',label:'MENT',cried:true},{type:'medley',name:'Mix',parts:[{name:'One',spotifyId:'track',unreleasedAtShow:true},'Two']}]}
 const ref=parseReference('Artist: Artist\nDate: 2026-10-29\nCity: Amsterdam\nSetlist:\nOne\nTwo\nThree')
 const report=compareReference(concert,ref),selected=[...report.fields,...report.additions].filter(c=>c.status==='addition').map(c=>c.id)
 const next=applyReference(concert,ref,selected,{name:'Concert Archives',url:'https://www.concertarchives.org/concerts/example'})
 assert.equal(next.date,concert.date);assert.equal(next.city,'Amsterdam');assert.equal(next.notes,concert.notes);assert.equal(next.criedSong,'One')
 assert.deepEqual(next.setlist.slice(0,2),concert.setlist);assert.equal(next.setlist[2].name,'Three');assert.equal(concert.setlist.length,2)
 assert.equal(next.referenceImports[0].changes.length,2)
 assert.equal(compareReference(next,ref).additions.length,0)
})
test('order differences and repeats are flagged without replacing saved songs',()=>{
 const concert={setlist:['One','Two','One']},ref=parseReference('Setlist:\nTwo\nOne')
 assert.equal(compareReference(concert,ref).sequenceDiffers,true)
 assert.deepEqual(applyReference(concert,ref,[],{name:'Source',url:''}),concert)
})

test('non-Latin song names remain distinct during comparison',()=>{
 const report=compareReference({setlist:['봄날']},parseReference('Setlist:\n봄날\n불타오르네\n소우주'))
 assert.deepEqual(report.additions.map(s=>s.after),['불타오르네','소우주'])
})
