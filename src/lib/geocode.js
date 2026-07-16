// Free geocoding via Nominatim (OpenStreetMap's search API) — no API key,
// no billing account. Usage policy: max ~1 request/second, which is a
// non-issue here since this only fires when a genuinely new venue is saved.
// https://operations.osmfoundation.org/policies/nominatim/

export async function geocodeVenue(name, city, country) {
  const query = [name, city, country].filter(Boolean).join(', ')
  if (!query) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const results = await res.json()
    if (!results || results.length === 0) return null
    const { lat, lon } = results[0]
    return { lat: parseFloat(lat), lng: parseFloat(lon) }
  } catch {
    return null // best-effort — a failed geocode should never block saving a show
  }
}
