import test from 'node:test'
import assert from 'node:assert/strict'
import {createSaveQueue} from './saveQueue.js'

test('background writes do not trigger or restart explicit save feedback', async () => {
  let status
  const queue = createSaveQueue(value => { status = value })
  await queue.run('navigation', async () => ({}))
  assert.equal(status.visiblePending, 0)
  assert.equal(status.savedVersion, 0)
  const saving = queue.run('concert', async () => ({}), {notify:true})
  assert.equal(status.visiblePending, 1)
  await saving
  assert.equal(status.visiblePending, 0)
  assert.equal(status.savedVersion, 1)
  await queue.run('geocode', async () => ({}))
  assert.equal(status.savedVersion, 1)
})

test('background failures remain visible and retry gives explicit feedback', async () => {
  let status, attempts = 0
  const queue = createSaveQueue(value => { status = value })
  await queue.run('setting', async () => ({error: attempts++ === 0 ? new Error('offline') : null}))
  assert.equal(status.failed, 1)
  assert.equal(status.savedVersion, 0)
  await queue.retry()
  assert.equal(status.failed, 0)
  assert.equal(status.savedVersion, 1)
})
