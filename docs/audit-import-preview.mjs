import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/ConcertTracker.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const asArray = (value) =>');
const end = source.indexOf('  const handleImport = async', start);
assert.ok(start >= 0 && end > start);
const fixture = {id:'qa-preview', artist:'QA Band', date:'2026-09-21', wishlist:true, setlist:['Opening'], tickets:[{name:'GA',price:40}]};
let preview;
const writes = [];
const context = vm.createContext({settings:{},concerts:[fixture],setPendingImport:value=>{preview=value},setImportStatus(){},setImportMessage(){},setImportReport(){},onNotify(){},onSaveConcert:async c=>{writes.push(c);}});
vm.runInContext(`${source.slice(start,end)}; globalThis.stage = stageImport; globalThis.restore = doImport;`, context);
for (const [label, rows, expected] of [
  ['untouched backup', [fixture], [0,0,1]],
  ['changed note', [{...fixture,notes:'Updated memory'}], [0,1,0]],
  ['changed song', [{...fixture,setlist:['Different']}], [0,1,0]],
  ['new concert', [{...fixture,id:'qa-new'}], [1,0,0]],
]) {
  context.stage(JSON.parse(JSON.stringify(rows)));
  assert.deepEqual([preview.added,preview.changed,preview.unchanged],expected,label);
  console.log(`${label}: passed`);
  writes.length = 0;
  await context.restore(rows, 'replace');
  assert.equal(writes.length,expected[0]+expected[1],`${label}: writes match preview`);
}
writes.length = 0;
await context.restore([{...fixture,notes:'Keep original'}], 'merge');
assert.equal(writes.length,0,'Keep mine never overwrites existing records');
