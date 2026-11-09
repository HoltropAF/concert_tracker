export const ticketFileLimit = 20 * 1024 * 1024

export function validateTicketFile(file) {
  const acceptedType = file.type === 'application/pdf' || file.type.startsWith('image/')
  const recognizedName = /\.(pdf|avif|bmp|gif|hei[cf]|ico|jpe?g|jfif|png|svg|tiff?|webp)$/i.test(file.name)
  if (!acceptedType && !recognizedName) return 'Choose a PDF or image file.'
  if (!file.size || file.size > ticketFileLimit) return 'Choose a file between 1 byte and 20 MB.'
  return ''
}

export function ticketExpiry(concert) {
  return concert?.endDate || concert?.date || ''
}

async function withTickets(mode, run) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('settracker-ticket-files', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('shows', { keyPath: ['account', 'showId'] })
      store.createIndex('account', 'account')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('shows', mode)
      let result
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(tx.error)
      run(tx.objectStore('shows'), value => { result = value })
    })
  } finally {
    db.close()
  }
}

export function listTicketFiles(account, showId) {
  return withTickets('readonly', (store, finish) => {
    const request = store.get([account, showId])
    request.onsuccess = () => finish(request.result?.files || [])
  })
}

export function updateTicketFiles(account, concert, update) {
  return withTickets('readwrite', (store, finish) => {
    const key = [account, concert.id]
    const request = store.get(key)
    request.onsuccess = () => {
      const files = update(request.result?.files || [])
      if (files.length) store.put({ account, showId: concert.id, expiresOn: ticketExpiry(concert), files })
      else store.delete(key)
      finish(files)
    }
  })
}

export function pruneExpiredTickets(account, today, concerts) {
  const dates = new Map(concerts.map(concert => [concert.id, ticketExpiry(concert)]))
  return withTickets('readwrite', store => {
    const request = store.index('account').openCursor(account)
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      const record = cursor.value
      const expiresOn = dates.get(record.showId) || record.expiresOn
      if (expiresOn && expiresOn < today) cursor.delete()
      else if (expiresOn !== record.expiresOn) cursor.update({ ...record, expiresOn })
      cursor.continue()
    }
  })
}
