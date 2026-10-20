import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { randomUUID } from 'node:crypto'

test('replacing a concert photo preserves the original file and uses a new path', async () => {
  const files = new Map()
  let source = readFileSync(new URL('./photos.js', import.meta.url), 'utf8')
    .replace("import { supabase } from './supabase'", '')
    .replaceAll('export ', '')
  source += '\nresizeImage = async file => file; globalThis.upload = uploadConcertPhoto; globalThis.remove = deleteConcertPhoto;'
  const context = vm.createContext({
    crypto: { randomUUID },
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
      storage: { from: () => ({
        upload: async (path, data, options) => {
          assert.equal(options.upsert, false)
          files.set(path, data)
          return { error: null }
        },
        remove: async paths => { paths.forEach(path => files.delete(path)); return { error: null } },
      }) },
    },
  })
  vm.runInContext(source, context)
  const old = await context.upload('concert', 'original')
  const replacement = await context.upload('concert', 'replacement')
  assert.notEqual(old, replacement)
  assert.equal(files.get(old), 'original')
  await context.remove(old)
  assert.equal(files.get(replacement), 'replacement')
})
