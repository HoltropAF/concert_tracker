import { discoveryCountry, wishlistDraft } from './discovery.js'
import { validDate } from './calendar.js'

const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const updateFields = { date: 'Show date', venue: 'Venue', city: 'City', country: 'Country', ticketSaleAt: 'Ticket sale (your local time)', ticketSaleLink: 'Ticket seller' }
export function safeTicketUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /(^|\.)ticketmaster\.(nl|be|de|fr|com|co\.uk)$/i.test(url.hostname) ? url.href : ''
  } catch { return '' }
}
export function isSameWish(concert, event) {
  if (concert.discovery?.id === event.id) return true
  return validDate(concert.date) && concert.date === event.date &&
    normalize(concert.artist) === normalize(event.artist) &&
    !!normalize(concert.venue) && normalize(concert.venue) === normalize(event.venue)
}
export function proposedChanges(concert, event) {
  const draft = wishlistDraft(event)
  draft.ticketSaleLink = safeTicketUrl(event.url)
  return Object.entries(updateFields).flatMap(([key, label]) => {
    const value = draft[key]
    const current = key === 'date' && !validDate(concert.date) ? '' : concert[key] || ''
    if (!value || current === value || (key === 'date' && !validDate(value))) return []
    return [{ key, label, before: current, after: value }]
  })
}
export function applyWishUpdates(concert, event, selected) {
  if (!concert.wishlist) throw Error('This show is no longer in Want to go.')
  const changes = proposedChanges(concert, event).filter(change => selected.includes(change.key))
  return {
    ...concert,
    ...Object.fromEntries(changes.map(change => [change.key, change.after])),
    discovery: {
      ...concert.discovery, id: event.id, source: event.source, url: safeTicketUrl(event.url),
      status: event.status, checkedAt: event.checkedAt,
    },
  }
}
export async function checkWish(concert, { fetcher = fetch, signal, now = new Date() } = {}) {
  if (!String(concert.artist || '').trim()) throw Error('Add an artist before checking.')
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const query = { artist: concert.artist, country: discoveryCountry(concert.country), today }
  const events = new Map()
  let checkedAt, hasMore = false
  // Bounded, sequential pagination; no unsupported venue/date assumptions.
  for (let page = 1; page <= 5; page++) {
    const response = await fetcher(`/api/upcoming?${new URLSearchParams({ ...query, page: String(page) })}`, { signal })
    const data = await response.json()
    if (!response.ok || !Array.isArray(data.events)) throw Error(data.error || 'Could not check the ticket source.')
    checkedAt = data.checkedAt
    for (const event of data.events) {
      if (typeof event.artist !== 'string' || !event.id || !safeTicketUrl(event.url)) continue
      events.set(event.id, event)
    }
    hasMore = data.hasMore
    if (!hasMore) break
  }
  const candidates = [...events.values()]
  const exact = candidates.filter(event => isSameWish(concert, event))
  return { events: exact.length ? exact : candidates, exact: exact.length === 1, checkedAt, limited: hasMore, status: candidates.length ? 'found' : 'empty' }
}
