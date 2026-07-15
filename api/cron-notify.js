// api/cron-notify.js
// Vercel cron job — runs once daily (Vercel's Hobby plan does not allow more
// frequent cron schedules; see vercel.json).
//
// Because this only runs once a day, it can't hit the precise "30 minutes
// before" / "at sale time" moments — that precision only happens client-side
// (see src/lib/notifications.js) while the app is open. This job is the
// fallback for when the app is closed: a "heads up, a sale is coming up
// within the next day or so" digest, sent once per show via ntfy.

import { createClient } from '@supabase/supabase-js'

const LOOKAHEAD_HOURS = 30 // catches any sale landing before the next run, with slack for Vercel's "sometime in the hour" timing

export default async function handler(req, res) {
  // Vercel cron requests carry this header automatically
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // service role — bypasses RLS
  )

  const now = Date.now()
  const lookaheadMs = now + LOOKAHEAD_HOURS * 60 * 60 * 1000

  const { data: concertRows, error: concertsErr } = await supabase.from('concerts').select('id, data, user_id')
  if (concertsErr) return res.status(500).json({ error: concertsErr.message })

  // Group upcoming sales by user so we only fetch each user's settings once
  const byUser = new Map()
  for (const row of concertRows) {
    const c = row.data
    if (!c?.wishlist || !c?.ticketSaleAt) continue
    const saleMs = new Date(c.ticketSaleAt).getTime()
    if (!(saleMs > now && saleMs <= lookaheadMs)) continue
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, [])
    byUser.get(row.user_id).push({ id: row.id, ...c })
  }

  const fired = []

  for (const [userId, shows] of byUser) {
    const { data: settingsRow } = await supabase.from('settings').select('data').eq('user_id', userId).single()
    const topic = settingsRow?.data?.ntfyTopic
    if (!topic) continue

    const alreadyNotified = new Set(settingsRow.data.notifiedSaleDigestIds || [])
    const toNotify = shows.filter(s => !alreadyNotified.has(s.id))
    if (toNotify.length === 0) continue

    for (const show of toNotify) {
      const saleDate = new Date(show.ticketSaleAt)
      const when = saleDate.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
      await sendNtfy(topic, '🎫 Tickets going on sale soon', `${show.artist} — ${when}`, 4, 'ticket')
      fired.push({ user: userId, concert: show.artist })
      alreadyNotified.add(show.id)
    }

    await supabase.from('settings').update({
      data: { ...settingsRow.data, notifiedSaleDigestIds: [...alreadyNotified] },
    }).eq('user_id', userId)
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
