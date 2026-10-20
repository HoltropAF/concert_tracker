import test from 'node:test'
import assert from 'node:assert/strict'
import { withCriedTag } from './criedTag.js'

test('song and MENT memories add Cried without losing other tags', () => {
  for (const memory of [
    { criedSong: 'Haven' },
    { setlist: [{ type: 'section', label: 'MENT', cried: true }] },
    { supportSetlists: { Opener: [{ type: 'section', label: 'MENT', cried: true }] } },
  ]) assert.deepEqual(withCriedTag({ tags: ['Favourite'], ...memory }).tags, ['Favourite', 'Cried'])
})

test('no duplicates, no tag for notes alone, and no removal of manual tags', () => {
  const tagged = { tags: ['Cried'], criedSong: 'Haven' }
  assert.equal(withCriedTag(tagged), tagged)
  assert.deepEqual(withCriedTag({ setlist: [{ sectionNote: 'A funny story', cried: false }] }).tags, undefined)
  assert.deepEqual(withCriedTag({ tags: ['Cried'], criedSong: null }).tags, ['Cried'])
})
