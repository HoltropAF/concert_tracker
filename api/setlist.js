export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.SETLISTFM_API_KEY;
  const { url, artist, date } = req.query;

  // Search mode: ?artist=X&date=YYYY-MM-DD → find the show and return songs + venue metadata
  if (artist && date) {
    if (!apiKey) return res.status(501).json({ error: 'search_unavailable' });
    try {
      const [y, m, d] = String(date).split('-');
      const sfDate = `${d}-${m}-${y}`;
      const apiRes = await fetch(`https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist)}&date=${sfDate}`, {
        headers: { 'x-api-key': apiKey, 'Accept': 'application/json' }
      });
      if (apiRes.status === 404) return res.status(404).json({ error: 'not_found' });
      if (!apiRes.ok) return res.status(apiRes.status).json({ error: `setlist.fm returned ${apiRes.status}` });
      const data = await apiRes.json();
      const sl = (data.setlist || [])[0];
      if (!sl) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(extractSetlist(sl));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const parsedUrl = parseSetlistUrl(url);
  if (!parsedUrl) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    // Best path: use the official API if a key is configured as a Vercel env var
    if (apiKey) {
      const idMatch = parsedUrl.pathname.match(/([0-9a-f]{6,10})\.html/i);
      if (idMatch) {
        const apiRes = await fetch(`https://api.setlist.fm/rest/1.0/setlist/${idMatch[1]}`, {
          headers: { 'x-api-key': apiKey, 'Accept': 'application/json' }
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          const out = extractSetlist(data);
          if (out.songs.length || out.venue) return res.status(200).json(out);
        }
      }
    }

    // Fallback: scrape the public page and parse server-side with regex
    const pageRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    if (!pageRes.ok) return res.status(pageRes.status).json({ error: `setlist.fm returned ${pageRes.status}` });
    const html = await pageRes.text();

    const songs = parseSongs(html);
    if (!songs.length) return res.status(422).json({
      error: 'no_songs_found',
      debug: {
        htmlLength: html.length,
        isCloudflare: html.includes('cloudflare') || html.includes('cf-browser-verification'),
        hasSongLabel: html.includes('songLabel'),
        hasLiSong: html.includes('"song"'),
        preview: html.slice(0, 300),
      }
    });
    return res.status(200).json({ songs });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function parseSetlistUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isSetlistFm = hostname === 'setlist.fm' || hostname === 'www.setlist.fm';
    if (!isSetlistFm || parsed.protocol !== 'https:') return null;
    if (!parsed.pathname.includes('/setlist/') || !parsed.pathname.endsWith('.html')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseSongs(html) {
  const strip = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
  const songs = [];

  // setlist.fm marks section breaks (Encore, Encore 2, Act I, etc.) with their
  // own <li class="setSubtitle">Encore:</li>-style entries in between songs —
  // best-effort only, since we're scraping HTML rather than using the real API.
  let pendingLabel = null;
  const isLikelyLabel = text => /^(encore|act\s|surprise|intro)/i.test(text) && text.length < 30;

  // Strategy 1: match full <li class="song">...</li> blocks and extract name + info,
  // walking the raw HTML in order so we can pick up subtitle-style <li> markers too.
  const liRe = /<li[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const [, classAttr, block] = m;
    if (/\bsong\b/.test(classAttr)) {
      const labelM = block.match(/class="[^"]*\bsongLabel\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const name = labelM ? strip(labelM[1]) : null;
      if (!name) {
        // No songLabel link usually means this is a tape-played "song played from
        // tape" entry, e.g. Ment (talking segment) — carry it forward as a label
        // instead of silently dropping it.
        const text = strip(block);
        if (/\bment\b/i.test(text) && text.length < 20) pendingLabel = 'MENT';
        continue;
      }
      const infoM = block.match(/class="[^"]*\b(?:songInfo|infos)\b[^"]*"[^>]*>([\s\S]*?)<\//i);
      const info = infoM ? strip(infoM[1]) : null;
      const entry = { name };
      if (info) entry.info = info;
      if (pendingLabel) { entry.sectionLabel = pendingLabel; pendingLabel = null; }
      songs.push(Object.keys(entry).length === 1 ? name : entry);
    } else if (/\bsubtitle\b|\bset-name\b|\bsetlistTitle\b/i.test(classAttr)) {
      const text = strip(block).replace(/:$/, '');
      if (isLikelyLabel(text)) pendingLabel = text.toUpperCase();
    }
  }
  if (songs.length) return songs;

  // Strategy 2: just grab every songLabel text if the li structure wasn't matched
  const labelRe = /class="[^"]*\bsongLabel\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = labelRe.exec(html)) !== null) {
    const name = strip(m[1]);
    if (name) songs.push(name);
  }
  return songs;
}

function extractSetlist(sl) {
  // setlist.fm marks spoken/talking breaks (very common in K-pop shows — "Ment" is
  // short for "moment", i.e. the MC segment between songs) as their own tape-played
  // "song" entries. We don't want them as actual songs in the list, but we don't want
  // to silently lose them either — carry them forward as a section label on the next
  // real song, same as we do for Encore/Act I/etc.
  const songs = [];
  let pendingLabel = null;
  for (const set of (sl.sets?.set || [])) {
    let isFirstInSet = true;
    for (const s of (set.song || [])) {
      if (s.tape && /^ment$/i.test((s.name || '').trim())) {
        pendingLabel = 'MENT';
        continue;
      }
      if (s.tape) continue; // other tape interludes (instrumental intros etc.) — skip as before
      if (!s.name) continue;
      const out = { name: s.name };
      if (s.info) out.info = s.info;
      if (s.cover?.name) out.cover = s.cover.name;
      // A set-level label (Encore, Act I, ...) takes priority on the first song of a
      // set; otherwise a pending Ment label (if one occurred right before this song).
      if (isFirstInSet && set.name) out.sectionLabel = set.name.toUpperCase();
      else if (pendingLabel) out.sectionLabel = pendingLabel;
      pendingLabel = null;
      isFirstInSet = false;
      songs.push(Object.keys(out).length === 1 ? out.name : out);
    }
  }
  let isoDate = null;
  if (sl.eventDate) { const [d, m, y] = sl.eventDate.split('-'); if (y) isoDate = `${y}-${m}-${d}`; }
  return {
    songs,
    date: isoDate,
    artist: sl.artist?.name || null,
    venue: sl.venue?.name || null,
    city: sl.venue?.city?.name || null,
    country: sl.venue?.city?.country?.name || null,
    tour: sl.tour?.name || null,
    url: sl.url || null,
  };
}
