// api/notify.js
// Sends a push notification via ntfy.sh
// Called by the Vercel cron job (vercel.json) and optionally directly from the client.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { topic, title, body, priority = 3, tags } = req.body || {}
  if (!topic || !title) return res.status(400).json({ error: 'topic and title required' })

  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tags ? { Tags: tags } : {}),
      },
      body: JSON.stringify({ topic, title, message: body || '', priority, ...(tags ? { tags: Array.isArray(tags) ? tags : [tags] } : {}) }),
    })
    if (!r.ok) return res.status(r.status).json({ error: `ntfy returned ${r.status}` })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
