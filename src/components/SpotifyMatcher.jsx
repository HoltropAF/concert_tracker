// * Bulk-links one artist's setlist to Spotify tracks. Opened as a sheet from a
// * setlist; searches every song automatically, then lets the user confirm, correct
// * or unlink each one before a single save.
// *
// * Nothing is written until the user hits Save — `onSave(updatedSongs)` receives the
// * complete rewritten song array and the caller persists it. This component never
// * touches Supabase.
// *
// ! Requires an already-connected Spotify account (Settings). Without a valid token
// ! getToken() returns null and every row silently stays in the "searching" state.
import { useState, useEffect, useRef } from 'react'
import { getValidSpotifyToken } from '../lib/spotify'

// ! Duplicated from ConcertTracker.jsx rather than imported, to keep this component
// ! independently lazy-loadable. If the song shape changes, both copies must change.
const getSongName = s => typeof s === 'string' ? s : (s?.name || '')
const getSongSpotifyId = s => (s && typeof s === 'object' && s.spotifyId) ? s.spotifyId : null

// Strips case, punctuation and curly quotes so "Don't Stop Me Now!" and
// "Dont Stop Me Now" compare equal.
const norm = s => s.toLowerCase()
  .replace(/[''`]/g, "'")
  .replace(/[^a-z0-9 ']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

// Decides whether a Spotify result is confident enough to pre-confirm. Prefix
// matching (not just equality) is deliberate: Spotify titles routinely carry
// suffixes a setlist doesn't — "Song - Live", "Song (Remastered 2011)".
// ! It's prefix-only, so a title that differs at the start ("Live at Wembley - Song")
// ! scores as low confidence and lands in the manual-review pile.
const isGoodMatch = (a, b) => {
  const na = norm(a), nb = norm(b)
  if (na === nb) return true
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  return longer.startsWith(shorter)
}

// Flattens a Spotify track into the subset we store on a song. These exact keys are
// what handleSave writes onto (and strips off) the song object.
const extractTrack = t => ({
  id: t.id,
  name: t.name,
  artists: t.artists.map(a => a.name).join(', '),
  albumName: t.album?.name || '',
  albumId: t.album?.id || '',
  albumArt: t.album?.images?.[0]?.url || '',
  durationMs: t.duration_ms || null,
  popularity: typeof t.popularity === 'number' ? t.popularity : null,
  trackNumber: t.track_number || null,
})

// Inline free-text Spotify search, expanded under a single song row when the
// automatic match was wrong, low-confidence or not found.
function ManualSearchPanel({ query, setQuery, onSearch, loading, results, onPick, onCancel }) {
  return (
    <div style={{ marginTop: 8, background: '#0e0e1a', borderRadius: 8, padding: 10, border: '1px solid #1f1f35' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          placeholder="song title, artist…"
          autoFocus
          style={{ flex: 1, background: '#13131f', border: '1px solid #2a2850', borderRadius: 6, color: '#c4c2f0', padding: '6px 10px', fontSize: 12, fontFamily: "'DM Mono', monospace", outline: 'none', boxSizing: 'border-box' }}
        />
        <button
          onClick={onSearch}
          disabled={loading || !query?.trim()}
          style={{ background: loading || !query?.trim() ? '#2a2850' : '#a78bfa', border: 'none', borderRadius: 6, color: '#0c0c14', fontSize: 11, fontWeight: 700, padding: '0 14px', cursor: loading || !query?.trim() ? 'default' : 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}
        >
          {loading ? '…' : 'Search'}
        </button>
      </div>
      {results.length === 0 && !loading && (
        <div style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace", padding: '4px 0' }}>type to search Spotify</div>
      )}
      {results.map(track => (
        <button key={track.id} onClick={() => onPick(track)}
          style={{ width: '100%', textAlign: 'left', background: 'none', border: '1px solid #1f1f35', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          {track.albumArt
            ? <img src={track.albumArt} alt="" style={{ width: 28, height: 28, borderRadius: 3, flexShrink: 0, objectFit: 'cover' }} />
            : <div style={{ width: 28, height: 28, borderRadius: 3, background: '#1a1a2e', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#c4c2f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</div>
            <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {track.artists}{track.albumName ? ` · ${track.albumName}` : ''}
            </div>
          </div>
        </button>
      ))}
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#4a4870', fontSize: 10, cursor: 'pointer', padding: '4px 0 0', fontFamily: "'DM Mono', monospace" }}>
        Cancel
      </button>
    </div>
  )
}

// * All state is keyed by a song's index in the `songs` array, not by name — the same
// * title can legitimately appear twice in one setlist.
// * A row's rendered state is decided by the precedence: removals → choices → results.
// *   results[i] === null   still searching
// *   results[i].alreadyLinked  had a spotifyId before this session
// *   results[i].notFound   search returned nothing
// *   results[i].id         a suggestion awaiting confirmation (high/low confidence)
// *   choices[i]            user-confirmed track, will be written on save
// *   removals.has(i)       existing link will be stripped on save
// ! `songs` is read once into per-index state; the component assumes the array does
// ! not change identity or length while it's mounted.
export default function SpotifyMatcher({ artist, songs, settings, saveSettings, onSave, onClose }) {
  const [results, setResults] = useState(() => new Array(songs.length).fill(null))
  const [choices, setChoices] = useState({})   // index → confirmed track object
  const [removals, setRemovals] = useState(new Set()) // indices to wipe spotifyId on save
  const [panelOpen, setPanelOpen] = useState(new Set())
  const [manualQuery, setManualQuery] = useState({})
  const [manualResults, setManualResults] = useState({})
  const [manualLoading, setManualLoading] = useState(new Set())
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

  // * Retries once on a 429 after a flat 2s wait — enough for the light burst this
  // * component makes. Any other failure returns [] rather than throwing, so one bad
  // * song can't abort the run() loop partway through the setlist.
  async function searchSpotify(query, limit = 5) {
    const token = await getToken()
    if (!token) return []
    try {
      const q = encodeURIComponent(query)
      let r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.status === 429) {
        await new Promise(ok => setTimeout(ok, 2000))
        r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      if (!r.ok) return []
      const data = await r.json()
      return (data.tracks?.items || []).filter(t => t?.id).map(extractTrack)
    } catch { return [] }
  }

  // * The initial auto-match pass. Deliberately sequential with a 120ms gap rather
  // * than Promise.all: a 30-song setlist fired in parallel reliably trips Spotify's
  // * rate limiter. Results are published after each song so the list fills in live.
  // * High-confidence matches are pre-confirmed into `choices`; low-confidence ones
  // * are left as suggestions the user has to accept.
  // * `cancelled` (set by the unmount cleanup) aborts the loop, so closing the sheet
  // * mid-search doesn't keep calling setState on an unmounted component.
  async function run() {
    const token = await getToken()
    if (!token) return
    const res = new Array(songs.length).fill(null)
    const ch = {}
    for (let i = 0; i < songs.length; i++) {
      if (cancelled.current) return
      const existingId = getSongSpotifyId(songs[i])
      if (existingId) {
        const s = songs[i]
        res[i] = { alreadyLinked: true, existingId, existingName: s.spotifyName || getSongName(s), existingAlbumName: s.albumName || '', existingAlbumArt: s.albumArt || '' }
        setResults([...res])
        continue
      }
      const name = getSongName(songs[i])
      const items = await searchSpotify(`track:${name} artist:${artist}`, 3)
      if (!items.length) {
        res[i] = { notFound: true }
      } else {
        const top = items[0]
        const confidence = isGoodMatch(name, top.name) ? 'high' : 'low'
        res[i] = { ...top, confidence }
        if (confidence === 'high') ch[i] = top
      }
      setResults([...res])
      setChoices({ ...ch })
      await new Promise(ok => setTimeout(ok, 120))
    }
    if (!cancelled.current) { setResults([...res]); setChoices({ ...ch }) }
  }

  const openPanel = (i) => {
    setPanelOpen(prev => new Set([...prev, i]))
    setManualQuery(prev => ({ ...prev, [i]: getSongName(songs[i]) }))
    setManualResults(prev => ({ ...prev, [i]: [] }))
  }
  const closePanel = (i) => setPanelOpen(prev => { const n = new Set(prev); n.delete(i); return n })

  const handleManualSearch = async (i) => {
    const q = (manualQuery[i] || '').trim()
    if (!q) return
    setManualLoading(prev => new Set([...prev, i]))
    const items = await searchSpotify(q, 5)
    setManualResults(prev => ({ ...prev, [i]: items }))
    setManualLoading(prev => { const n = new Set(prev); n.delete(i); return n })
  }

  const pickTrack = (i, track) => { setChoices(prev => ({ ...prev, [i]: track })); closePanel(i) }
  const unpickTrack = (i) => setChoices(prev => { const n = { ...prev }; delete n[i]; return n })

  // Mark a song for removal (strips spotifyId on save). Also clears any pending choice.
  const removeLink = (i) => {
    setRemovals(prev => new Set([...prev, i]))
    setChoices(prev => { const n = { ...prev }; delete n[i]; return n })
    closePanel(i)
  }
  const restoreLink = (i) => setRemovals(prev => { const n = new Set(prev); n.delete(i); return n })

  // Unlink every song that currently has or will get a Spotify link
  const unlinkAll = () => {
    const toRemove = new Set(songs.map((_, i) => i).filter(i => results[i]?.alreadyLinked || choices[i]))
    setRemovals(toRemove)
    setChoices({})
  }

  // * Rewrites the whole song array in one pass and hands it to onSave.
  // * Unlinking narrows a song back down: strip the Spotify keys, and if `name` is all
  // * that's left, collapse the object back to a plain string so the data shape stays
  // * as small as it was before it was ever linked.
  const handleSave = () => {
    const updated = songs.map((song, i) => {
      const choice = choices[i]
      if (choice) {
        const base = typeof song === 'string' ? { name: song } : { ...song }
        return { ...base, spotifyId: choice.id, spotifyName: choice.name, albumName: choice.albumName, albumId: choice.albumId, albumArt: choice.albumArt, durationMs: choice.durationMs, popularity: choice.popularity, trackNumber: choice.trackNumber }
      }
      if (removals.has(i)) {
        if (typeof song === 'string') return song
        const { spotifyId, spotifyName, albumName, albumId, albumArt, durationMs, popularity, trackNumber, ...rest } = song
        return Object.keys(rest).length === 1 && rest.name ? rest.name : rest
      }
      return song
    })
    onSave(updated)
    onClose()
  }

  const changeCount = Object.keys(choices).length + removals.size
  const doneCount = results.filter(r => r !== null).length
  const stillSearching = doneCount < songs.length
  const hasAnyLinked = results.some((r, i) => r?.alreadyLinked && !removals.has(i) && !choices[i]) || Object.keys(choices).length > 0

  const XBtn = ({ i }) => (
    <button onClick={() => removeLink(i)} title="Remove link"
      style={{ background: 'none', border: '1px solid #3a1a1a', borderRadius: 6, color: '#6b4040', fontSize: 12, padding: '3px 7px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>
      ×
    </button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#13131f', border: '1px solid #2a2850', borderRadius: '16px 16px 0 0', padding: '20px 18px 32px', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, color: '#e2e0ff' }}>Link to Spotify</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: '#4a4870', fontFamily: "'DM Mono', monospace" }}>
                {artist} · {songs.length} song{songs.length !== 1 ? 's' : ''}
                {stillSearching ? ` · searching ${doneCount}/${songs.length}…` : changeCount > 0 ? ` · ${changeCount} change${changeCount !== 1 ? 's' : ''}` : ''}
              </span>
              {hasAnyLinked && (
                <button onClick={unlinkAll}
                  style={{ background: 'none', border: 'none', color: '#6b4040', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: "'DM Mono', monospace", textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  Unlink all
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4870', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 0 0 12px' }}>×</button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          {[{ color: '#6ee7b7', label: 'auto-matched' }, { color: '#fbbf24', label: 'needs review' }, { color: '#4a4870', label: 'not found' }, { color: '#1DB954', label: 'linked' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Song rows */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
          {songs.map((song, i) => {
            const songName = getSongName(song)
            const result = results[i]
            const choice = choices[i]
            const isRemoved = removals.has(i)
            const hasPanelOpen = panelOpen.has(i)
            const mResults = manualResults[i] || []
            const mLoading = manualLoading.has(i)

            const Dot = ({ color }) => (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block', marginTop: 2 }} />
            )
            const Art = ({ src }) => src
              ? <img src={src} alt="" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />
              : <div style={{ width: 36, height: 36, borderRadius: 4, background: '#1a1a2e', flexShrink: 0 }} />
            const TrackMeta = ({ name, sub }) => (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#c4c2f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {sub && <div style={{ fontSize: 10, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
              </div>
            )
            const panel = hasPanelOpen && (
              <ManualSearchPanel
                query={manualQuery[i] || ''}
                setQuery={q => setManualQuery(p => ({ ...p, [i]: q }))}
                onSearch={() => handleManualSearch(i)}
                loading={mLoading}
                results={mResults}
                onPick={t => pickTrack(i, t)}
                onCancel={() => closePanel(i)}
              />
            )

            return (
              <div key={i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #1a1a2e' }}>

                {/* ── WILL BE UNLINKED ── */}
                {isRemoved && !choice && <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color="#4a4870" />
                    <span style={{ fontSize: 13, color: '#4a4870', flex: 1, textDecoration: 'line-through' }}>{songName}</span>
                    <button onClick={() => restoreLink(i)}
                      style={{ background: 'none', border: '1px solid #2a2850', borderRadius: 6, color: '#6b6a8f', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                      Restore
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace", paddingLeft: 16, marginTop: 2 }}>link will be removed on save</div>
                </>}

                {/* ── CONFIRMED CHOICE ── */}
                {!isRemoved && choice && <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color="#1DB954" />
                    <Art src={choice.albumArt} />
                    <TrackMeta name={choice.name} sub={`${choice.artists}${choice.albumName ? ` · ${choice.albumName}` : ''}`} />
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => openPanel(i)} style={{ background: 'none', border: '1px solid #2a2850', borderRadius: 6, color: '#6b6a8f', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Change</button>
                      <button onClick={() => unpickTrack(i)} title="Un-confirm" style={{ background: 'none', border: '1px solid #1DB95466', borderRadius: 6, color: '#1DB954', fontSize: 12, padding: '3px 8px', cursor: 'pointer', lineHeight: 1 }}>✓</button>
                      <XBtn i={i} />
                    </div>
                  </div>
                  {choice.name.toLowerCase() !== songName.toLowerCase() && (
                    <div style={{ fontSize: 10, color: '#4a4870', fontFamily: "'DM Mono', monospace", paddingLeft: 52, marginTop: 2 }}>logged as: {songName}</div>
                  )}
                  {panel}
                </>}

                {/* ── SEARCHING ── */}
                {!isRemoved && !choice && result === null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color="#2a2850" />
                    <span style={{ fontSize: 13, color: '#5a5878', flex: 1 }}>{songName}</span>
                    <span style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace" }}>searching…</span>
                  </div>
                )}

                {/* ── ALREADY LINKED ── */}
                {!isRemoved && !choice && result?.alreadyLinked && <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color="#1DB954" />
                    <Art src={result.existingAlbumArt} />
                    <TrackMeta name={result.existingName || songName} sub={result.existingAlbumName} />
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button onClick={() => openPanel(i)} style={{ background: 'none', border: '1px solid #2a2850', borderRadius: 6, color: '#6b6a8f', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>Change</button>
                      <XBtn i={i} />
                    </div>
                  </div>
                  {panel}
                </>}

                {/* ── NOT FOUND ── */}
                {!isRemoved && !choice && result?.notFound && <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color="#4a4870" />
                    <span style={{ fontSize: 13, color: '#6b6a8f', flex: 1 }}>{songName}</span>
                    {!hasPanelOpen && (
                      <button onClick={() => openPanel(i)} style={{ background: 'none', border: '1px solid #2a2850', borderRadius: 6, color: '#6b6a8f', fontSize: 10, padding: '3px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                        Search manually
                      </button>
                    )}
                  </div>
                  {!hasPanelOpen && (
                    <div style={{ fontSize: 10, color: '#3a3858', fontFamily: "'DM Mono', monospace", paddingLeft: 16, marginTop: 2 }}>not found — try a different title or spelling</div>
                  )}
                  {panel}
                </>}

                {/* ── SUGGESTED (unconfirmed match) ── */}
                {!isRemoved && !choice && result?.id && <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color={result.confidence === 'high' ? '#6ee7b7' : '#fbbf24'} />
                    <Art src={result.albumArt} />
                    <TrackMeta name={result.name} sub={`${result.artists}${result.albumName ? ` · ${result.albumName}` : ''}`} />
                    <button onClick={() => pickTrack(i, result)} style={{ background: 'none', border: '1px solid #3a3858', borderRadius: 6, color: '#6b6a8f', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>link</button>
                  </div>
                  {result.confidence === 'low' && !hasPanelOpen && (
                    <div style={{ fontSize: 10, color: '#fbbf24', fontFamily: "'DM Mono', monospace", paddingLeft: 52, marginTop: 2 }}>
                      low confidence — confirm if correct or{' '}
                      <button onClick={() => openPanel(i)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: "'DM Mono', monospace", textDecoration: 'underline' }}>search manually</button>
                    </div>
                  )}
                  {panel}
                </>}

              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={changeCount === 0}
            style={{ flex: 1, padding: '12px', borderRadius: 9, background: changeCount > 0 ? '#1DB954' : '#1a2e24', border: 'none', color: changeCount > 0 ? '#000' : '#3a5a3a', fontSize: 13, fontWeight: 700, cursor: changeCount > 0 ? 'pointer' : 'default', fontFamily: "'DM Sans', sans-serif" }}
          >
            {changeCount > 0 ? `Save ${changeCount} change${changeCount !== 1 ? 's' : ''}` : 'No changes'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 9, background: 'none', border: '1px solid #2a2850', color: '#6b6a8f', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
