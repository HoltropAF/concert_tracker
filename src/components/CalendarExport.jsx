import {useState} from 'react'
import {concertCalendar,validDate} from '../lib/calendar'
export default function CalendarExport({concert}) {
  const [message,setMessage]=useState('')
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const lastDay = validDate(concert.endDate) && concert.endDate >= concert.date ? concert.endDate : concert.date
  const showAvailable = validDate(concert.date) && lastDay >= today
  const saleAvailable = validDate(concert.ticketSaleAt?.slice(0,10)) && new Date(concert.ticketSaleAt) > now
  const download=kind=>{
    try {
      const url=URL.createObjectURL(new Blob([concertCalendar(concert,kind)],{type:'text/calendar;charset=utf-8'}))
      const a=document.createElement('a');a.href=url;a.download=`settracker-${kind}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)
      setMessage('Open the downloaded .ics file in your calendar. This is a one-time export; changes will not sync automatically.')
    } catch(e){setMessage(e.message)}
  }
  if(!showAvailable && !saleAvailable)return null
  const button={display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',minHeight:48,background:'none',border:0,borderBottom:'1px solid #25243a',padding:'10px 0',color:'#a78bfa',fontSize:13,textAlign:'left',cursor:'pointer'}
  return <section style={{background:'#13131f',border:'1px solid #1f1f35',borderRadius:10,padding:14}}><div style={{fontSize:10,color:'#6b6a8f',fontFamily:"'DM Mono', monospace",textTransform:'uppercase',marginBottom:6}}>Calendar</div>
    {showAvailable&&<button style={button} onClick={()=>download('show')}>Add concert to calendar<span aria-hidden="true">↓</span></button>}
    {saleAvailable&&<button style={button} onClick={()=>download('sale')}>Add ticket sale to calendar<span aria-hidden="true">↓</span></button>}
    <p style={{fontSize:11,lineHeight:1.6,color:'#9491b8',marginTop:10}}>Downloads an .ics file. Concerts are all-day events; check the timetable for exact times.</p>{message&&<p role="status" style={{fontSize:11,lineHeight:1.6,color:'#c4c2f0',marginTop:8}}>{message}</p>}</section>
}
