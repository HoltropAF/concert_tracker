export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  const parsedUrl = parseSetlistUrl(url);
  if (!parsedUrl) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    // Best path: use the official API if a key is configured as a Vercel env var
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (apiKey) {
      const idMatch = parsedUrl.pathname.match(/([0-9a-f]{6,10})\.html/i);
      if (idMatch) {
        const apiRes = await fetch(`https://api.setlist.fm/rest/1.0/setlist/${idMatch[1]}`, {
          headers: { 'x-api-key': apiKey, 'Accept': 'application/json' }
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          const songs = (data.sets?.set || [])
            .flatMap(set => (set.song || []).filter(s => !s.tape).map(s => ({
              name: s.name,
              info: s.info || null
            })))
            .filter(s => s.name)
            .map(s => s.info ? s : s.name);
          if (songs.length) return res.status(200).json({ songs });
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

  // Strategy 1: match full <li class="song">...</li> blocks and extract name + info
  const liRe = /<li[^>]+class="[^"]*\bsong\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const block = m[1];
    const labelM = block.match(/class="[^"]*\bsongLabel\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const name = labelM ? strip(labelM[1]) : null;
    if (!name) continue;
    const infoM = block.match(/class="[^"]*\b(?:songInfo|infos)\b[^"]*"[^>]*>([\s\S]*?)<\//i);
    const info = infoM ? strip(infoM[1]) : null;
    songs.push(info ? { name, info } : name);
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
