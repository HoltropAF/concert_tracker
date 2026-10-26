import test from 'node:test'
import assert from 'node:assert/strict'
import {searchVenues} from '../../server/venueSearch.js'
test('venue search fills named places and filters ambiguous cities',async()=>{
 const result=await searchVenues({name:'Arena',city:'Amsterdam',country:'NL'},'test-key',async url=>{
   const params=new URL(url).searchParams
   assert.equal(params.get('keyword'),'Arena');assert.equal(params.get('countryCode'),'NL')
   return {ok:true,json:async()=>({page:{totalElements:2},_embedded:{venues:[{id:'1',name:'Arena',city:{name:'Amsterdam'},country:{name:'Netherlands',countryCode:'NL'}},{id:'2',name:'Arena',city:{name:'London'}}]}})}
 })
 assert.equal(result.venues.length,1);assert.equal(result.venues[0].country,'Netherlands')
})
test('venue search distinguishes failures from a successful empty directory result',async()=>{
 const query={city:'Amsterdam'}
 assert.deepEqual((await searchVenues(query,'key',async()=>({ok:true,json:async()=>({page:{totalElements:0}})}))).venues,[])
 await assert.rejects(searchVenues(query,'key',async()=>({ok:false})))
 await assert.rejects(searchVenues(query,'key',async()=>({ok:true,json:async()=>({})})))
})
