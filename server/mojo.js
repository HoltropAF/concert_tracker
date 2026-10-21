import {matchesDiscovery} from '../src/lib/discovery.js'
const clean = value => value.replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n<=0x10ffff?String.fromCodePoint(n):''}).replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim()
export function parseMojo(html, query) {
  if (!html.includes('agenda-list') && !/geen resultaten|geen evenementen/i.test(html)) throw Error('MOJO page format could not be read.')
  const months = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december']
  let year, month
  const events=[]
  for (const match of html.matchAll(/agenda-list__title[^>]*>\s*([^\W\d]+)\s+(\d{4})\s*<|<li class="c-agenda-item[\s\S]*?<\/li>/g)) {
    if(match[1]) { year=match[2];month=months.indexOf(match[1].toLowerCase())+1;continue }
    const item=match[0],day=item.match(/agenda-item__date-day[^>]*>\s*(\d{1,2})/),title=item.match(/agenda-item__title[^>]*>([\s\S]*?)<(?:svg|\/h3)/),link=item.match(/<a href="([^"]+)"[^>]*class="agenda-item__link"/)
    if(!year||!month||!day||!title||!link)continue
    const url=new URL(link[1],'https://www.mojo.nl')
    if(url.protocol!=='https:' || !/(^|\.)mojo\.nl$/.test(url.hostname))continue
    const artist=clean(title[1]),place=clean(item.match(/agenda-item__subtitle[^>]*>([\s\S]*?)<\/div>/)?.[1]||'').split(' — ')
    if(query.artist && !query.artist.toLowerCase().split(/\s+/).every(word=>artist.toLowerCase().includes(word)))continue
    const date=`${year}-${String(month).padStart(2,'0')}-${day[1].padStart(2,'0')}`
    const event={id:`mojo:${url.pathname}:${date}`,artist,date,venue:place[0],city:place[1]||'',country:'Netherlands',countryCode:'NL',url:url.href,source:'MOJO',status:'Check promoter site',checkedAt:new Date().toISOString()}
    if(matchesDiscovery(event,query,query.today))events.push(event)
  }
  return {events,total:events.length}
}
export async function searchMojo(query, fetcher=fetch) {
  if(query.country && query.country!=='NL')return {events:[],total:0}
  const response=await fetcher(`https://www.mojo.nl/agenda?${new URLSearchParams({query:query.artist||query.venue,page:String(query.page)})}`,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}})
  if(!response.ok)throw Error(`MOJO returned ${response.status}.`)
  const html=await response.text()
  if(html.length>5000000)throw Error('MOJO response too large.')
  return parseMojo(html,query)
}
