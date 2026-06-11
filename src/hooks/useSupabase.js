import { useState, useEffect, useCallback, useRef } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { SEED_DATA, DEFAULT_SETTINGS } from '../lib/data'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dbSleeping, setDbSleeping] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

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

  const signOut = () => isSupabaseConfigured ? supabase.auth.signOut() : Promise.resolve()

  return { user, loading, signIn, signOut, dbSleeping }
}

export function useConcerts(userId) {
  const [concerts, setConcerts] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return
    loadConcerts()
  }, [userId])

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
      // First login — seed from built-in data if any
      if (SEED_DATA.length > 0) await seedConcerts(userId)
      setLoaded(true)
      return
    }

    if (SEED_DATA.length === 0) {
      // No hardcoded seed — concerts are self-contained in DB
      setConcerts(data.map(r => r.data).sort((a, b) => b.date.localeCompare(a.date)))
    } else {
      // Merge: seed is source of truth for base fields, DB wins for user edits
      const userFields = ['rating', 'merch', 'notes', 'friends', 'solo']
      const dbMap = Object.fromEntries(data.map(r => [r.id, r.data]))
      const merged = SEED_DATA.map(seed => {
        const saved = dbMap[seed.id]
        if (!saved) return seed
        const out = { ...seed }
        userFields.forEach(f => { if (saved[f] !== undefined) out[f] = saved[f] })
        return out
      })
      setConcerts(merged)
    }
    setLoaded(true)
  }

  const seedConcerts = async (uid) => {
    if (!isSupabaseConfigured) return
    const rows = SEED_DATA.map(c => ({ id: c.id, user_id: uid, data: c }))
    // Insert in batches of 20
    for (let i = 0; i < rows.length; i += 20) {
      await supabase.from('concerts').upsert(rows.slice(i, i + 20))
    }
    setConcerts(SEED_DATA)
  }

  const saveConcert = useCallback(async (concert) => {
    if (!isSupabaseConfigured || !userId) return { error: new Error('Supabase is not configured') }
    let previousConcerts = []
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
  const settingsRef = useRef(DEFAULT_SETTINGS)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('settings')
      .select('data')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data?.data) {
          const merged = { ...DEFAULT_SETTINGS, ...data.data }
          settingsRef.current = merged
          setSettings(merged)
        }
      })
  }, [userId])

  const saveSettings = useCallback(async (next) => {
    if (!isSupabaseConfigured || !userId) return { error: new Error('Supabase is not configured') }
    const previous = settingsRef.current
    settingsRef.current = next
    setSettings(next)
    const { error } = await supabase.from('settings').upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() })
    if (error) {
      console.error('Error saving settings:', error)
      settingsRef.current = previous
      setSettings(previous)
      return { error }
    }
    return { error: null }
  }, [userId])

  const saveSetting = useCallback(async (key, value) => {
    return saveSettings({ ...settingsRef.current, [key]: value })
  }, [saveSettings])

  return { settings, saveSetting, saveSettings }
}
