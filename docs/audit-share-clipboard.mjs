import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/ConcertTracker.jsx', import.meta.url), 'utf8');
const blocks = [...source.matchAll(/try \{\s*if \(!navigator\.clipboard\?\.writeText\)[\s\S]*?onNotify\('Could not copy text\. Allow clipboard access and try again\.'\);\s*\}/g)];
assert.equal(blocks.length, 2, 'Concert and friend sharing both handle clipboard errors');
for (const [index, [block]] of blocks.entries()) {
  for (const mode of ['success', 'denied', 'unavailable']) {
    const messages = [];
    let written;
    const navigator = mode === 'unavailable' ? {} : { clipboard: { async writeText(text) {
      if (mode === 'denied') throw new Error('NotAllowedError');
      written = text;
    } } };
    await vm.runInNewContext(`(async () => { ${block} })()`, {
      navigator, lines: ['QA concert', null, 'QA song'], onNotify: text => messages.push(text),
    });
    assert.deepEqual(messages, [mode === 'success' ? 'Copied share text' : 'Could not copy text. Allow clipboard access and try again.']);
    if (mode === 'success') assert.equal(written, 'QA concert\nQA song');
    console.log(`Share ${index + 1}: ${mode} passed`);
  }
}
