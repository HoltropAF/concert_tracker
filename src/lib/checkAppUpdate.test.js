import test from 'node:test'
import assert from 'node:assert/strict'
import { checkAppUpdate } from './checkAppUpdate.js'

test('update checks distinguish current, waiting, offline and unavailable', async () => {
  assert.equal(await checkAppUpdate({ update: async () => {} }), 'current')
  assert.equal(await checkAppUpdate({ update: async () => {}, waiting: {} }), 'found')
  assert.equal(await checkAppUpdate(null, { online: false }), 'offline')
  assert.equal(await checkAppUpdate(null), 'unsupported')
  assert.equal(await checkAppUpdate({ update: async () => { throw Error('network') } }), 'failed')
})

test('checks wait for installation instead of prematurely claiming current', async () => {
  const worker = new EventTarget()
  worker.state = 'installing'
  const reg = { installing: worker, update: async () => {} }
  const result = checkAppUpdate(reg)
  setTimeout(() => { reg.waiting = worker; worker.state = 'installed'; worker.dispatchEvent(new Event('statechange')) }, 5)
  assert.equal(await result, 'found')
})

test('stalled update checks time out', async () => {
  assert.equal(await checkAppUpdate({ update: () => new Promise(() => {}) }, { timeout: 5 }), 'failed')
})
