export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
export function showsToday(concerts, now = new Date()) {
  const day=localDay(now)
  const start=c=>/^([01]\d|2[0-3]):[0-5]\d$/.test(c.showTime||'')?new Date(`${day}T${c.showTime}:00`).getTime():null
  const rank=c=>{const t=start(c);return t===null?1:t>=now?0:2}
  return concerts.filter(c=>!c.wishlist && /^\d{4}-\d{2}-\d{2}$/.test(c.date||'') && c.date<=day && (c.endDate || c.date)>=day && c.date!=='9999-12-31').sort((a,b)=>rank(a)-rank(b)||(rank(a)===2?start(b)-start(a):start(a)-start(b)))
}
export const defaultPreparationItems = ['Ticket ready', 'Travel planned', 'Power bank packed', 'Water bottle', 'Earplugs']
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
