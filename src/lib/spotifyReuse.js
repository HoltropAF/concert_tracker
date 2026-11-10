import { mapSetlistSongs, setlistSongs } from './setlistRows.js'

const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
export const songArtist = (song, performer) => typeof song?.cover === 'string' ? song.cover : performer

function trackKey(song, performer) {
  if (song?.cover === true || song?.unreleasedAtShow) return ''
  const name = normalize(typeof song === 'string' ? song : song?.name)
  const artist = normalize(performer)
  return artist && name ? JSON.stringify([artist,name,normalize(song?.cover)]) : ''
}

export function indexSpotifyLinks(concerts) {
  const links = new Map()
  const add = (rows,artist) => {
    for (const song of setlistSongs(rows)) {
      if (!song?.spotifyId) continue
      const key = trackKey(song,artist)
      if (!key) continue
      const known = links.get(key)
      if (links.has(key)) {
        if (known?.id !== song.spotifyId) links.set(key,null)
      } else {
        links.set(key,{id:song.spotifyId,name:song.spotifyName || song.name,albumName:song.albumName,
          albumId:song.albumId,albumArt:song.albumArt,durationMs:song.durationMs,popularity:song.popularity,
          trackNumber:song.trackNumber,releaseDate:song.releaseDateManual ? undefined : song.releaseDate})
      }
    }
  }
  for (const concert of concerts) {
    add(concert.setlist,concert.artist)
    for (const [artist,rows] of Object.entries(concert.supportSetlists || {})) add(rows,artist)
    for (const act of concert.acts || []) add(act.setlist,act.name)
  }
  return (song,performer) => links.get(trackKey(song,performer))
}

export function applySpotifyChoice(song, choice) {
  const base = typeof song === 'string' ? {name:song} : song
  return { ...base, spotifyId:choice.id, spotifyName:choice.name, albumName:choice.albumName,
    albumId:choice.albumId,albumArt:choice.albumArt,durationMs:choice.durationMs,popularity:choice.popularity,
    trackNumber:choice.trackNumber,releaseDate:base.releaseDateManual ? base.releaseDate : choice.releaseDate || base.releaseDate }
}

export function reuseSpotifyLinks(rows, performer, concerts) {
  const lookup = indexSpotifyLinks(concerts)
  return mapSetlistSongs(rows,song => {
    const choice = !song?.spotifyId && lookup(song,performer)
    return choice ? applySpotifyChoice(song,choice) : song
  })
}
