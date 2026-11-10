const escape = value => String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'')
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value !== '9999-12-31' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
}
function nextDate(value) { const d=new Date(`${value}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10) }
const clock = /^([01]\d|2[0-3]):[0-5]\d$/
const countryZones = {
  nl:'Europe/Amsterdam', netherlands:'Europe/Amsterdam', nederland:'Europe/Amsterdam',
  be:'Europe/Brussels', belgium:'Europe/Brussels', belgië:'Europe/Brussels',
  de:'Europe/Berlin', germany:'Europe/Berlin', deutschland:'Europe/Berlin',
  fr:'Europe/Paris', france:'Europe/Paris', gb:'Europe/London', 'united kingdom':'Europe/London',
}

function utcEventTime(date,time,timeZone) {
  if (!timeZone) return ''
  try {
    const format = new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    const target = Date.parse(`${date}T${time}:00Z`)
    const wallTime = timestamp => {
      const {year,month,day,hour,minute} = Object.fromEntries(format.formatToParts(timestamp).map(part=>[part.type,part.value]))
      return Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute))
    }
    let timestamp = target
    for (let attempt=0;attempt<3;attempt++) {
      const difference = target-wallTime(timestamp)
      if (!difference) return new Date(timestamp).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
      timestamp += difference
    }
  } catch { /* Keep a floating time when the venue timezone is unknown or invalid. */ }
  return ''
}
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
  let description
  if(sale) {
    lines.push(`DTSTART:${start.replace(/[-:]/g,'')}00`,'DURATION:PT15M')
    description=[concert.ticketSaleLink,concert.ticketSaleNote,'Ticket-sale time is in your calendar’s local timezone.'].filter(Boolean).join('\n')
  } else {
    const lastDay = validDate(concert.endDate)&&concert.endDate>=start ? concert.endDate : start
    if(clock.test(concert.showTime || '')) {
      const timeZone = concert.timeZone || (concert.attendanceMode !== 'online' && countryZones[String(concert.country || '').trim().toLowerCase()])
      const hasEnd = clock.test(concert.endTime || '') && (lastDay !== start || concert.endTime !== concert.showTime)
      const endDay = lastDay===start && concert.endTime<concert.showTime ? nextDate(lastDay) : lastDay
      const utcStart = utcEventTime(start,concert.showTime,timeZone)
      const utcEnd = hasEnd ? utcEventTime(endDay,concert.endTime,timeZone) : ''
      const useUtc = utcStart && (!hasEnd || utcEnd)
      const floating = (date,time) => `${date.replaceAll('-','')}T${time.replace(':','')}00`
      lines.push('DTSTART:'+(useUtc ? utcStart : floating(start,concert.showTime)))
      if(hasEnd)lines.push('DTEND:'+(useUtc ? utcEnd : floating(endDay,concert.endTime)))
      description=['Saved from SetTracker.',clock.test(concert.doorsTime || '')?'Doors open: '+concert.doorsTime:'',useUtc?'':'Times use your calendar’s local timezone.'].filter(Boolean).join('\n')
    } else {
      lines.push(`DTSTART;VALUE=DATE:${start.replaceAll('-','')}`,`DTEND;VALUE=DATE:${nextDate(lastDay).replaceAll('-','')}`)
      description='Saved from SetTracker. All-day event; check your ticket for doors and show times.'
    }
  }
  lines.push(`LOCATION:${escape(concert.attendanceMode==='online'?concert.platform:[concert.venue,concert.city,concert.country].filter(Boolean).join(', '))}`,`DESCRIPTION:${escape(description)}`,'END:VEVENT','END:VCALENDAR')
  return lines.map(fold).join('\r\n')+'\r\n'
}
