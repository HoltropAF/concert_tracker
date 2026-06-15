// api/cron-notify.js
// Vercel cron job — runs every 15 minutes.
// Checks all concerts in Supabase for wishlist entries with upcoming ticket sales
// and sends ntfy notifications 30 min before and at sale time.
// Configure in vercel.json: { "crons": [{ "path": "/api/cron-notify", "schedule": "*/15 * * * *" }] }

import { createClient } from '@supabase/supabase-js'

const WINDOW_MIN = 15   // how often the cron runs (minutes)
const WARN_MIN   = 30   // how early to send the warning notification

export default async function handler(req, res) {
  // Vercel cron requests have an Authorization header
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // service role — bypasses RLS
  )

  const now = new Date()
  const windowEnd = new Date(now.getTime() + WINDOW_MIN * 60 * 1000)

  // Fetch all concert rows that have wishlist entries with a ticketSaleAt
  const { data: rows, error } = await supabase
    .from('concerts')
    .select('data, user_id')

  if (error) return res.status(500).json({ error: error.message })

  const fired = []

  for (const row of rows) {
    const concert = row.data
    if (!concert.wishlist || !concert.ticketSaleAt) continue

    // Find the ntfy topic stored in this user's settings
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('data')
      .eq('user_id', row.user_id)
      .single()

    const ntfyTopic = settingsRow?.data?.ntfyTopic
    if (!ntfyTopic) continue

    const saleMs  = new Date(concert.ticketSaleAt).getTime()
    const nowMs   = now.getTime()
    const endMs   = windowEnd.getTime()

    // 30-min warning: sale is between (now + WARN_MIN - WINDOW) and (now + WARN_MIN)
    const warnWindowStart = nowMs + (WARN_MIN - WINDOW_MIN) * 60 * 1000
    const warnWindowEnd   = nowMs + WARN_MIN * 60 * 1000
    if (saleMs > warnWindowStart && saleMs <= warnWindowEnd) {
      await sendNtfy(ntfyTopic, '🎫 Tickets in 30 minutes', `${concert.artist} — sale starts soon!`, 4, 'rotating_light')
      fired.push({ concert: concert.artist, type: 'warning' })
    }

    // At sale time: sale is within this cron window
    if (saleMs > nowMs && saleMs <= endMs) {
      await sendNtfy(ntfyTopic, '🎫 Tickets on sale NOW', `${concert.artist} — go get your tickets!`, 5, 'fire')
      fired.push({ concert: concert.artist, type: 'sale' })
    }
  }

  return res.status(200).json({ ok: true, fired })
}

async function sendNtfy(topic, title, body, priority, tag) {
  await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title, message: body, priority, tags: [tag] }),
  })
}
