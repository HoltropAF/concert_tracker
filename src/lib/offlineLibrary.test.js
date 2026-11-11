import test from 'node:test'
import assert from 'node:assert/strict'
import { acknowledgeOperation, applyFields, changedFields, libraryValue } from './offlineLibrary.js'

test('offline changes retain other devices’ object fields and keep setlist order', () => {
  const before = { notes: 'old', venueInfo: { Arena: { city: 'Amsterdam', room: 'Main' } }, setlist: ['One'] }
  const local = { notes: 'my edit', venueInfo: { Arena: { city: 'Amsterdam' } }, setlist: ['Two', 'One'] }
  const server = { ...before, venueInfo: { Arena: { ...before.venueInfo.Arena, lat: 52.3 }, Club: { city: 'Utrecht' } }, rating: 5 }
  assert.deepEqual(applyFields(server, changedFields(before, local)), {
    notes: 'my edit', venueInfo: { Arena: { city: 'Amsterdam', lat: 52.3 }, Club: { city: 'Utrecht' } },
    setlist: ['Two', 'One'], rating: 5,
  })
})

test('a restart replays local add, delete and edits over a refreshed server snapshot', () => {
  const original = { id: 'show', artist: 'Original', date: '2026-11-10', notes: 'old' }
  const added = { id: 'new', artist: 'New', date: '2026-12-10' }
  const edit = { id: 'edit', entity: 'show', changes: changedFields(original, { ...original, notes: 'offline' }), initial: original }
  const add = { id: 'add', entity: 'new', changes: changedFields({}, added), initial: {} }
  const remove = { id: 'remove', entity: 'delete', remove: true }
  const snapshot = { value: [{ ...original, rating: 5 }, { id: 'delete', date: '2025-10-01' }], pending: [edit, add, remove] }
  assert.deepEqual(libraryValue(structuredClone(snapshot), 'concerts'), [added, { ...original, notes: 'offline', rating: 5 }])
  const written = { ...original, notes: 'offline', rating: 5 }
  const acknowledged = acknowledgeOperation(snapshot, 'concerts', edit, written)
  assert.deepEqual(acknowledged.pending, [add, remove])
  assert.equal(acknowledgeOperation(acknowledged, 'concerts', edit, written), acknowledged)
  assert.deepEqual(libraryValue(acknowledged, 'concerts'), libraryValue(snapshot, 'concerts'))
})

test('nested keys such as __proto__ remain plain data', () => {
  const next = JSON.parse('{"__proto__":{"tag":"demo"}}')
  const result = applyFields({}, changedFields({}, next))
  assert.equal(Object.getPrototypeOf(result), Object.prototype)
  assert.deepEqual(result, next)
})
