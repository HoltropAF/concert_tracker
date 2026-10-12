// Free geocoding via Nominatim (OpenStreetMap's search API) — no API key,
// no billing account. Usage policy: max ~1 request/second, which is a
// non-issue here since this only fires when a genuinely new venue is saved.
// https://operations.osmfoundation.org/policies/nominatim/

// * Returns { lat, lng } or null. Null covers everything — no match, a network
// * failure, a rate-limit rejection — because the only caller (maybeGeocodeVenue in
// * ConcertTracker) treats the whole operation as optional enrichment and must never
// * surface an error to the user mid-save.
import {parseCoordinates} from './venueCoordinates.js'
let tail = Promise.resolve()
let lastStart = 0
export function geocodeVenue(name, city, country) {
  const query = [name, city, country].filter(Boolean).join(', ')
  if (!query) return Promise.resolve(null)
  const job = tail.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastStart))
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    lastStart = Date.now()
    return lookup(query)
  })
  tail = job.catch(() => null)
  return job
}

async function lookup(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const results = await res.json()
    if (!results || results.length === 0) return null
    const { lat, lon } = results[0]
    return parseCoordinates(lat, lon)
  } catch {
    return null // best-effort — a failed geocode should never block saving a show
  }
}
