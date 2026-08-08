// api/notify.js
// Sends a push notification via ntfy.sh on behalf of a signed-in user.
//
// ! This endpoint publishes to a public ntfy topic, so it has to be treated as a
// ! write endpoint, not a utility. It previously had no auth, no origin check and
// ! CORS '*', which made it an open relay: anyone who found the URL could publish
// ! arbitrary titles and bodies to any topic through this deployment.
//
// Two gates now:
//   1. Origin must be one of ours (or same-origin, where the header is absent).
//   2. Caller must present a valid Supabase access token.
// Neither is airtight on its own — the topic itself is still a shared secret, and
// only ~32 bits of one — but together they stop drive-by abuse.

import { createClient } from '@supabase/supabase-js'

// Same-origin requests from the PWA send no Origin header at all, so an absent
// Origin is allowed; a *present but unrecognised* one is not.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

function originAllowed(origin) {
  if (!origin) return true
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Vercel preview deployments for this project
  try {
    const { hostname, protocol } = new URL(origin)
    return protocol === 'https:' && hostname.endsWith('.vercel.app')
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin
  if (!originAllowed(origin)) return res.status(403).json({ error: 'Forbidden' })
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  // * Anon key + the caller's own token: this only confirms "a real signed-in user
  // * is asking", it deliberately does not use the service role.
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return res.status(500).json({ error: 'Server is not configured' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in required' })

  const supabase = createClient(url, anonKey)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Sign in required' })

  const { topic, title, body, priority = 3, tags } = req.body || {}
  if (!topic || !title) return res.status(400).json({ error: 'topic and title required' })
  // ! Cap the payload — this reaches a third-party service under our name.
  if (String(title).length > 200 || String(body || '').length > 1000) {
    return res.status(400).json({ error: 'title or body too long' })
  }

  try {
    const r = await fetch(`https://ntfy.sh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message: body || '', priority, ...(tags ? { tags: Array.isArray(tags) ? tags : [tags] } : {}) }),
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return res.status(r.status).json({ error: `ntfy returned ${r.status}` })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
