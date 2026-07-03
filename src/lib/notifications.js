// * Ticket sale notification helpers — schedules browser Notification API alerts
// * for wishlist concerts that have a ticketSaleAt datetime set.

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

// ! Timers live in memory only — cleared on every page reload.
// ! reScheduleAll() must be called on app open to restore pending alarms.
const timers = new Map()

// * Fires two notifications: a 30-min warning and an at-sale-time alert.
// * If the sale started less than 30 min ago, notifies immediately instead.
export function scheduleTicketAlarm(concertId, saleAt, artist) {
  clearTicketAlarm(concertId)
  if (!canNotify() || !saleAt) return

  const saleMs = new Date(saleAt).getTime()
  const now = Date.now()
  const thirtyMin = 30 * 60 * 1000

  const fire = (title, body) => {
    try {
      const n = new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `ticket-sale-${concertId}`,
        renotify: true,
      })
      n.onclick = () => { window.focus(); n.close() }
    } catch (e) {
      console.warn('Notification failed:', e)
    }
  }

  const ids = []

  // 30-min warning
  const warnMs = saleMs - thirtyMin - now
  if (warnMs > 0) {
    ids.push(setTimeout(() => fire(
      `🎫 Tickets in 30 minutes`,
      `${artist} ticket sale starts soon!`
    ), warnMs))
  }

  // At sale time
  const atMs = saleMs - now
  if (atMs > 0) {
    ids.push(setTimeout(() => fire(
      `🎫 Tickets on sale NOW`,
      `${artist} — go get your tickets!`
    ), atMs))
  } else if (atMs > -thirtyMin) {
    // Sale started less than 30 min ago — notify immediately
    fire(`🎫 Tickets on sale`, `${artist} sale started — grab yours!`)
  }

  if (ids.length) timers.set(concertId, ids)
}

export function clearTicketAlarm(concertId) {
  const ids = timers.get(concertId) || []
  ids.forEach(clearTimeout)
  timers.delete(concertId)
}

// * Call on every app open to re-schedule alarms lost when the page was closed.
export function reScheduleAll(concerts) {
  if (!canNotify()) return
  concerts.forEach(c => {
    if (c.wishlist && c.ticketSaleAt) {
      scheduleTicketAlarm(c.id, c.ticketSaleAt, c.artist)
    }
  })
}
