import { validDate } from './calendar.js'
import { localDay } from './showDay.js'
import { setlistSongs } from './setlistRows.js'

const matchKey = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()

export function matchesPostShowSetlist(concert, result) {
  return result.date === concert.date && matchKey(result.artist) === matchKey(concert.artist)
    && (!concert.venue || matchKey(result.venue) === matchKey(concert.venue))
    && (!concert.city || matchKey(result.city) === matchKey(concert.city))
    && setlistSongs(result.songs).length > 0
}

export function canLogPostShow(concert, today = localDay()) {
  const end = concert.endDate || concert.date
  return !concert.wishlist && !concert.loggedAt && validDate(end) && end < today
    && !/cancelled|postponed/i.test(concert.discovery?.status || '')
    && (!!concert.bookedAt || !setlistSongs(concert.setlist).length)
}

export function recentShowsToLog(concerts, now = new Date()) {
  const earliest = new Date(now)
  earliest.setDate(earliest.getDate() - 14)
  return concerts.filter(concert => canLogPostShow(concert,localDay(now))
    && (concert.endDate || concert.date) >= localDay(earliest)
    && (concert.bookedAt || (!concert.rating && !concert.notes)))
    .sort((a,b) => (b.endDate || b.date).localeCompare(a.endDate || a.date))
}
