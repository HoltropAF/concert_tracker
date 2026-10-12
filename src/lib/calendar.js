const escape = value => String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'')
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value !== '9999-12-31' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
}
function nextDate(value) { const d=new Date(`${value}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10).replaceAll('-','') }
function fold(line) {
  const lines=[];let part='',bytes=0
  for(const char of line) {const n=new TextEncoder().encode(char).length;if(bytes+n>75){lines.push(part);part=' ';bytes=1}part+=char;bytes+=n}
  lines.push(part);return lines.join('\r\n')
}
export function concertCalendar(concert,kind='show',now=new Date()) {
  const sale=kind === 'sale'
  if(!validDate(sale?concert.ticketSaleAt?.slice(0,10):concert.date)) throw Error('Add a valid date before exporting to your calendar.')
  const start=sale?concert.ticketSaleAt:concert.date
  if(sale && !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(start)) throw Error('Add a valid ticket-sale time first.')
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SetTracker//Concerts//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${encodeURIComponent(concert.id)}-${kind}@settracker`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`SUMMARY:${escape((sale?'Tickets: ':'')+concert.artist)}`]
  if(sale) lines.push(`DTSTART:${start.replace(/[-:]/g,'')}00`,'DURATION:PT15M')
  else lines.push(`DTSTART;VALUE=DATE:${start.replaceAll('-','')}`,`DTEND;VALUE=DATE:${nextDate(validDate(concert.endDate)&&concert.endDate>=start?concert.endDate:start)}`)
  lines.push(`LOCATION:${escape(concert.attendanceMode==='online'?concert.platform:[concert.venue,concert.city,concert.country].filter(Boolean).join(', '))}`,`DESCRIPTION:${escape(sale ? [concert.ticketSaleLink,concert.ticketSaleNote,'Ticket-sale time is in your calendar’s local timezone.'].filter(Boolean).join('\n') : 'Saved from SetTracker. All-day event; check your ticket for doors and show times.')}`,'END:VEVENT','END:VCALENDAR')
  return lines.map(fold).join('\r\n')+'\r\n'
}
