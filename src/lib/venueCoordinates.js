export function validCoordinates(lat,lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 && typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
}
export function parseCoordinates(lat,lng) {
  if (String(lat).trim() === '' || String(lng).trim() === '') return null
  const point = {lat:Number(lat),lng:Number(lng)}
  return validCoordinates(point.lat,point.lng) ? point : null
}
export function venueLocations(concerts, savedVenues = []) {
  const venues = new Map()
  for (const c of concerts) {
    if (c.attendanceMode === 'online' || !c.venue) continue
    venues.set(c.venue,{name:c.venue,city:c.city || '',country:c.country || ''})
  }
  for (const v of savedVenues) if(v.name && !venues.has(v.name)) venues.set(v.name,v)
  return [...venues.values()].sort((a,b)=>a.name.localeCompare(b.name))
}
