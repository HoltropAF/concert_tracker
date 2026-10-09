import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../src/hooks/useSupabase.js', import.meta.url), 'utf8');
for (const name of ['Concerts','Settings']) {
  const start = source.indexOf(`  const load${name} = async () =>`);
  const end = source.indexOf(name === 'Concerts' ? '  const seedConcerts' : '  const saveSettings', start);
  assert.ok(start >= 0 && end > start);
  for (const mode of ['error','reject','empty','data']) {
    let error, loaded, value = 'cached';
    const result = mode === 'error' ? {error:new Error('read denied')} : {data:mode === 'empty' ? (name === 'Concerts' ? [] : null) : (name === 'Concerts' ? [{id:'qa',data:{date:'2026-09-21'}}] : {data:{theme:'saved'}})};
    const query = {select(){return this},eq(){return this},order:finish,maybeSingle:finish};
    function finish(){return mode === 'reject' ? Promise.reject(new Error('offline')) : Promise.resolve(result)}
    const context = {isSupabaseConfigured:true,userId:'qa',supabase:{from:()=>query},SEED_DATA:[],normalizeConcert:x=>x,normalizeSettings:x=>x || {theme:'default'},settingsRef:{},writeCache(){},setConcerts:x=>{value=x},setSettings:x=>{value=x},setLoadError:x=>{error=x},setLoaded:x=>{loaded=x}};
    await vm.runInNewContext(`${source.slice(start,end)}; load${name}()`,context);
    assert.equal(loaded,true);
    if (['error','reject'].includes(mode)) {assert.ok(error);assert.equal(value,'cached')}
    else {assert.equal(error,null);assert.notEqual(value,'cached')}
    console.log(`${name} ${mode}: passed`);
  }
}
