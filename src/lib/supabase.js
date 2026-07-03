import { createClient } from '@supabase/supabase-js'

// ! Both env vars must be set in Vercel (Settings → Environment Variables).
// ! For local dev, copy .env.example → .env and fill them in.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// * isSupabaseConfigured is checked before every DB call throughout the app.
// * When false the app still loads, but only guest/demo mode is available.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error('Missing Supabase env vars — copy .env.example to .env and fill in your credentials')
}

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null
