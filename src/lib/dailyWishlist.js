export function localDay(now=new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
export function readDailyCheck(storage,key) {
  try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}
}
export function claimDailyCheck(storage,key,day=localDay()) {
  if(readDailyCheck(storage,key)?.day===day)return false
  try{storage.setItem(key,JSON.stringify({day,results:{}}))}catch{/* Session guard still prevents repeated checks. */}
  return true
}
