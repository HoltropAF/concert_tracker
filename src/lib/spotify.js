// * Spotify Web API — PKCE OAuth helpers
// * Uses Authorization Code + PKCE so only the Client ID is needed (no secret).
// * Each user registers their own Spotify app so the redirect URI matches their Vercel URL.

// ============================================================
// PKCE HELPERS
// ============================================================

function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ============================================================
// AUTH FLOW
// ============================================================

// * Generates PKCE params, stores verifier + state in sessionStorage (survives
// * the redirect), then sends the browser to Spotify's authorization page.
// ! The redirect URI registered in the Spotify dashboard must exactly match
// ! window.location.origin — no trailing slash, no path.
export async function startSpotifyAuth(clientId) {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = crypto.randomUUID()

  sessionStorage.setItem('spotify_code_verifier', verifier)
  sessionStorage.setItem('spotify_oauth_state', state)
  sessionStorage.setItem('spotify_oauth_client_id', clientId)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: window.location.origin,
    scope: 'playlist-modify-public playlist-modify-private',
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

// * Exchange the authorization code for access + refresh tokens.
// * clientId is read from sessionStorage (stored before the redirect) so this
// * works even if the user hadn't saved Settings yet when they clicked Connect.
export async function exchangeCodeForTokens(code, verifier, clientId) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: window.location.origin,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify token exchange failed (${res.status}): ${text}`)
  }
  return res.json()
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

// * Returns true if the token will expire within the next 5 minutes.
export function isTokenExpired(expiryMs) {
  return !expiryMs || Date.now() > expiryMs - 5 * 60 * 1000
}

// * Returns a valid access token, transparently refreshing it if expired.
// * Saves the refreshed token back to settings so the next call is fast.
export async function getValidSpotifyToken(settings, saveSettings) {
  if (settings.spotifyAccessToken && !isTokenExpired(settings.spotifyTokenExpiry)) {
    return settings.spotifyAccessToken
  }
  if (!settings.spotifyRefreshToken || !settings.spotifyClientId) return null

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.spotifyClientId,
      grant_type: 'refresh_token',
      refresh_token: settings.spotifyRefreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`)
  const data = await res.json()

  const next = {
    ...settings,
    spotifyAccessToken: data.access_token,
    spotifyTokenExpiry: Date.now() + data.expires_in * 1000,
    ...(data.refresh_token ? { spotifyRefreshToken: data.refresh_token } : {}),
  }
  await saveSettings(next)
  return data.access_token
}
