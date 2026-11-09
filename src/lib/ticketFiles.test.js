import test from 'node:test'
import assert from 'node:assert/strict'
import { ticketExpiry, ticketFileLimit, validateTicketFile } from './ticketFiles.js'

test('ticket attachments accept PDFs and images including mobile files with no MIME type', () => {
  assert.equal(validateTicketFile({ name: 'ticket.pdf', type: 'application/pdf', size: 500 }), '')
  assert.equal(validateTicketFile({ name: 'barcode.svg', type: '', size: 500 }), '')
  assert.equal(validateTicketFile({ name: 'ticket.HEIC', type: '', size: 500 }), '')
  assert.ok(validateTicketFile({ name: 'ticket.html', type: 'text/html', size: 500 }))
  assert.ok(validateTicketFile({ name: 'ticket.pdf', type: 'application/pdf', size: ticketFileLimit + 1 }))
})

test('ticket expiry uses the last day of a multi-day show', () => {
  assert.equal(ticketExpiry({ date: '2026-11-09', endDate: '2026-11-11' }), '2026-11-11')
  assert.equal(ticketExpiry({ date: '2026-11-09' }), '2026-11-09')
})
