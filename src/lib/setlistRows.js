export const isSectionRow = row => row?.type === 'section'

// Expand legacy song-attached labels without changing or dropping song metadata.
export function normalizeSetlistRows(value) {
  return (Array.isArray(value) ? value : []).filter(Boolean).flatMap(row => {
    if (isSectionRow(row) || typeof row === 'string' || !row.sectionLabel) return [row]
    const { sectionLabel, sectionCategory, ...song } = row
    return [{ type: 'section', label: sectionLabel, ...(sectionCategory ? { sectionCategory } : {}) }, song]
  })
}

export const setlistSongs = value => (Array.isArray(value) ? value : []).filter(row => row && !isSectionRow(row))

// Spotify only sees songs; put its updates back between the original headings.
export function mergeSetlistSongs(rows, updatedSongs) {
  let index = 0
  return normalizeSetlistRows(rows).map(row => isSectionRow(row) ? row : updatedSongs[index++] ?? row)
}

export function moveSetlistRow(rows, from, to) {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return rows
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}
