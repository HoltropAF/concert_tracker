import assert from 'node:assert/strict'
import { createLibraryRemote } from '../src/lib/libraryRemote.js'

const user = 'qa'
const normalize = (value, id) => value ? { ...value, ...(id ? { id } : {}) } : {}

function clientFor(finish) {
  return {
    from(table) {
      const filters = {}
      let action = 'read', body, range
      const query = {
        select() { return this },
        eq(key, value) { filters[key] = value; return this },
        is(key, value) { filters[key] = value; return this },
        order() { return this },
        range(from, to) { range = [from, to]; return this },
        abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return this },
        insert(value) { action = 'insert'; body = value; return this },
        update(value) { action = 'update'; body = value; return this },
        delete() { action = 'delete'; return this },
        maybeSingle() { return this },
        then(resolve, reject) {
          return Promise.resolve().then(() => finish({ table, action, body, filters, range })).then(resolve, reject)
        },
      }
      return query
    },
  }
}

for (const domain of ['concerts', 'settings']) {
  for (const mode of ['error', 'reject', 'empty', 'data']) {
    const data = domain === 'concerts' ? [{ id: 'show', data: { date: '2026-11-10' } }] : { data: { theme: 'saved' } }
    const remote = createLibraryRemote(clientFor(query => {
      assert.equal(query.filters.user_id, user)
      if (mode === 'error') return { error: new Error('read denied') }
      if (mode === 'reject') throw new Error('offline')
      return { data: mode === 'empty' ? (domain === 'concerts' ? [] : null) : data }
    }), user, domain, normalize)
    if (['error', 'reject'].includes(mode)) await assert.rejects(remote.load())
    else assert.deepEqual(await remote.load(), mode === 'empty'
      ? (domain === 'concerts' ? [] : {})
      : (domain === 'concerts' ? [{ id: 'show', date: '2026-11-10' }] : { theme: 'saved' }))
    console.log(`${domain} ${mode}: passed`)
  }
}

let version = 'remote-1'
let reads = 0
const remote = createLibraryRemote(clientFor(query => {
  assert.equal(query.filters.user_id, user)
  assert.equal(query.filters.id, 'show')
  if (query.action === 'read') return { data: { data: { notes: 'old', rating: ++reads }, updated_at: version } }
  assert.equal(query.action, 'update')
  assert.equal(query.filters.updated_at, version)
  assert.equal(query.body.data.rating, reads)
  if (reads === 1) {
    version = 'remote-2'
    return { data: [] }
  }
  return { data: [{ user_id: user }] }
}), user, 'concerts', normalize)
assert.deepEqual(await remote.save({ entity: 'show', changes: [{ key: 'notes', value: 'offline edit' }] }),
  { id: 'show', notes: 'offline edit', rating: 2 })
assert.equal(reads, 2)

const deleted = createLibraryRemote(clientFor(() => ({ data: null })), user, 'concerts', normalize)
assert.equal(await deleted.save({ entity: 'show', remove: true }), null)
console.log('concurrent update and repeat deletion: passed')
