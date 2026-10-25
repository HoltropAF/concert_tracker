export function matchesShowType(show, type) {
  return type === 'all' || (type === 'concerts' ? show.type !== 'festival' : show.type === 'festival')
}

export function visibleSongTotals(entries) {
  return {
    songs: entries.length,
    shows: new Set(entries.flatMap(entry => entry.showIds || [])).size,
    artists: new Set(entries.map(entry => entry.artist).filter(Boolean)).size,
  }
}
