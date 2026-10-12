import {useState} from 'react'
import {concertCalendar,validDate} from '../lib/calendar'
export default function CalendarExport({concert}) {
  const [message,setMessage]=useState('')
  const download=kind=>{
    try {
      const url=URL.createObjectURL(new Blob([concertCalendar(concert,kind)],{type:'text/calendar;charset=utf-8'}))
      const a=document.createElement('a');a.href=url;a.download=`settracker-${kind}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)
      setMessage('Open the downloaded .ics file in your calendar. This is a one-time export; changes will not sync automatically.')
    } catch(e){setMessage(e.message)}
  }
  if(!validDate(concert.date)&&!concert.ticketSaleAt)return null
  return <details><summary>Add to calendar</summary><div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
    {validDate(concert.date)&&<button onClick={()=>download('show')}>Download concert event (.ics)</button>}
    {concert.ticketSaleAt&&<button onClick={()=>download('sale')}>Download ticket-sale event (.ics)</button>}
  </div><p style={{fontSize:12}}>Concerts are all-day events. Ticket-sale times use your calendar’s local timezone.</p>{message&&<p role="status">{message}</p>}</details>
}
