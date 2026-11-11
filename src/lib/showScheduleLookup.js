import { validDate } from './calendar.js'
import { localDay } from './showDay.js'
import { needsShowTimes, pendingShowTime, pendingSupportActs, visibleShowTimeFields } from './showTimes.js'

const storageKey = 'settracker-show-schedule:v1'
const memory = new Map()
const inFlight = new Map()
export const scheduleUpdatedEvent = 'settracker-show-schedule-updated'

export function scheduleLink(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function scheduleRequest(concert, settings = {}, explicitUrl) {
  const promoter = concert.discovery?.sources?.find(item => item.source === 'MOJO' && scheduleLink(item.url))
  const url = explicitUrl ?? (scheduleLink(concert.scheduleUrl) || scheduleLink(promoter?.url) ||
    scheduleLink(concert.discovery?.url) || scheduleLink(concert.ticketSaleLink))
  const website = scheduleLink(settings.venueInfo?.[concert.venue]?.url) || scheduleLink(settings.venueUrls?.[concert.venue]) ||
    scheduleLink((settings.savedVenues || []).find(venue => venue.name === concert.venue)?.url)
  const params = new URLSearchParams({ url, website, artist: concert.artist || '', date: concert.date || '',
    venue: concert.venue || '', country: concert.country || '' })
  return { url, website, params, key: concert.id + ':' + params.toString() }
}

function storedSchedules() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {} } catch { return {} }
}

export function cachedSchedule(key) {
  return memory.get(key) || storedSchedules()[key]
}

function remember(key, entry) {
  if (memory.size >= 60) memory.delete(memory.keys().next().value)
  memory.set(key, entry)
  try {
    const entries = { ...storedSchedules(), [key]: entry }
    const recent = Object.entries(entries).sort((a,b) => b[1].at - a[1].at).slice(0,60)
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(recent)))
  } catch { /* The result remains available for this session. */ }
  window.dispatchEvent(new CustomEvent(scheduleUpdatedEvent, { detail:key }))
}

export function checkShowSchedule(request, automatic = false) {
  if (navigator.onLine === false) return Promise.reject(Error('Connect to look up timetable updates.'))
  if (request.url && !scheduleLink(request.url)) return Promise.reject(Error('Use a public HTTPS event-page link, or clear it to search automatically.'))
  if (inFlight.has(request.key)) return inFlight.get(request.key)
  const previous = cachedSchedule(request.key)
  const day = localDay()
  if (automatic && previous?.day === day) return Promise.resolve(previous.result)
  const run = async () => {
    try {
      const response = await fetch('/api/show-times?' + request.params, { signal:AbortSignal.timeout(30000) })
      const result = await response.json().catch(() => { throw Error('The timetable lookup is unavailable here.') })
      if (!response.ok) throw Error(result.error || 'Could not check this page.')
      remember(request.key,{ day, at:Date.now(), result })
      return result
    } catch (error) {
      if (navigator.onLine !== false) remember(request.key,{ day, at:Date.now(), result:previous?.result })
      throw error
    } finally {
      inFlight.delete(request.key)
    }
  }
  const promise = run()
  inFlight.set(request.key,promise)
  return promise
}

export function showsDueForSchedule(concerts, now = new Date(), settings = {}) {
  const today = localDay(now)
  const limit = new Date(now)
  limit.setDate(limit.getDate() + 3)
  const latest = localDay(limit)
  return concerts.filter(concert => !concert.wishlist && concert.artist && validDate(concert.date)
    && concert.date >= today && concert.date <= latest
    && !/cancelled|postponed/i.test(concert.discovery?.status || '')
    && needsShowTimes(concert, settings)
    && (concert.attendanceMode !== 'online' || !!scheduleLink(concert.scheduleUrl)))
    .sort((a,b) => a.date.localeCompare(b.date))
}

export function hasScheduleSuggestions(concert, settings, result) {
  return !!result && (visibleShowTimeFields(concert,settings).some(([key]) => pendingShowTime(concert,key,result.times?.[key]))
    || pendingSupportActs(concert.support || [],result.supportActs || []).length > 0)
}
