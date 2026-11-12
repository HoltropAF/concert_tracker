export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
export function birthdaysToday(settings = {}, now = new Date()) {
  if (settings.notifyBirthdays === false) return []
  const monthDay = localDay(now).slice(5)
  const seen = new Set()
  return Object.entries(settings.artistCustomDates || {}).flatMap(([artist, dates]) =>
    (Array.isArray(dates) ? dates : []).flatMap(date => {
      if (!/birthday/i.test(date.label || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date.date || '') || date.date.slice(5) !== monthDay || date.date > localDay(now)) return []
      const name = date.label.replace(/(?:['’]s)?\s*birthday/ig, '').trim() || artist
      const key = (artist + ':' + name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}:]/gu, '')
      if (seen.has(key)) return []
      seen.add(key)
      return [{ key, artist, name }]
    }))
}
export function anniversaryShows(concerts, now = new Date()) {
  const today = localDay(now)
  return concerts.filter(concert => !concert.wishlist && /^\d{4}-\d{2}-\d{2}$/.test(concert.date || '')
    && concert.date < today && concert.date.slice(5) === today.slice(5))
}
export function showsToday(concerts, now = new Date()) {
  const day=localDay(now)
  const start=c=>/^([01]\d|2[0-3]):[0-5]\d$/.test(c.showTime||'')?new Date(`${day}T${c.showTime}:00`).getTime():null
  const rank=c=>{const t=start(c);return t===null?1:t>=now?0:2}
  return concerts.filter(c=>!c.wishlist && /^\d{4}-\d{2}-\d{2}$/.test(c.date||'') && c.date<=day && (c.endDate || c.date)>=day && c.date!=='9999-12-31').sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?start(b)-start(a):start(a)-start(b)))
}
export const defaultPreparationItems = ['Ticket ready', 'Travel planned', 'Power bank packed', 'Water bottle', 'Earplugs']

export function eveningPlanRows(concert, online) {
  if (Array.isArray(concert.eveningPlans)) return concert.eveningPlans
  const meetingPoint = concert.meetupLocation?.trim()
  if (online || !(concert.meetupTime || meetingPoint || concert.venue)) return []
  const destination = [meetingPoint || concert.venue, concert.city, concert.country].filter(Boolean).join(', ')
  return [{
    id: 'meet', time: concert.meetupTime || '',
    label: meetingPoint ? 'Meet at ' + meetingPoint : 'Meet at the entrance',
    link: destination ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination) : '',
    linkText: 'Directions',
  }]
}

export function eveningStops(concert, online) {
  const plans = eveningPlanRows(concert, online).filter(row => row.label?.trim() || row.time || row.note?.trim() || row.link?.trim())
  const end = concert.endTime ? { key: 'end', time: concert.endTime, label: 'Expected end' } : null
  const startsAt = concert.showTime || concert.doorsTime
  const endsNextDay = end && startsAt && end.time < startsAt
  const stops = [
    ...plans.map(row => ({ ...row, key: 'plan-' + row.id })),
    ...(concert.doorsTime ? [{ key: 'doors', time: concert.doorsTime, label: 'Doors open' }] : []),
    ...(concert.showTime ? [{ key: 'show', time: concert.showTime, label: 'Show starts' }] : []),
    ...(end && !endsNextDay ? [end] : []),
  ]
  const timed = stops.filter(stop => stop.time).sort((a, b) => a.time.localeCompare(b.time))
  let index = 0
  const ordered = stops.map(stop => stop.time ? timed[index++] : stop)
  return endsNextDay ? [...ordered, end] : ordered
}
export function preparationItems(settings={}){
 if (Array.isArray(settings.showChecklistItems)) {
   return [...new Set(settings.showChecklistItems.filter(item => typeof item === 'string' && item.trim()))]
 }
 return typeof settings.showChecklistText==='string'?[...new Set(settings.showChecklistText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))].slice(0,20):defaultPreparationItems
}
export function showCountdown(concert, now = new Date()) {
  if(!/^\d{2}:\d{2}$/.test(concert.showTime||''))return null
  const start=new Date(`${localDay(now)}T${concert.showTime}:00`)
  const mins=Math.ceil((start-now)/60000)
  if(!Number.isFinite(mins))return null
  if(mins<=0)return 'Show time!'
  return `${Math.floor(mins/60)}h ${mins%60}m until the show`
}
