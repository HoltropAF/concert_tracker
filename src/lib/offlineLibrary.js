const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

// Objects merge by changed field. Ordered lists (setlists, for example) are one value.
export function changedFields(before, after) {
  const changes = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const oldValue = before[key]
    const newValue = after[key]
    if (isObject(oldValue) && isObject(newValue)) {
      const nested = changedFields(oldValue, newValue)
      if (nested.length) changes.push({ key, nested })
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ key, value: newValue })
    }
  }
  return changes
}

export function applyFields(base, changes) {
  const result = isObject(base) ? { ...base } : {}
  for (const { key, nested, value } of changes) {
    if (nested) {
      Object.defineProperty(result, key, { value: applyFields(Object.hasOwn(result, key) ? result[key] : null, nested), enumerable: true, writable: true, configurable: true })
    } else if (value === undefined) {
      delete result[key]
    } else {
      Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true })
    }
  }
  return result
}

export function libraryValue(state, domain) {
  if (state.value === null) return null
  if (domain === 'settings') {
    return state.pending.reduce((value, operation) => applyFields(value, operation.changes), state.value)
  }
  const concerts = new Map(state.value.map(concert => [concert.id, concert]))
  for (const operation of state.pending) {
    if (operation.remove) concerts.delete(operation.entity)
    else {
      const base = concerts.get(operation.entity) || operation.initial
      concerts.set(operation.entity, applyFields(base, operation.changes))
    }
  }
  return [...concerts.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export const emptyLibrary = { value: null, pending: [], revision: 0 }

export function acknowledgeOperation(state, domain, operation, saved) {
  if (state.pending[0]?.id !== operation.id) return state
  let value = saved
  if (domain === 'concerts') {
    value = state.value.filter(concert => concert.id !== operation.entity)
    if (saved) value.push(saved)
  }
  return { ...state, value, pending: state.pending.slice(1) }
}

export async function editLibrary(account, domain, update, fallback = emptyLibrary) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('settracker-library', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('library')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('library', update ? 'readwrite' : 'readonly')
      const store = transaction.objectStore('library')
      const key = [account, domain]
      const request = store.get(key)
      let result
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () => reject(transaction.error || new Error('Device storage is unavailable'))
      request.onsuccess = () => {
        result = request.result || fallback
        if (!update) return
        try {
          const next = update(result)
          if (next === result) return
          if (next === null) {
            store.delete(key)
            result = emptyLibrary
            return
          }
          result = { ...next, revision: result.revision + 1 }
          store.put(result, key)
        } catch (error) {
          reject(error)
          transaction.abort()
        }
      }
    })
  } finally {
    db.close()
  }
}

export function clearSyncedLibrary(account) {
  return Promise.all(['concerts', 'settings'].map(domain =>
    editLibrary(account, domain, state => state.pending.length ? state : null)
  ))
}
