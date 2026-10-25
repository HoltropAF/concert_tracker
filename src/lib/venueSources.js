export function savedVenueSources(settings={}) {
  const info=settings.venueInfo||{},urls=settings.venueUrls||{}
  const names=new Set([...Object.keys(info),...Object.keys(urls),...(settings.savedVenues||[]).map(v=>v.name).filter(Boolean)])
  const seen=new Set(),sources=[]
  for(const name of names){
    const value=info[name]?.url||urls[name]||(settings.savedVenues||[]).find(v=>v.name===name)?.url
    if(!value)continue
    try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol))continue;u.protocol='https:';u.hash='';if(seen.has(u.href))continue;seen.add(u.href);sources.push({name,url:u.href})}catch{/* Invalid saved links are not searched. */}
  }
  return sources
}
