// Add only: removing a specific memory must not erase a manually chosen tag.
export function withCriedTag(concert) {
  const lists = [concert.setlist, ...Object.values(concert.supportSetlists || {})]
  const cried = concert.criedSong || lists.some(rows => Array.isArray(rows) && rows.some(row => row?.cried === true))
  if (!cried || concert.tags?.includes('Cried')) return concert
  return { ...concert, tags: [...(concert.tags || []), 'Cried'] }
}
