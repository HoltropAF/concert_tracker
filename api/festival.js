export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  const parsedUrl = parseFestivalUrl(url);
  if (!parsedUrl) {
    return res.status(400).json({ error: 'Expected a setlist.fm/festival/ URL' });
  }

  try {
    const pageRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.setlist.fm/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!pageRes.ok) return res.status(pageRes.status).json({ error: `setlist.fm returned ${pageRes.status}` });
    const html = await pageRes.text();

    const days = parseFestivalDays(html);
    if (!days.length) {
      return res.status(422).json({
        error: 'no_acts_found',
        debug: {
          htmlLength: html.length,
          isCloudflare: html.includes('cloudflare') || html.includes('cf-browser-verification'),
          preview: html.slice(0, 400),
        },
      });
    }
    return res.status(200).json({ days });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function parseFestivalUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isSetlistFm = hostname === 'setlist.fm' || hostname === 'www.setlist.fm';
    if (!isSetlistFm || parsed.protocol !== 'https:') return null;
    if (!parsed.pathname.includes('/festival/') || !parsed.pathname.endsWith('.html')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function strip(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}

function parseFestivalDays(html) {
  const days = [];

  // Find all date headers — "Saturday, June 17, 2023"
  const dateRe = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g;
  const matches = [...html.matchAll(dateRe)];
  if (!matches.length) return [];

  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][0];
    const sectionStart = matches[i].index;
    const sectionEnd = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const section = html.slice(sectionStart, sectionEnd);

    const date = labelToIso(label);
    const artists = extractArtists(section);
    if (artists.length) days.push({ label, date, artists });
  }

  return days;
}

function extractArtists(section) {
  const artists = [];
  const seen = new Set();
  const add = (name) => { if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); artists.push(name); } };

  // Strategy 1: <td class="…artist…">…text…</td>
  const tdRe = /<td[^>]*class="[^"]*\bartist\b[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = tdRe.exec(section)) !== null) add(strip(m[1]));
  if (artists.length) return artists;

  // Strategy 2: links to /setlist/ pages (artist name is the link text)
  const linkRe = /<a[^>]+href="[^"]*\/setlist\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = linkRe.exec(section)) !== null) add(strip(m[1]));
  if (artists.length) return artists;

  // Strategy 3: links to /setlists/ (artist overview pages)
  const overviewRe = /<a[^>]+href="[^"]*\/setlists\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = overviewRe.exec(section)) !== null) add(strip(m[1]));
  return artists;
}

function labelToIso(label) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const m = label.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return null;
  const month = months.indexOf(m[1]) + 1;
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}`;
}
