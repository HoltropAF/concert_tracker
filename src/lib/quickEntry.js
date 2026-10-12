export function frequentVenues(concerts, limit = 4) {
  const counts = new Map()
  for (const c of concerts) {
    if (!c.venue || c.attendanceMode === 'online' || c.wishlist) continue
    const old = counts.get(c.venue) || {count:0,date:''}
    counts.set(c.venue,{count:old.count+1,date:old.date > c.date ? old.date : c.date || ''})
  }
  return [...counts].sort((a,b)=>b[1].count-a[1].count || b[1].date.localeCompare(a[1].date) || a[0].localeCompare(b[0])).slice(0,limit).map(([name])=>name)
}
