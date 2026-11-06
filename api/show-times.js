import {venueUrl} from '../server/venueWebsites.js'
import {lookupShowTimes} from '../server/showTimes.js'
import {validDate} from '../src/lib/calendar.js'
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Use GET.'})
 const {url='',website='',artist,date,venue='',country=''}=req.query
 if(typeof artist!=='string'||!artist.trim()||artist.length>160||!validDate(date)||[venue,country].some(v=>typeof v!=='string'||v.length>160)||[url,website].some(v=>typeof v!=='string'||v.length>2000))return res.status(400).json({error:'Choose an artist and show date first.'})
 try{for(const value of [url,website])if(value)venueUrl(value)}catch{return res.status(400).json({error:'Use public HTTPS event links.'})}
 try{return res.status(200).json(await lookupShowTimes({url,website,artist,date,venue,country}))}catch{return res.status(502).json({error:'Sources could not be checked. Open a source or enter times manually.'})}
}
export const config={maxDuration:60}
