export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
export function showsToday(concerts, now = new Date()) {
  const day=localDay(now)
  return concerts.filter(c=>!c.wishlist && /^\d{4}-\d{2}-\d{2}$/.test(c.date||'') && c.date<=day && (c.endDate || c.date)>=day && c.date!=='9999-12-31')
}
export function showCountdown(concert, now = new Date()) {
  if(!/^\d{2}:\d{2}$/.test(concert.showTime||''))return null
  const start=new Date(`${localDay(now)}T${concert.showTime}:00`)
  const mins=Math.ceil((start-now)/60000)
  if(!Number.isFinite(mins))return null
  if(mins<=0)return 'Show time!'
  return `${Math.floor(mins/60)}h ${mins%60}m until the show`
}
