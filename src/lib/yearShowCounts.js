import {validDate} from './calendar.js'
export function yearShowCounts(concerts,isPast) {
  const counts={}
  for(const concert of concerts){
    if(concert.wishlist||!validDate(concert.date)||concert.date==='9999-12-31')continue
    const year=concert.date.slice(0,4)
    counts[year] ||= {past:0,upcoming:0}
    counts[year][isPast(concert.date)?'past':'upcoming']++
  }
  return counts
}
