// Calls this app's own /api functions with the signed-in user's Supabase token.
// Demo visitors (no token) may try setlist search and show discovery DEMO_TRIES times; after that this
// answers locally with a "Sign in" message instead of calling the server. The
// server has its own caps as well (server/auth.js), so this is only the friendly part.
export const DEMO_TRIES = 3
const triesKey = 'settracker-demo-tries'
// Requests for the same feature this close together are one try: a wishlist check
// or a "load more" asks the server several times for a single click.
const sameTryMs = 20000
export const demoFeatureNames = {
  setlist: 'setlist search', 'artist-images': 'photo search', festival: 'festival import',
  upcoming: 'show discovery', venues: 'venue search', 'show-times': 'show times', 'venue-updates': 'venue checks',
}

// Not part of the demo: these need an account straight away.
export const signInOnlyFeatures = new Set(['artist-images', 'show-times', 'venue-updates', 'festival', 'venues'])
export function signInOnlyMessage(feature) {
  const name = demoFeatureNames[feature] || 'This feature'
  return `${name[0].toUpperCase() + name.slice(1)} needs an account. Sign in (it is free) to use it.`
}

export function takeDemoTry(feature, storage = globalThis.localStorage, now = Date.now()) {
  let tries = {}
  try { tries = JSON.parse(storage.getItem(triesKey) || '{}') || {} } catch { tries = {} }
  const entry = tries[feature] || { count: 0, last: 0 }
  if (now - entry.last < sameTryMs) entry.last = now
  else if (entry.count >= DEMO_TRIES) return false
  else { entry.count += 1; entry.last = now }
  tries[feature] = entry
  try { storage.setItem(triesKey, JSON.stringify(tries)) } catch { /* Private mode: the server cap still applies. */ }
  return true
}

export function demoLimitMessage(feature) {
  return `You have used your ${DEMO_TRIES} demo tries of ${demoFeatureNames[feature] || 'this feature'}. Sign in (it is free) to keep using it.`
}

export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers)
  let token = null
  try {
    const { supabase } = await import('./supabase.js')
    token = supabase && (await supabase.auth.getSession()).data?.session?.access_token
  } catch { /* No session: this is a demo visitor. */ }
  if (token) headers.set('Authorization', 'Bearer ' + token)
  else {
    const feature = /^\/api\/([a-z-]+)/.exec(url)?.[1]
    if (feature && signInOnlyFeatures.has(feature)) {
      return new Response(JSON.stringify({ error: signInOnlyMessage(feature) }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }
    if (feature && !takeDemoTry(feature)) {
      return new Response(JSON.stringify({ error: demoLimitMessage(feature) }), { status: 429, headers: { 'Content-Type': 'application/json' } })
    }
  }
  return fetch(url, { ...options, headers })
}
