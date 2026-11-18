import test from 'node:test'
import assert from 'node:assert/strict'
import {requireUser,requireUserOrGuest,withinUserLimit,GUEST_PER_IP,GUEST_TOTAL} from '../../server/auth.js'
import {DEMO_TRIES,takeDemoTry,demoLimitMessage} from './api.js'

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
test('demo visitors get a small daily allowance per feature and IP',async()=>{
  const now=5e9,req=ip=>({headers:{'x-forwarded-for':ip+', 10.0.0.1'}})
  for(let i=0;i<GUEST_PER_IP;i++)assert.equal(await requireUserOrGuest(req('1.1.1.1'),response(),'venues',{now}),'guest')
  const res=response()
  assert.equal(await requireUserOrGuest(req('1.1.1.1'),res,'venues',{now}),null)
  assert.equal(res.code,429);assert.match(res.body.error,/Sign in/)
  assert.equal(await requireUserOrGuest(req('1.1.1.1'),response(),'setlist',{now}),'guest')
  assert.equal(await requireUserOrGuest(req('2.2.2.2'),response(),'venues',{now}),'guest')
  assert.equal(await requireUserOrGuest(req('1.1.1.1'),response(),'venues',{now:now+86400001}),'guest')
})
test('all demo visitors together cannot exceed the shared photo search cap',async()=>{
  const now=6e9
  let allowed=0
  for(let i=0;i<GUEST_TOTAL['artist-images']+5;i++)if(await requireUserOrGuest({headers:{'x-real-ip':'9.9.9.'+i}},response(),'artist-images',{now}))allowed++
  assert.equal(allowed,GUEST_TOTAL['artist-images'])
})
test('a signed-in header is always checked, never treated as a guest',async()=>{
  const res=response()
  assert.equal(await requireUserOrGuest({headers:{authorization:'Bearer short'}},res,'venues',{env}),null)
  assert.equal(res.code,401)
})
test('the browser allows 3 demo tries per feature, counting quick repeats as one',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
  let t=1e6
  for(let i=0;i<DEMO_TRIES;i++){assert.equal(takeDemoTry('setlist',storage,t),true);assert.equal(takeDemoTry('setlist',storage,t+5000),true);t+=60000}
  assert.equal(takeDemoTry('setlist',storage,t),false)
  assert.equal(takeDemoTry('venues',storage,t),true)
  assert.match(demoLimitMessage('setlist'),/3 demo tries of setlist search/)
})
