import {validDate} from './calendar.js'
import {performanceSongs} from './setlistRows.js'

export const referenceFields=['artist','date','venue','city','country','tour','spotifyUrl','youtubeUrl']
export function mediaUrl(value,kind){
  const safe=referenceUrl(value||'');if(!safe)return ''
  const host=new URL(safe).hostname
  if(kind==='spotifyUrl'&&host==='open.spotify.com'||kind==='youtubeUrl'&&['youtube.com','www.youtube.com','music.youtube.com','youtu.be'].includes(host))return safe
  throw Error(kind==='spotifyUrl'?'Use an open.spotify.com link.':'Use a youtube.com or youtu.be link.')
}
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const name=s=>typeof s==='string'?s:s?.name||''
export function referenceUrl(value){
  if(!value.trim())return ''
  try{const url=new URL(value);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)return url.href}catch{}
  throw Error('Enter a valid source link starting with https:// or leave it blank.')
}
export function parseReference(text){
  if(text.length>50000)throw Error('Paste one concert at a time (up to 50,000 characters).')
  let input={}
  if(text.trim().startsWith('{')){
    try{input=JSON.parse(text)}catch{throw Error('The pasted JSON is not valid.')}
  }else{
    let songs=false
    for(const line of text.split(/\r?\n/)){
      const field=line.match(/^\s*(artist|band|date|venue|city|country|tour|setlist|songs|spotify|youtube|spotifyUrl|youtubeUrl)\s*:\s*(.*)$/i)
      if(field){const raw=field[1].toLowerCase(),key={band:'artist',spotify:'spotifyUrl',spotifyurl:'spotifyUrl',youtube:'youtubeUrl',youtubeurl:'youtubeUrl'}[raw]||raw;songs=['setlist','songs'].includes(key);if(songs){input.setlist=[];if(field[2])input.setlist.push(field[2])}else input[key]=field[2];continue}
      if(songs&&line.trim())input.setlist.push(line.trim().replace(/^(?:\d+[.)]\s*|[-•]\s+)/,''))
    }
  }
  const result=Object.fromEntries(referenceFields.map(key=>[key,typeof input[key]==='string'?input[key].trim().slice(0,300):'']))
  const songs=input.setlist||input.songs||[]
  if(!Array.isArray(songs)||songs.length>300)throw Error('Use a list of up to 300 song titles.')
  result.setlist=songs.map(name).map(s=>String(s).trim().slice(0,300)).filter(Boolean)
  if(result.date&&!validDate(result.date))throw Error('Use YYYY-MM-DD for the concert date.')
  for(const key of ['spotifyUrl','youtubeUrl'])if(result[key])result[key]=mediaUrl(result[key],key)
  if(!referenceFields.some(key=>result[key])&&!result.setlist.length)throw Error('Use labelled lines such as Artist:, Date:, Venue: and Setlist:, or fill the fields below.')
  return result
}
export function compareReference(concert,reference){
  const fields=referenceFields.filter(key=>reference[key]).map(key=>({id:key,key,before:concert[key]||'',after:reference[key],status:!concert[key]||key==='date'&&concert[key]==='9999-12-31'?'addition':(key.endsWith('Url')?concert[key]===reference[key]:normalize(concert[key])===normalize(reference[key]))?'match':'conflict'}))
  const existing=performanceSongs(concert.setlist).map(name),known=new Set(existing.map(normalize)),seen=new Set()
  const additions=reference.setlist.filter(title=>{const key=normalize(title);if(known.has(key)||seen.has(key))return false;seen.add(key);return true}).map(title=>({id:'song:'+normalize(title),key:'setlist',before:'',after:title,status:'addition'}))
  const a=existing.map(normalize),b=reference.setlist.map(normalize)
  return {fields,additions,sequenceDiffers:!!a.length&&!!b.length&&JSON.stringify(a)!==JSON.stringify(b),existingCount:a.length,referenceCount:b.length}
}
export function applyReference(concert,reference,selected,source){
  const report=compareReference(concert,reference),next={...concert},changes=[]
  for(const field of report.fields){if(field.status!=='match'&&selected.includes(field.id)){next[field.key]=field.after;changes.push({field:field.key,before:field.before,after:field.after})}}
  const songs=report.additions.filter(song=>selected.includes(song.id))
  if(songs.length){next.setlist=[...(concert.setlist||[]),...songs.map(song=>({name:song.after,referenceSource:{name:source.name,url:referenceUrl(source.url)}}))];changes.push(...songs.map(song=>({field:'setlist',after:song.after})))}
  if(changes.length)next.referenceImports=[...(concert.referenceImports||[]),{name:source.name.trim()||'Pasted reference',url:referenceUrl(source.url),checkedAt:new Date().toISOString(),changes}]
  return next
}
