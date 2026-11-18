// Calls this app's own /api functions with the signed-in user's Supabase token.
// Guests have no token, so the server answers 401 with a "Sign in" message.
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers)
  try {
    const { supabase } = await import('./supabase.js')
    const token = supabase && (await supabase.auth.getSession()).data?.session?.access_token
    if (token) headers.set('Authorization', 'Bearer ' + token)
  } catch { /* No session: the request goes out unsigned and the server says why. */ }
  return fetch(url, { ...options, headers })
}
