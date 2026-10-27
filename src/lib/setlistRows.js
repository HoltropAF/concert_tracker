export const isSectionRow = row => row?.type === 'section'

// Expand legacy song-attached labels without changing or dropping song metadata.
export function normalizeSetlistRows(value) {
  return (Array.isArray(value) ? value : []).filter(Boolean).flatMap(row => {
    if (isSectionRow(row) || typeof row === 'string' || !row.sectionLabel) return [row]
    const { sectionLabel, sectionCategory, ...song } = row
    return [{ type: 'section', label: sectionLabel, ...(sectionCategory ? { sectionCategory } : {}) }, song]
  })
}

export const setlistSongs = value => (Array.isArray(value) ? value : []).filter(row => row && !isSectionRow(row)).flatMap(row=>row.type==='medley'?row.parts||[]:[row])

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
