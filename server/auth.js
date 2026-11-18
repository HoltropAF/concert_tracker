// The /api functions spend this deployment's own API quotas (SerpApi, setlist.fm,
// Ticketmaster) and Vercel function time. Signed-in users send their Supabase
// access token and we ask Supabase who it belongs to. Demo visitors (no token)
// get a small daily allowance per feature, see requireUserOrGuest below.
const verified = new Map()
const perUser = new Map()
const deny = (res, status, error) => { res.status(status).json({ error }); return null }

export async function requireUser(req, res, { fetcher = fetch, env = process.env, now = Date.now() } = {}) {
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(req.headers?.authorization || '')?.[1]
  if (!token) return deny(res, 401, 'Sign in to use online lookups.')
  const hit = verified.get(token)
  if (hit && hit.expires > now) return hit.user
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!url || !key) return deny(res, 503, 'Online lookups need the Supabase settings in this Vercel project.')
  let response
  try {
    response = await fetcher(url.replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(5000) })
  } catch {
    return deny(res, 503, 'Could not check your sign-in. Try again.')
  }
  const user = response.ok ? await response.json().catch(() => null) : null
  if (!user?.id) return response.ok || response.status === 401 || response.status === 403
    ? deny(res, 401, 'Your sign-in has expired. Sign in again to use online lookups.')
    : deny(res, 503, 'Could not check your sign-in. Try again.')
  if (verified.size >= 500) verified.delete(verified.keys().next().value)
  verified.set(token, { user: user.id, expires: now + 300000 })
  return user.id
}

// Tests call the handlers directly; this marks a token as already checked.
export function rememberVerifiedToken(token, user, now = Date.now()) { verified.set(token, { user, expires: now + 300000 }) }

// Per-user allowance on top of sign-in, so one account cannot drain a shared quota.
export function withinUserLimit(user, bucket, limit, windowMs = 60000, now = Date.now()) {
  const key = bucket + ':' + user
  const recent = (perUser.get(key) || []).filter(time => time > now - windowMs)
  if (recent.length >= limit) { perUser.set(key, recent); return false }
  recent.push(now)
  if (perUser.size >= 1000) perUser.delete(perUser.keys().next().value)
  perUser.set(key, recent)
  return true
}

// Demo visitors can try each feature a few times. The browser stops them after 3
// tries (src/lib/api.js); these server caps are the backstop against scripts. One
// try can take a few requests (a wishlist check asks several sources), hence 15.
// The shared caps bound what all guests together can spend per day. Only setlist
// search and show discovery are open to the demo; the other endpoints use
// requireUser and are for signed-in users only.
export const GUEST_PER_IP = 15
export const GUEST_TOTAL = { setlist: 150, upcoming: 150 }
export const DEMO_LIMIT_MESSAGE = 'You have used your demo tries for this feature. Sign in (it is free) to keep using it.'
const day = 86400000
// Kept apart from perUser so many guest addresses can never push these out.
const guestTotals = new Map()

export async function requireUserOrGuest(req, res, feature, options = {}) {
  if (req.headers?.authorization) return requireUser(req, res, options)
  const now = options.now ?? Date.now()
  const ip = String(req.headers?.['x-real-ip'] || req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim()
  if (!withinUserLimit('ip:' + ip, 'guest-' + feature, GUEST_PER_IP, day, now)) return deny(res, 429, DEMO_LIMIT_MESSAGE)
  const shared = (guestTotals.get(feature) || []).filter(time => time > now - day)
  guestTotals.set(feature, shared)
  if (shared.length >= (GUEST_TOTAL[feature] ?? 0)) return deny(res, 429, "The demo has used up today's tries for this feature. Sign in (it is free) to keep using it.")
  shared.push(now)
  return 'guest'
}
