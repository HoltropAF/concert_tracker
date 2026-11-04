import test from 'node:test'
import assert from 'node:assert/strict'
import {yearShowCounts} from './yearShowCounts.js'
test('yearly chart includes future years separately without wishes or unknown dates',()=>{
  const result=yearShowCounts([{date:'2026-02-01'},{date:'2026-12-01'},{date:'2027-05-01'},{date:'2027-05-02',wishlist:true},{date:'9999-12-31'},{date:''}],date=>date<'2026-11-02')
  assert.deepEqual(result,{'2026':{past:1,upcoming:1},'2027':{past:0,upcoming:1}})
})
