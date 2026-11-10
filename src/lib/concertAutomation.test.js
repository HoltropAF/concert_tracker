import test from 'node:test'
import assert from 'node:assert/strict'
import { canLogPostShow, matchesPostShowSetlist, recentShowsToLog } from './postShowLog.js'
import { indexSpotifyLinks, reuseSpotifyLinks } from './spotifyReuse.js'

test('post-show review matches the artist, date, and venue and waits for festivals to end', () => {
  const concert={artist:'Beyoncé',date:'2026-11-08',venue:'Arena',city:'Amsterdam',bookedAt:'2026-10-01'}
  const setlist={...concert,artist:'Beyonce',songs:['One']}
  assert.ok(matchesPostShowSetlist(concert,setlist))
  assert.ok(!matchesPostShowSetlist(concert,{...setlist,venue:'Other Arena'}))
  assert.ok(!matchesPostShowSetlist(concert,{...setlist,songs:[]}))
  assert.ok(canLogPostShow(concert,'2026-11-10'))
  assert.ok(!canLogPostShow({...concert,endDate:'2026-11-10'},'2026-11-10'))
  assert.deepEqual(recentShowsToLog([concert,{...concert,loggedAt:'2026-11-09'}],new Date(2026,10,10)),[concert])
})

test('Spotify reuse is limited to an unambiguous song and performer', () => {
  const existing=[{artist:'Band',setlist:[{name:'Song',spotifyId:'one'},{name:'Ambiguous',spotifyId:'a'},{name:'Ambiguous',spotifyId:'b'}]}]
  const lookup=indexSpotifyLinks(existing)
  assert.equal(lookup(' song ','BAND').id,'one')
  assert.equal(lookup('Song','Other'),undefined)
  assert.equal(lookup('Ambiguous','Band'),null)
  assert.equal(lookup({name:'Song',cover:'Other'},'Band'),undefined)
  const rows=reuseSpotifyLinks([{type:'section',label:'Encore'},{name:'Song',info:'Acoustic'}],'Band',existing)
  assert.equal(rows[0].label,'Encore')
  assert.equal(rows[1].spotifyId,'one')
  assert.equal(rows[1].info,'Acoustic')
})
