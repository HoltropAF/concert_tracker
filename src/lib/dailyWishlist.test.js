import test from 'node:test'
import assert from 'node:assert/strict'
import {claimDailyCheck,localDay,readDailyCheck} from './dailyWishlist.js'
test('daily checks survive reloads, separate accounts, and reset on the next local day',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}
 assert.equal(claimDailyCheck(storage,'A','2026-10-26'),true)
 assert.equal(claimDailyCheck(storage,'A','2026-10-26'),false)
 assert.equal(claimDailyCheck(storage,'B','2026-10-26'),true)
 assert.equal(claimDailyCheck(storage,'A','2026-10-27'),true)
 values.set('A','broken');assert.equal(readDailyCheck(storage,'A'),null)
 assert.equal(localDay(new Date(2026,9,26,0,1)),'2026-10-26')
})
