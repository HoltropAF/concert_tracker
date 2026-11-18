// The /api functions spend this deployment's own API quotas (SerpApi, setlist.fm,
// Ticketmaster) and Vercel function time, so only signed-in users may call them.
// The browser sends its Supabase access token; we ask Supabase who it belongs to.
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
