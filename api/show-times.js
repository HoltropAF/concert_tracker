import {readVenuePage,venueUrl} from '../server/venueWebsites.js'
import {parseShowTimes} from '../src/lib/showTimes.js'
import {validDate} from '../src/lib/calendar.js'
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Use GET.'})
 const {url,artist,date}=req.query
 if(typeof url!=='string'||url.length>2000||typeof artist!=='string'||!artist.trim()||artist.length>160||!validDate(date))return res.status(400).json({error:'Choose an event page, artist and date first.'})
 try{venueUrl(url)}catch{return res.status(400).json({error:'Use a public HTTPS event link.'})}
 try{const page=await readVenuePage(url);return res.status(200).json({...parseShowTimes(page.html,{artist,date}),source:page.url})}catch{return res.status(502).json({error:'This website could not be read automatically. Open the source or search and enter the times manually.'})}
}
