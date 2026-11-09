export const isSectionRow = row => row?.type === 'section'
export const SECTION_END = '__SECTION_END__'
export const isSectionEnd = row => isSectionRow(row) && row.label === SECTION_END

// Expand legacy song-attached labels without changing or dropping song metadata.
export function normalizeSetlistRows(value) {
  return (Array.isArray(value) ? value : []).filter(Boolean).flatMap(row => {
    if (isSectionRow(row) || typeof row === 'string' || !row.sectionLabel) return [row]
    const { sectionLabel, sectionCategory, ...song } = row
    return [{ type: 'section', label: sectionLabel, ...(sectionCategory ? { sectionCategory } : {}) }, song]
  })
}

export const setlistSongs = value => (Array.isArray(value) ? value : []).filter(row => row && !isSectionRow(row)).flatMap(row=>row.type==='medley'?row.parts||[]:[row])

const guestKey = name => name.trim().toLowerCase()

export function uniqueGuestNames(names) {
  const unique = new Map()
  for (const value of names) {
    if (typeof value !== 'string' || !value.trim()) continue
    const name = value.trim()
    if (!unique.has(guestKey(name))) unique.set(guestKey(name), name)
  }
  return [...unique.values()]
}

export function songGuestNames(song) {
  return uniqueGuestNames(Array.isArray(song?.guests) ? song.guests : [song?.feat])
}

export function filterSetlistPerformers(performers, filter) {
  if (filter === 'all') return performers
  return performers.flatMap(performer => {
    const { role, songs } = performer
    if (filter === 'headliner' || filter === 'support') return role === filter ? [performer] : []
    if (filter === 'support-guests' && role === 'support') return [performer]
    const matching = []
    let section
    for (const row of songs) {
      if (isSectionRow(row)) {
        if (isSectionEnd(row) && !section && matching.length) matching.push(row)
        section = row
      } else if (songGuestNames(row).length) {
        if (section && !isSectionEnd(section)) matching.push(section)
        matching.push(row)
        section = undefined
      }
    }
    return matching.length ? [{ ...performer, songs: matching }] : []
  })
}

export function receiptSetlistRows(rows, sort) {
  const name = song => typeof song === 'string' ? song : song.name || ''
  const album = song => song?.albumName || ''
  if (sort === 'performed') return rows
  const songs = rows.filter(row => !isSectionRow(row))
  if (sort === 'alpha') return songs.sort((a, b) => name(a).localeCompare(name(b)))
  songs.sort((a, b) => album(a) && album(b) ? album(a).localeCompare(album(b)) : Number(!album(a)) - Number(!album(b)))
  return songs.flatMap((song, index) => {
    const title = album(song)
    return title && title !== album(songs[index - 1]) ? [{ type: 'section', label: title }, song] : [song]
  })
}

// The old editor copied songs into a separate guest setlist. Match a copy only
// when its title identifies a single row. An explicit guest list wins, even empty.
export function placeLegacyGuests(setlist, supportSetlists, guests) {
  const rows = normalizeSetlistRows(setlist)
  const title = row => typeof row === 'string' ? row : row?.name || ''
  const positions = new Map()
  rows.forEach((row, index) => {
    if (isSectionRow(row) || !title(row).trim()) return
    const key = guestKey(title(row))
    positions.set(key, positions.has(key) ? null : index)
  })

  const matches = new Map()
  const unassigned = []
  for (const guest of guests) {
    for (const song of normalizeSetlistRows(supportSetlists?.[guest])) {
      if (isSectionRow(song) || !title(song).trim()) continue
      const index = positions.get(guestKey(title(song)))
      if (index == null) {
        if (!rows.some(row => guestKey(title(row)) === guestKey(title(song)) &&
          songGuestNames(row).some(name => guestKey(name) === guestKey(guest)))) {
          unassigned.push({ guest, song: title(song) })
        }
      } else if (!Array.isArray(rows[index]?.guests)) {
        if (!matches.has(index)) matches.set(index, [])
        matches.get(index).push(guest)
      }
    }
  }
  for (const [index, names] of matches) {
    const row = rows[index]
    const { feat, ...song } = typeof row === 'string' ? { name: row } : row
    rows[index] = { ...song, guests: uniqueGuestNames([...names, feat]) }
  }
  return { rows, unassigned }
}

export function mapSetlistSongs(rows,update){
  return normalizeSetlistRows(rows).map(row=>isSectionRow(row)?row:row.type==='medley'?{...row,parts:(row.parts||[]).map(update)}:update(row))
}

export function performanceSongs(rows){
  return normalizeSetlistRows(rows).flatMap(row=>{
    if(isSectionRow(row))return []
    if(row.type!=='medley')return [row]
    const seen=new Set()
    return (row.parts||[]).flatMap(part=>{
      const song=typeof part==='string'?{name:part}:part,key=(song.name||'').toLowerCase()+'|'+(song.cover||'')
      if(seen.has(key))return [];seen.add(key)
      return [{...song,medleyTitle:row.name||'Medley / remix'}]
    })
  })
}

export function releaseNote(song){
  if(!song?.unreleasedAtShow)return ''
  return 'Unreleased at this show'+(song.releaseDate?` · released ${song.releaseDate}`:'')
}

export function toMedley(song){
  const row=typeof song==='string'?{name:song}:song
  const names=String(row.name||'').split('/').map(name=>name.trim()).filter(Boolean)
  return {...row,type:'medley',name:'Mashup of',parts:names.length>1
    ?names.map(name=>({name,...(row.unreleasedAtShow?{unreleasedAtShow:true}:{}),...(row.cover?{cover:row.cover}:{})}))
    :[row]}
}

export function matchesSongLinkFilter(song,filter){
  if(filter==='all')return true
  if(song.unreleasedAtShow)return filter==='unreleased'
  return filter==='linked'?!!song.spotifyId:filter==='unlinked'?!song.spotifyId:false
}

// Spotify only sees songs; put its updates back between the original headings.
export function mergeSetlistSongs(rows, updatedSongs) {
  let index = 0
  return mapSetlistSongs(rows,row => updatedSongs[index++] ?? row)
}

export function moveSetlistRow(rows, from, to) {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return rows
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}
