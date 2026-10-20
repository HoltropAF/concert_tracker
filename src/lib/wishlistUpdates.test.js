import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWishUpdates, checkWish, isSameWish, proposedChanges, safeTicketUrl } from './wishlistUpdates.js'

const event = { id: 'ticketmaster:1', artist: 'Artist', date: '2027-06-18', venue: 'Venue', city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', url: 'https://www.ticketmaster.nl/event/1', status: 'Check ticket site', source: 'Ticketmaster', checkedAt: '2026-10-20T12:00:00Z' }
test('artist-only wishes are possible matches, not confirmed shows', () => {
  assert.equal(isSameWish({ artist: 'Artist', date: '9999-12-31' }, event), false)
  assert.equal(isSameWish({ artist: 'Artist', date: event.date, venue: 'Venue' }, event), true)
  assert.equal(isSameWish({ artist: 'Another artist', date: event.date, venue: 'Venue' }, event), false)
  assert.equal(isSameWish({ discovery: { id: event.id } }, { ...event, date: '2027-06-20' }), true)
})
test('review only updates selected fields and preserves personal data and identity', () => {
  const wish = { id: 'mine', artist: 'My artist label', wishlist: true, date: '9999-12-31', notes: 'Standing only', tags: ['Favourite'], photo: 'photo.jpg', venue: 'My venue' }
  const updated = applyWishUpdates(wish, event, ['date', 'notes', 'artist'])
  assert.equal(updated.id, 'mine')
  assert.equal(updated.artist, 'My artist label')
  assert.equal(updated.date, event.date)
  assert.equal(updated.venue, 'My venue')
  assert.equal(updated.notes, 'Standing only')
  assert.equal(updated.photo, 'photo.jpg')
  assert.deepEqual(updated.tags, ['Favourite'])
  assert.equal(updated.wishlist, true)
  assert.equal(wish.date, '9999-12-31')
  assert.throws(() => applyWishUpdates({ ...wish, wishlist: false }, event, []))
})
test('missing fields never erase saved details; unsafe seller links cannot be imported', () => {
  const changes = proposedChanges({ venue: 'My venue' }, { ...event, venue: '', url: 'javascript:alert(1)' })
  assert.equal(changes.some(c => ['venue', 'ticketSaleLink'].includes(c.key)), false)
  assert.equal(safeTicketUrl('https://ticketmaster.nl.evil.example'), '')
})
test('checks paginate and distinguish empty results from provider failures', async () => {
  const pages = []
  const fetcher = async url => {
    const page = new URL(url, 'https://app.test').searchParams.get('page')
    pages.push(page)
    return { ok: true, json: async () => ({ events: page === '1' ? [] : [event], hasMore: page === '1', checkedAt: event.checkedAt }) }
  }
  const result = await checkWish({ artist: 'Artist', country: 'Netherlands' }, { fetcher })
  assert.deepEqual(pages, ['1', '2'])
  assert.equal(result.exact, false)
  assert.equal(result.events.length, 1)
  const empty = await checkWish({ artist: 'Artist' }, { fetcher: async () => ({ ok: true, json: async () => ({ events: [], hasMore: false }) }) })
  assert.equal(empty.status, 'empty')
  await assert.rejects(checkWish({ artist: 'Artist' }, { fetcher: async () => ({ ok: false, json: async () => ({ error: 'Source unavailable' }) }) }), /Source unavailable/)
})
