import test from 'node:test'
import assert from 'node:assert/strict'
import {matchesShowType,visibleSongTotals} from './filterTotals.js'

test('show and festival scopes do not mix appearances',()=>{
  const shows=[{id:1,type:'concert'},{id:2,type:'festival'},{id:3}]
  assert.deepEqual(shows.filter(s=>matchesShowType(s,'concerts')).map(s=>s.id),[1,3])
  assert.deepEqual(shows.filter(s=>matchesShowType(s,'festivals')).map(s=>s.id),[2])
  assert.equal(shows.filter(s=>matchesShowType(s,'all')).length,3)
})
test('song totals count only visible songs and deduplicate shared shows',()=>{
  const songs=[{artist:'A',showIds:['one','two']},{artist:'A',showIds:['two']},{artist:'B',showIds:['three']}]
  assert.deepEqual(visibleSongTotals(songs.slice(0,2)),{songs:2,shows:2,artists:1})
  assert.deepEqual(visibleSongTotals(songs),{songs:3,shows:3,artists:2})
  assert.deepEqual(visibleSongTotals([]),{songs:0,shows:0,artists:0})
})
