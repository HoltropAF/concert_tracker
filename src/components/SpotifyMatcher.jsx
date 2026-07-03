import { useState, useEffect, useRef } from 'react'
import { getValidSpotifyToken } from '../lib/spotify'

const getSongName = s => typeof s === 'string' ? s : (s?.name || '')
const getSongSpotifyId = s => (s && typeof s === 'object') ? (s.spotifyId || null) : null

const norm = s => s.toLowerCase()
  .replace(/[''`]/g, "'")
  .replace(/[^a-z0-9 ']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isGoodMatch = (a, b) => {
  const na = norm(a), nb = norm(b)
  if (na === nb) return true
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  return longer.startsWith(shorter)
}

export default function SpotifyMatcher({ artist, songs, settings, saveSettings, onSave, onClose }) {
  const [results, setResults] = useState(() => new Array(songs.length).fill(null))
  const [choices, setChoices] = useState({})
  const [unlinked, setUnlinked] = useState(new Set())
  const [phase, setPhase] = useState('searching')
  const cancelled = useRef(false)
  const tokenRef = useRef(null)

  useEffect(() => {
    cancelled.current = false
    run()
    return () => { cancelled.current = true }
  }, [])

  async function getToken() {
    if (tokenRef.current) return tokenRef.current
    const t = await getValidSpotifyToken(settings, saveSettings).catch(() => null)
    tokenRef.current = t
    return t
  }

  async function searchSong(token, name) {
    try {
      const q = encodeURIComponent(`track:${name} artist:${artist}`)
      let r = await fetch(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (r.status === 429) {
        await new Promise(ok => setTimeout(ok, 2000))
        r = await fetch(
          `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
      if (!r.ok) return { notFound: true }
      const data = await r.json()
      const items = (data.tracks?.items || []).filter(t => t?.id)
      if (!items.length) return { notFound: true }
      const top = items[0]
      return {
        id: top.id,
        name: top.name,
        artists: top.artists.map(a => a.name).join(', '),
        confidence: isGoodMatch(name, top.name) ? 'high' : 'low',
      }
    } catch {
      return { notFound: true }
    }
  }

  async function run() {
    const token = await getToken()
    if (!token) { setPhase('done'); return }

    const res = new Array(songs.length).fill(null)
    const ch = {}

    for (let i = 0; i < songs.length; i++) {
      if (cancelled.current) return

      if (getSongSpotifyId(songs[i])) {
        res[i] = { alreadyLinked: true, existingId: getSongSpotifyId(songs[i]) }
        setResults([...res])
        continue
      }

      const result = await searchSong(token, getSongName(songs[i]))
      res[i] = result
      if (result.id && result.confidence === 'high') ch[i] = result.id

      setResults([...res])
      setChoices({ ...ch })
      await new Promise(ok => setTimeout(ok, 120))
    }

    if (!cancelled.current) {
      setResults([...res])
      setChoices({ ...ch })
      setPhase('done')
    }
  }

  const handleUnlink = async (i) => {
    setUnlinked(prev => new Set([...prev, i]))
    setChoices(prev => { const n = { ...prev }; delete n[i]; return n })
    setResults(prev => { const r = [...prev]; r[i] = null; return r })

    const token = await getToken()
    if (!token) {
      setResults(prev => { const r = [...prev]; r[i] = { notFound: true }; return r })
      return
    }
    const result = await searchSong(token, getSongName(songs[i]))
    setResults(prev => { const r = [...prev]; r[i] = result; return r })
  }

  const handleRelink = (i) => {
    setUnlinked(prev => { const n = new Set(prev); n.delete(i); return n })
    const existingId = getSongSpotifyId(songs[i])
    if (existingId) setChoices(prev => ({ ...prev, [i]: existingId }))
    setResults(prev => {
      const r = [...prev]
      r[i] = { alreadyLinked: true, existingId }
      return r
    })
  }

  const toggle = (i) => {
    const r = results[i]
    if (!r?.id) return
    setChoices(prev => {
      const next = { ...prev }
      if (next[i]) delete next[i]; else next[i] = r.id
      return next
    })
  }

  const handleSave = () => {
    const updated = songs.map((song, i) => {
      const newId = choices[i]
      if (newId) {
        const base = typeof song === 'string' ? { name: song } : { ...song }
        return { ...base, spotifyId: newId }
      }
      if (unlinked.has(i) && !newId) {
        if (typeof song === 'string') return song
        const { spotifyId, ...rest } = song
        return Object.keys(rest).length === 1 && rest.name ? rest.name : rest
      }
      return song
    })
    onSave(updated)
    onClose()
  }

  const newLinkCount = Object.keys(choices).length
  const unlinkCount = [...unlinked].filter(i => !choices[i]).length
  const changeCount = newLinkCount + unlinkCount
  const doneCount = results.filter(r => r !== null).length
  const stillSearching = doneCount < songs.length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#13131f', border: '1px solid #2a2850', borderRadius: '16px 16px 0 0', padding: '20px 18px 32px', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff' }}>Spotify links</div>
            <div style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
              {artist} · {songs.length} songs
              {stillSearching
                ? ` · searching ${doneCount}/${songs.length}…`
                : changeCount > 0 ? ` · ${changeCount} change${changeCount !== 1 ? 's' : ''}` : ' · no changes'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 0 0 12px' }}>×</button>
        </div>

        {/* Song list */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
          {songs.map((song, i) => {
            const name = getSongName(song)
            const result = results[i]
            const confirmed = !!choices[i]
            const isUnlinked = unlinked.has(i)

            if (result?.alreadyLinked) return (
              <div key={i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#1DB954', fontSize: 11, flexShrink: 0 }}>●</span>
                <span style={{ color: '#c4c2f0', fontSize: 13, flex: 1 }}>{name}</span>
                <button
                  onClick={() => handleUnlink(i)}
                  style={{ background: 'none', border: '1px solid #3a1a1a', borderRadius: 6, color: '#6b3a3a', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}
                >
                  unlink
                </button>
              </div>
            )

            return (
              <div key={i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #1a1a2e' }}>
                <div style={{ fontSize: 13, color: result === null ? '#5a5878' : '#c4c2f0', marginBottom: result === null ? 0 : 5 }}>
                  {name}
                  {isUnlinked && <span style={{ color: '#f472b6', fontSize: 10, fontFamily: "'DM Mono', monospace", marginLeft: 8 }}>unlinked</span>}
                </div>
                {result === null && (
                  <div style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace" }}>searching…</div>
                )}
                {result?.notFound && !isUnlinked && (
                  <div style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace" }}>not found on Spotify</div>
                )}
                {result?.notFound && isUnlinked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace", flex: 1 }}>not found on Spotify</div>
                    <button onClick={() => handleRelink(i)} style={{ background: 'none', border: '1px solid #1DB95444', borderRadius: 6, color: '#1DB954', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>keep link</button>
                  </div>
                )}
                {result?.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: result.confidence === 'high' ? '#6ee7b7' : '#fbbf24', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {result.name}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>
                        {result.artists}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {isUnlinked && (
                        <button onClick={() => handleRelink(i)} style={{ background: 'none', border: '1px solid #1DB95444', borderRadius: 6, color: '#1DB954', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>keep link</button>
                      )}
                      <button
                        onClick={() => toggle(i)}
                        style={{
                          padding: '4px 12px', borderRadius: 6,
                          background: confirmed ? '#1DB954' : 'none',
                          border: `1px solid ${confirmed ? '#1DB954' : '#3a3858'}`,
                          color: confirmed ? '#000' : '#6b6a8f',
                          fontSize: 11, fontWeight: confirmed ? 700 : 400,
                          cursor: 'pointer', fontFamily: "'DM Mono', monospace",
                          transition: 'all 0.1s',
                        }}
                      >
                        {confirmed ? '✓ linked' : 'link'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={changeCount === 0}
            style={{
              flex: 1, padding: '12px', borderRadius: 9,
              background: changeCount > 0 ? '#1DB954' : '#1a2e24',
              border: 'none',
              color: changeCount > 0 ? '#000' : '#3a5a3a',
              fontSize: 13, fontWeight: 700,
              cursor: changeCount > 0 ? 'pointer' : 'default',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {changeCount > 0 ? `Save ${changeCount} change${changeCount !== 1 ? 's' : ''}` : 'No changes'}
          </button>
          <button
            onClick={onClose}
            style={{ padding: '12px 18px', borderRadius: 9, background: 'none', border: '1px solid #2a2850', color: '#6b6a8f', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
