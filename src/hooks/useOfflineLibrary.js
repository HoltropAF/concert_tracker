import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { acknowledgeOperation, changedFields, editLibrary, emptyLibrary, libraryValue } from '../lib/offlineLibrary'
import { createLibraryRemote } from '../lib/libraryRemote'
import { supabase } from '../lib/supabase'

const offline = () => navigator.onLine === false

function legacySnapshot(userId, domain) {
  try {
    return JSON.parse(localStorage.getItem(`cache_v1:${domain}:${userId}`))
  } catch {
    return null
  }
}

export function useOfflineLibrary(userId, canConnect, domain, normalize) {
  const fallback = useMemo(() => {
    if (!userId) return emptyLibrary
    const cached = legacySnapshot(userId, domain)
    if (cached === null || (domain === 'concerts' && !Array.isArray(cached))) return emptyLibrary
    const value = domain === 'settings' ? normalize(cached) : cached.map(concert => normalize(concert))
    return { ...emptyLibrary, value }
  }, [userId, domain, normalize])
  const [snapshot, setSnapshot] = useState(null)
  const [status, setStatus] = useState({})
  const connection = useRef(null)
  connection.current = { userId, canConnect }
  const state = snapshot && snapshot.userId === userId ? snapshot.state : fallback
  const currentStatus = status.userId === userId ? status : {}
  const value = useMemo(() => libraryValue(state, domain), [state, domain])

  const engine = useMemo(() => {
    if (!userId) return null
    const remote = createLibraryRemote(supabase, userId, domain, normalize)
    const connected = () => connection.current.userId === userId && connection.current.canConnect && !offline()
    let running, active = false, channel, retryAt = 0, refreshRequested = false
    const read = update => editLibrary(userId, domain, update, fallback)
    const publish = next => {
      if (active) setSnapshot(previous => previous?.userId === userId && previous.state.revision > next.revision
        ? previous : { userId, state: next })
      return next
    }
    const write = async update => {
      const next = publish(await read(update))
      channel?.postMessage('changed')
      return next
    }
    const report = changes => {
      if (active) setStatus(previous => ({ ...(previous.userId === userId ? previous : {}), userId, ...changes }))
    }
    const reconnect = async () => {
      report({ syncing: true, syncError: null })
      try {
        let next = publish(await read())
        while (active && connected() && next.pending.length) {
          const operation = next.pending[0]
          const saved = await remote.save(operation)
          next = await write(state => acknowledgeOperation(state, domain, operation, saved))
        }
        if (!active || !connected()) return
        if (refreshRequested || next.value === null) {
          refreshRequested = false
          const latest = await remote.load()
          if (!active) return
          await write(state => ({ ...state, value: latest }))
        }
        retryAt = 0
        report({ loadError: null })
      } catch (error) {
        retryAt = Date.now() + 30000
        report({ loadError: error, syncError: error })
      } finally {
        report({ syncing: false })
      }
    }
    const sync = (refresh = false) => {
      if (!active || !connected()) return Promise.resolve()
      refreshRequested ||= refresh
      if (!running) {
        running = (navigator.locks
          ? navigator.locks.request(`settracker:${userId}:${domain}`, reconnect)
          : reconnect()).finally(() => {
          running = null
          if (refreshRequested && !retryAt && active && connected()) sync()
        })
      }
      return running
    }
    const recover = async () => {
      try {
        const next = publish(await read())
        if (!active) return
        if (!connected()) {
          if (next.value === null) report({ loadError: new Error('Connect once to download your library.') })
        } else await sync(true)
      } catch (error) {
        // The account can still read its library if the browser blocks device storage.
        try {
          if (!active || !connected()) throw error
          const value = await remote.load()
          if (active) publish({ ...emptyLibrary, value })
          report({ loadError: null, syncError: error })
        } catch (loadError) {
          report({ loadError, syncError: error })
        }
      }
    }
    const start = () => {
      active = true
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(`settracker:${userId}:${domain}`)
        channel.onmessage = () => read().then(publish).catch(() => {})
      }
      const checkPending = () => {
        if (!active || !connected() || Date.now() < retryAt) return
        read().then(next => {
          if (next.pending.length || next.value === null || retryAt) return sync(!!retryAt)
        }).catch(() => {})
      }
      const interval = setInterval(checkPending, 5000)
      const visible = () => { if (document.visibilityState === 'visible') sync(true) }
      window.addEventListener('online', recover)
      window.addEventListener('offline', recover)
      document.addEventListener('visibilitychange', visible)
      recover()
      return () => {
        active = false
        clearInterval(interval)
        channel?.close()
        channel = null
        window.removeEventListener('online', recover)
        window.removeEventListener('offline', recover)
        document.removeEventListener('visibilitychange', visible)
      }
    }
    const enqueue = async makeOperation => {
      try {
        const id = crypto.randomUUID()
        const next = await write(state => {
          const value = libraryValue(state, domain)
          if (value === null) throw new Error('Load your library before editing.')
          const operation = makeOperation(value)
          return operation ? { ...state, pending: [...state.pending, { ...operation, id }] } : state
        })
        if (!next.pending.some(operation => operation.id === id)) return { error: null }
        if (offline()) navigator.storage?.persist?.().catch(() => {})
        const synced = sync().then(async () => !(await read()).pending.some(operation => operation.id === id)).catch(() => false)
        // An edit can be queued just after a sync has drained its batch.
        synced.then(done => { if (!done && active && !retryAt) sync() })
        return { error: null, queued: true, synced }
      } catch (error) {
        return { error }
      }
    }
    return { start, recover, enqueue }
  }, [userId, domain, normalize, fallback])

  useEffect(() => engine?.start(), [engine])
  useEffect(() => { if (canConnect) engine?.recover() }, [canConnect, engine])
  const enqueue = useCallback(makeOperation => engine?.enqueue(makeOperation)
    ?? Promise.resolve({ error: new Error('Sign in to save your library.') }), [engine])
  const reload = useCallback(() => engine?.recover(), [engine])

  return {
    value, enqueue, reload,
    loaded: value !== null || !!currentStatus.loadError,
    loadError: value === null ? currentStatus.loadError : null,
    syncError: currentStatus.syncError,
    syncing: currentStatus.syncing,
    pending: state.pending.length,
  }
}

export function settingsOperation(before, after) {
  const changes = changedFields(before, after)
  return changes.length ? { changes, initial: before } : null
}
