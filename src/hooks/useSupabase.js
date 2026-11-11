// * The entire data layer. Three hooks — useAuth, useConcerts, useSettings — are the
// * only place in the app that talks to Supabase for user data (lib/photos.js handles
// * storage separately). App wires them up and passes plain values and callbacks down
// * to ConcertTracker, which never imports this module.
// *
// * Storage model: two tables, both a thin envelope around a JSON blob —
// *   concerts(id, user_id, data, updated_at)   one row per show
// *   settings(user_id, data, updated_at)       one row per user
// * There is no relational schema for artists, friends, venues or songs; those are
// * derived at render time from strings inside the concert blobs. That's why the
// * normalizers below matter: a blob written by an older version of the app is still
// * a valid row, so shape has to be enforced on read rather than by the database.
import { useState, useEffect, useCallback } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { DEFAULT_SETTINGS } from '../lib/data'
import { useOfflineLibrary, settingsOperation } from './useOfflineLibrary'
import { changedFields, clearSyncedLibrary } from '../lib/offlineLibrary'

// ============================================================
// DATA NORMALIZERS
// * Coerce raw Supabase JSON blobs into consistent shapes.
// * Always run DB data through these before rendering — the
// * stored JSON may be from an older version with different fields.
// ============================================================

const arrayOr = (value, fallback = []) => Array.isArray(value) ? value : fallback
const stringList = (value, fallback = []) => arrayOr(value, fallback).map(v => String(v || '').trim()).filter(Boolean)
const supportList = (value) => arrayOr(value).map(v => {
  if (typeof v === 'string') return v.trim()
  if (v && typeof v === 'object') return { ...v, name: String(v.name || '').trim(), role: v.role === 'guest' ? 'guest' : 'support' }
  return ''
}).filter(v => typeof v === 'string' ? v : v.name)
const actsList = (value) => arrayOr(value).map(v => {
  const act = v && typeof v === 'object' ? v : {}
  return { ...act, name: String(act.name || '').trim() }
}).filter(v => v.name)
const merchList = (value) => arrayOr(value).map(v => {
  const item = v && typeof v === 'object' ? v : {}
  return { ...item, item: String(item.item || '').trim(), price: item.price ?? '' }
}).filter(v => v.item || v.price)
const setlistMap = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([artist, songs]) => [String(artist || '').trim(), arrayOr(songs).filter(Boolean)]).filter(([artist]) => artist))
}

// * Songs in the setlist can be a plain string OR an object:
// *   { name: string, info?: string, cover?: string, spotifyId?: string }
// * Always access them via the getSong* helpers in ConcertTracker — never raw.
// TODO: add spotifyId to normalizeConcert once Spotify integration is built (docs/spotify-integration-plan.md)
const normalizeConcert = (value, fallbackId = '') => {
  const concert = value && typeof value === 'object' ? value : {}
  return {
    ...concert,
    id: String(concert.id || fallbackId || crypto.randomUUID()),
    artist: String(concert.artist || ''),
    date: String(concert.date || ''),
    venue: String(concert.venue || ''),
    room: String(concert.room || ''),
    city: String(concert.city || ''),
    country: String(concert.country || ''),
    type: concert.type === 'festival' ? 'festival' : 'concert',
    tour: String(concert.tour || ''),
    support: supportList(concert.support),
    acts: actsList(concert.acts),
    friends: stringList(concert.friends),
    merch: merchList(concert.merch),
    ticketAddons: stringList(concert.ticketAddons),
    language: stringList(concert.language, concert.language ? [concert.language] : []),
    setlist: arrayOr(concert.setlist).filter(Boolean),
    supportSetlists: setlistMap(concert.supportSetlists),
    notes: String(concert.notes || ''),
  }
}

// * Merges a stored settings blob over DEFAULT_SETTINGS, then re-validates the fields
// * that are collections. A key that was added in a later version is simply absent
// * from an old blob and picks up its default here — which is why new settings must
// * always be given a sensible entry in DEFAULT_SETTINGS rather than relying on
// * `undefined` behaving correctly at the call site.
const normalizeSettings = (value) => {
  const settings = value && typeof value === 'object' ? value : {}
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  return {
    ...merged,
    merchCategories: stringList(merged.merchCategories, DEFAULT_SETTINGS.merchCategories),
    genres: stringList(merged.genres, DEFAULT_SETTINGS.genres),
    subgenres: stringList(merged.subgenres, DEFAULT_SETTINGS.subgenres),
    languages: stringList(merged.languages, DEFAULT_SETTINGS.languages),
    venueSizes: stringList(merged.venueSizes, DEFAULT_SETTINGS.venueSizes),
    hiddenChartGroups: stringList(merged.hiddenChartGroups),
    hiddenCharts: stringList(merged.hiddenCharts),
    hiddenSummaryBlocks: stringList(merged.hiddenSummaryBlocks),
    savedVenues: arrayOr(merged.savedVenues).map(v => {
      const venue = v && typeof v === 'object' ? v : {}
      return {
        ...venue,
        name: String(venue.name || '').trim(),
        city: String(venue.city || '').trim(),
        country: String(venue.country || '').trim(),
        room: String(venue.room || '').trim(),
      }
    }).filter(v => v.name),
    friendGroups: arrayOr(merged.friendGroups).map(g => {
      const group = g && typeof g === 'object' ? g : {}
      return {
        ...group,
        name: String(group.name || '').trim(),
        friends: stringList(group.friends),
      }
    }).filter(g => g.name || g.friends.length),
  }
}

const accountKey = 'settracker-offline-account'

function rememberedAccount() {
  try { return JSON.parse(localStorage.getItem(accountKey)) } catch { return null }
}

function remember(user) {
  try {
    if (user) localStorage.setItem(accountKey, JSON.stringify({ id: user.id, email: user.email }))
    else localStorage.removeItem(accountKey)
  } catch { /* storage may be disabled */ }
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dbSleeping, setDbSleeping] = useState(false)
  const [offlineAccount, setOfflineAccount] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine !== false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let active = true, checking = false, needsRetry = false, timeout
    const apply = (account, fallback = false) => {
      if (!active) return
      needsRetry = fallback
      if (!fallback) remember(account)
      setUser(account)
      setOfflineAccount(fallback && !!account)
      setDbSleeping(fallback && !account)
      setLoading(false)
    }
    const check = async () => {
      if (navigator.onLine === false) {
        const account = rememberedAccount()
        apply(account, !!account)
        return
      }
      if (checking) return
      checking = true
      timeout = setTimeout(() => apply(rememberedAccount(), true), 9000)
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error && error.name !== 'AuthRetryableFetchError' && error.status >= 400 && error.status < 500) apply(null)
        else if (error) apply(rememberedAccount(), true)
        else apply(data.session?.user ?? null)
      } catch {
        apply(rememberedAccount(), true)
      } finally {
        clearTimeout(timeout)
        checking = false
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) apply(session.user)
      else if (event === 'SIGNED_OUT' && navigator.onLine !== false) apply(null)
    })
    const connected = () => { setOnline(true); check() }
    const disconnected = () => {
      setOnline(false)
      if (checking) apply(rememberedAccount(), true)
    }
    window.addEventListener('online', connected)
    window.addEventListener('offline', disconnected)
    const retry = setInterval(() => { if (needsRetry && navigator.onLine !== false) check() }, 15000)
    check()
    return () => {
      active = false
      clearTimeout(timeout)
      clearInterval(retry)
      subscription.unsubscribe()
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', disconnected)
    }
  }, [])

  const signIn = async (email, { shouldCreateUser = false } = {}) => {
    if (!isSupabaseConfigured) return { error: new Error('Supabase is not configured') }
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser }
    })
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) return { error: null }
    const result = await supabase.auth.signOut()
    if (!result.error) {
      remember(null)
      try {
        localStorage.removeItem('splash_counts')
        localStorage.removeItem(`cache_v1:concerts:${user?.id}`)
        localStorage.removeItem(`cache_v1:settings:${user?.id}`)
      } catch { /* best effort */ }
      if (user?.id) await clearSyncedLibrary(user.id).catch(() => {})
    }
    return result
  }

  return { user, loading, signIn, signOut, dbSleeping, online, canConnect: online && !offlineAccount }
}

export function useConcerts(userId, canConnect) {
  const library = useOfflineLibrary(userId, canConnect, 'concerts', normalizeConcert)
  const { enqueue } = library
  const saveConcert = useCallback(concert => enqueue(() => {
    const previous = library.value?.find(item => item.id === concert.id)
    const changes = previous ? changedFields(previous, concert) : changedFields({}, concert)
    return changes.length ? { entity: concert.id, changes, initial: previous || {} } : null
  }), [enqueue, library.value])
  const deleteConcert = useCallback(id => enqueue(() => ({ entity: id, remove: true })), [enqueue])
  return { ...library, concerts: library.value || [], saveConcert, deleteConcert }
}

export function useSettings(userId, canConnect) {
  const library = useOfflineLibrary(userId, canConnect, 'settings', normalizeSettings)
  const { enqueue } = library
  const settings = library.value || DEFAULT_SETTINGS
  const saveSettings = useCallback(next => enqueue(() => settingsOperation(settings, next)), [enqueue, settings])
  const saveSetting = useCallback((key, value) => enqueue(() => settingsOperation(settings, { ...settings, [key]: value })), [enqueue, settings])
  return { ...library, settings, settingsLoaded: library.loaded, saveSetting, saveSettings }
}
