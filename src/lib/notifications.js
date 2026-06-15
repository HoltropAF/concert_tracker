// Ticket sale notification helpers

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

// Schedule a notification for a ticket sale.
// saleAt: ISO datetime string, e.g. "2026-06-15T10:00"
// label: artist name
// Fires 30 min before, and at the exact time.
// Stores scheduled timers in memory (cleared on reload — that's fine, we re-check on open).
const timers = new Map()

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

// Call on app load: re-schedule all pending alarms from concert data
export function reScheduleAll(concerts) {
  if (!canNotify()) return
  concerts.forEach(c => {
    if (c.wishlist && c.ticketSaleAt) {
      scheduleTicketAlarm(c.id, c.ticketSaleAt, c.artist)
    }
  })
}
