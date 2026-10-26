import {searchVenueWebsite,venueUrl} from '../server/venueWebsites.js'
import {validDate} from '../src/lib/calendar.js'
export const config={maxDuration:60}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Use GET.'})
  const {website,artist,today,venueName=''}=req.query
  if(typeof website!=='string'||website.length>2000||typeof artist!=='string'||!artist.trim()||artist.length>160||typeof venueName!=='string'||venueName.length>160||!validDate(today))return res.status(400).json({error:'Invalid venue search.'})
  try{venueUrl(website)}catch{return res.status(400).json({error:'Use a public HTTPS venue website.'})}
  try{const result=await searchVenueWebsite({website,artist,today,venueName});return res.status(200).json({...result,checkedAt:result.checkedAt||new Date().toISOString()})}
  catch{return res.status(502).json({error:'Venue website could not be checked. Open it manually or try again later.'})}
}
