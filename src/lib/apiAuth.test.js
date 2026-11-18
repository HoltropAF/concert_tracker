import test from 'node:test'
import assert from 'node:assert/strict'
import {requireUser,withinUserLimit} from '../../server/auth.js'
import setlist from '../../api/setlist.js'
import artistImages from '../../api/artist-images.js'

const env={VITE_SUPABASE_URL:'https://demo.supabase.co/',VITE_SUPABASE_ANON_KEY:'anon'}
const response=()=>{const res={status(code){res.code=code;return res},json(body){res.body=body;return res}};return res}
const token='a'.repeat(40)

test('requests without a sign-in token are refused before any lookup',async()=>{
  const res=response();let called=false
  assert.equal(await requireUser({headers:{}},res,{env,fetcher:async()=>{called=true}}),null)
  assert.equal(res.code,401);assert.equal(called,false)
})
test('a token Supabase rejects is refused',async()=>{
  const res=response()
  assert.equal(await requireUser({headers:{authorization:'Bearer '+'b'.repeat(40)}},res,{env,fetcher:async()=>({ok:false,status:401})}),null)
  assert.equal(res.code,401)
})
test('a valid token returns the user id and is checked against this project',async()=>{
  const res=response();let seen
  const user=await requireUser({headers:{authorization:'Bearer '+token}},res,{env,fetcher:async(url,opts)=>{seen={url,opts};return {ok:true,status:200,json:async()=>({id:'user-1'})}}})
  assert.equal(user,'user-1');assert.equal(seen.url,'https://demo.supabase.co/auth/v1/user');assert.equal(seen.opts.headers.apikey,'anon')
})
test('missing Supabase settings fail closed',async()=>{
  const res=response()
  assert.equal(await requireUser({headers:{authorization:'Bearer '+'c'.repeat(40)}},res,{env:{}}),null)
  assert.equal(res.code,503)
})
test('each user has their own allowance',()=>{
  const now=1e6
  for(let i=0;i<3;i++)assert.equal(withinUserLimit('u1','t',3,60000,now),true)
  assert.equal(withinUserLimit('u1','t',3,60000,now),false)
  assert.equal(withinUserLimit('u2','t',3,60000,now),true)
  assert.equal(withinUserLimit('u1','t',3,60000,now+61000),true)
})
test('the quota-spending endpoints refuse callers who are not signed in',async()=>{
  for(const handler of [setlist,artistImages]){
    const res=response();res.setHeader=()=>{};let called=false;const original=global.fetch
    global.fetch=async()=>{called=true;throw Error('no network in tests')}
    try{await handler({method:'GET',headers:{},query:{artist:'Band',search:'1',q:'Band'}},res)}finally{global.fetch=original}
    assert.equal(res.code,401);assert.equal(called,false)
  }
})
