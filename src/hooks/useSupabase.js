import { useState, useEffect, useCallback, useRef } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { SEED_DATA, DEFAULT_SETTINGS } from '../lib/data'

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
  if (v && typeof v === 'object') return { name: String(v.name || '').trim(), role: v.role === 'guest' ? 'guest' : 'support' }
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

// ============================================================
// OFFLINE CACHE
// * Concerts and settings are mirrored to localStorage per user so a returning
// * visitor renders their real data on the first frame instead of staring at a
// * splash until Supabase answers. The DB fetch still runs on every load and
// * overwrites the cache — this is stale-while-revalidate, not a source of truth.
// ============================================================

const cacheKey = (name, userId) => `cache_v1:${name}:${userId}`

function readCache(name, userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(cacheKey(name, userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(name, userId, value) {
  if (!userId) return
  try {
    localStorage.setItem(cacheKey(name, userId), JSON.stringify(value))
  } catch {
    // * Quota exceeded (a big library with setlists can outgrow the 5MB budget).
    // * Drop the stale entry so we don't keep serving something we can't refresh.
    try { localStorage.removeItem(cacheKey(name, userId)) } catch { /* nothing left to do */ }
  }
}

// * Called on sign-out so the next account doesn't inherit anything.
function clearCaches() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_v1:'))
      .forEach(k => localStorage.removeItem(k))
    localStorage.removeItem('splash_counts')
  } catch { /* best effort */ }
}

// ============================================================
// HOOKS
// ============================================================

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dbSleeping, setDbSleeping] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // ! 9-second timeout triggers the "database is napping" screen.
    // ! Supabase free projects pause after ~7 days of inactivity.
    const timeout = setTimeout(() => {
      setDbSleeping(true)
      setLoading(false)
    }, 9000)

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout)
        if (error) { setDbSleeping(true) }
        else { setUser(session?.user ?? null) }
        setLoading(false)
      })
      .catch(() => {
        clearTimeout(timeout)
        setDbSleeping(true)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [])

  const signIn = async (email) => {
    if (!isSupabaseConfigured) return { error: new Error('Supabase is not configured') }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    return { error }
  }

  const signOut = () => {
    clearCaches()
    return isSupabaseConfigured ? supabase.auth.signOut() : Promise.resolve()
  }

  return { user, loading, signIn, signOut, dbSleeping }
}

export function useConcerts(userId) {
  const [concerts, setConcerts] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return
    // * Paint whatever we cached last time straight away, then revalidate against
    // * the DB in the background. Without this, every cold start blocks on a
    // * network round-trip before a single row can be rendered.
    const cached = readCache('concerts', userId)
    if (Array.isArray(cached)) {
      setConcerts(cached.map(c => normalizeConcert(c)))
      setLoaded(true)
    }
    loadConcerts()
  }, [userId])

  // * Mirror every state change (load, optimistic save, delete, rollback) into the
  // * cache, so one write site covers all of them.
  useEffect(() => {
    if (!userId || !loaded) return
    writeCache('concerts', userId, concerts)
  }, [userId, loaded, concerts])

  const loadConcerts = async () => {
    if (!isSupabaseConfigured || !userId) return
    const { data, error } = await supabase
      .from('concerts')
      .select('id, data')
      .eq('user_id', userId)
      .order('id')

    if (error) {
      console.error('Error loading concerts:', error)
      setLoaded(true)
      return
    }

    if (!data || data.length === 0) {
      // * First login — seed from built-in data if any exists in src/lib/data.js
      if (SEED_DATA.length > 0) await seedConcerts(userId)
      setLoaded(true)
      return
    }

    if (SEED_DATA.length === 0) {
      // * No hardcoded seed — concerts are fully self-contained in the DB
      setConcerts(data.map(r => normalizeConcert(r.data, r.id)).sort((a, b) => b.date.localeCompare(a.date)))
    } else {
      // * Merge: SEED_DATA is source of truth for base fields; DB wins for user edits
      const userFields = ['rating', 'merch', 'notes', 'friends', 'solo']
      const dbMap = Object.fromEntries(data.map(r => [r.id, r.data]))
      const merged = SEED_DATA.map(seed => {
        const saved = dbMap[seed.id]
        if (!saved) return seed
        const out = { ...seed }
        userFields.forEach(f => { if (saved[f] !== undefined) out[f] = saved[f] })
        return normalizeConcert(out, seed.id)
      })
      setConcerts(merged)
    }
    setLoaded(true)
  }

  const seedConcerts = async (uid) => {
    if (!isSupabaseConfigured) return
    const rows = SEED_DATA.map(c => ({ id: c.id, user_id: uid, data: c }))
    // * Insert in batches of 20 to stay within Supabase request size limits
    for (let i = 0; i < rows.length; i += 20) {
      await supabase.from('concerts').upsert(rows.slice(i, i + 20))
    }
    setConcerts(SEED_DATA)
  }

  const saveConcert = useCallback(async (concert) => {
    if (!isSupabaseConfigured || !userId) return { error: new Error('Supabase is not configured') }
    let previousConcerts = []
    // * Optimistic update: apply locally first, roll back on DB error
    setConcerts(prev => {
      previousConcerts = prev
      const exists = prev.some(c => c.id === concert.id)
      return exists ? prev.map(c => c.id === concert.id ? concert : c) : [...prev, concert]
    })
    const { error } = await supabase
      .from('concerts')
      .upsert({ id: concert.id, user_id: userId, data: concert, updated_at: new Date().toISOString() })
    if (error) {
      console.error('Error saving concert:', error)
      setConcerts(previousConcerts)
      return { error }
    }
    return { error: null }
  }, [userId])

  const deleteConcert = useCallback(async (concertId) => {
    if (!isSupabaseConfigured || !userId) return { error: new Error('Supabase is not configured') }
    let previousConcerts = []
    // * Optimistic update: remove locally first, roll back on DB error
    setConcerts(prev => {
      previousConcerts = prev
      return prev.filter(c => c.id !== concertId)
    })
    const { error } = await supabase.from('concerts').delete().eq('id', concertId).eq('user_id', userId)
    if (error) {
      console.error('Error deleting concert:', error)
      setConcerts(previousConcerts)
      return { error }
    }
    return { error: null }
  }, [userId])

  return { concerts, loaded, saveConcert, deleteConcert, reload: loadConcerts }
}

export function useSettings(userId) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  // * Distinguishes "these are still the defaults" from "these are really yours".
  // * Deliberately NOT used to block rendering — only to defer decisions that
  // * would be wrong under defaults, like whether to show the onboarding tour.
  const [loaded, setLoaded] = useState(false)
  // * settingsRef keeps a sync copy for use inside callbacks without stale-closure issues
  const settingsRef = useRef(DEFAULT_SETTINGS)

  useEffect(() => {
    if (!userId) return
    // * Apply cached settings first — these drive the accent colour and light mode,
    // * so waiting for the DB means booting in the wrong theme and then flashing.
    const cached = readCache('settings', userId)
    if (cached) {
      const merged = normalizeSettings(cached)
      settingsRef.current = merged
      setSettings(merged)
      setLoaded(true)
    }
    supabase
      .from('settings')
      .select('data')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.data) {
          const merged = normalizeSettings(data.data)
          settingsRef.current = merged
          setSettings(merged)
          writeCache('settings', userId, merged)
        }
        setLoaded(true)
      })
      // * No settings row yet (first login) is a normal outcome, not a failure —
      // * the defaults already in state are the right answer.
      .catch(() => setLoaded(true))
  }, [userId])

  const saveSettings = useCallback(async (next) => {
    if (!isSupabaseConfigured || !userId) return { error: new Error('Supabase is not configured') }
    const previous = settingsRef.current
    settingsRef.current = next
    setSettings(next)
    writeCache('settings', userId, next)
    const { error } = await supabase.from('settings').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
    if (error) {
      console.error('Error saving settings:', error)
      settingsRef.current = previous
      setSettings(previous)
      writeCache('settings', userId, previous)
      return { error }
    }
    return { error: null }
  }, [userId])

  const saveSetting = useCallback(async (key, value) => {
    return saveSettings({ ...settingsRef.current, [key]: value })
  }, [saveSettings])

  return { settings, settingsLoaded: loaded, saveSetting, saveSettings }
}
