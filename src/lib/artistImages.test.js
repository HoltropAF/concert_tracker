import test from 'node:test'
import assert from 'node:assert/strict'
import {imageToken,tokenImage,searchArtistImages,downloadArtistImage} from '../../server/artistImages.js'
import handler from '../../api/artist-images.js'

test('image import requires an unmodified, unexpired signed public HTTPS URL',async()=>{
  const token=imageToken('https://images.example/photo.jpg','secret')
  assert.equal(tokenImage(token,'secret'),'https://images.example/photo.jpg')
  assert.throws(()=>tokenImage(token,'other'))
  assert.throws(()=>tokenImage(token+'x','secret'))
  assert.throws(()=>tokenImage(imageToken('https://images.example/a','secret',1),'secret'))
  assert.throws(()=>tokenImage(imageToken('https://127.0.0.1/a','secret'),'secret'))
  await assert.rejects(downloadArtistImage('http://localhost/a'))
})
test('search returns selectable photos without exposing the API key or unsafe URLs',async()=>{
  const images=await searchArtistImages('Artist','private-key',async url=>{
    const query=new URL(url).searchParams
    assert.equal(query.get('engine'),'google_images');assert.equal(query.get('q'),'Artist')
    return {ok:true,json:async()=>({images_results:[{title:'Photo',original:'https://image.example/a.jpg',thumbnail:'https://thumb.example/a.jpg',link:'https://source.example/page'},{original:'file:///private',thumbnail:'https://thumb.example/a',link:'https://source.example'}]})}
  })
  assert.equal(images.length,1)
  assert.equal(JSON.stringify(images).includes('private-key'),false)
  assert.equal(tokenImage(images[0].token,'private-key'),'https://image.example/a.jpg')
  await assert.rejects(searchArtistImages('Artist','secret',async()=>({ok:false,status:429})),/allowance/)
})
test('unconfigured photo search gives an actionable setup message',async()=>{
  const original=process.env.SERPAPI_API_KEY;delete process.env.SERPAPI_API_KEY
  try {
    const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}
    await handler({method:'GET',query:{q:'Artist'}},res)
    assert.equal(res.code,503);assert.match(res.body.error,/SERPAPI_API_KEY/)
  }finally{if(original!==undefined)process.env.SERPAPI_API_KEY=original}
})
