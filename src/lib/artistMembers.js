export const artistTypes = [
  ['', 'Not set'], ['solo', 'Solo artist'], ['group', 'Group / band'],
  ['duo', 'Duo'], ['project', 'Subunit / project'],
]

const nameKey = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

export function normalizeMembers(members = []) {
  const seen = new Set()
  return (Array.isArray(members) ? members : []).flatMap(member => {
    const name = String(typeof member === 'string' ? member : member?.name || '').trim()
    const key = nameKey(name)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ id: String(member?.id || 'member-' + key), name }]
  })
}

export function artistMemberProfile(settings, name) {
  const profiles = settings.artistInfoOverrides || {}
  const key = Object.keys(profiles).find(key => nameKey(key) === nameKey(name))
  const profile = profiles[key] || {}
  return { ...profile, members: normalizeMembers(profile.members) }
}

// Dates remain in artistCustomDates; the roster only displays the existing entry.
export function memberBirthdays(members, dates = []) {
  const compact = value => nameKey(value).replace(/[^\p{L}\p{N}]/gu, '')
  const roster = normalizeMembers(members)
  const result = {}
  for (const [index, date] of dates.entries()) {
    if (!/birthday/i.test(date.label || '')) continue
    const name = compact(date.label.replace(/(?:['’]s)?\s*birthday/ig, ''))
    const exact = roster.filter(member => compact(member.name) === name)
    const matches = exact.length ? exact : roster.filter(member => name.length >= 3 && compact(member.name).endsWith(name))
    if (matches.length === 1 && !result[matches[0].id]) result[matches[0].id] = { ...date, index }
  }
  return result
}

export function showMemberPerformers(concert) {
  const performers = concert.type === 'festival'
    ? (concert.acts || []).map(act => ({
      key: 'festival-' + (act.id || nameKey(act.name) + '-day-' + (act.day || 1)),
      name: act.name, day: act.day || 1, role: 'Festival act',
    }))
    : [{ key: 'headliner', name: concert.artist, role: 'Headliner' }]
  for (const act of concert.support || []) {
    const name = typeof act === 'string' ? act : act.name
    performers.push({ key: 'support-' + nameKey(name), name, role: act?.role === 'guest' ? 'Guest' : 'Support act' })
  }
  const seen = new Set()
  return performers.filter(performer => {
    if (!performer.name?.trim() || seen.has(performer.key)) return false
    seen.add(performer.key)
    return true
  })
}

export function memberLineup(mode, members, previous) {
  if (mode === 'unrecorded') return null
  const roster = normalizeMembers(previous?.roster ?? members)
  const presentIds = mode === 'full' ? roster.map(member => member.id)
    : previous ? roster.filter(member => previous.presentIds?.includes(member.id)).map(member => member.id)
    : mode === 'missing' ? roster.map(member => member.id) : []
  return { mode, roster, presentIds, note: previous?.note || '' }
}

export function memberLineupSummary(lineup) {
  if (!lineup?.roster?.length) return 'Not recorded'
  const roster = normalizeMembers(lineup.roster)
  const present = roster.filter(member => lineup.presentIds?.includes(member.id))
  if (lineup.mode === 'full') return 'Full group · ' + roster.length + ' members'
  const missing = roster.filter(member => !lineup.presentIds?.includes(member.id))
  return present.length + ' of ' + roster.length + ' members' +
    (lineup.mode === 'missing' && missing.length ? ' · Missing ' + missing.map(member => member.name).join(', ') : '')
}

export function memberLineupLines(concert) {
  return showMemberPerformers(concert).flatMap(performer => {
    const lineup = concert.memberLineups?.[performer.key]
    if (!lineup?.roster?.length) return []
    const detail = lineup.mode === 'custom'
      ? ' · Present ' + lineup.roster.filter(member => lineup.presentIds?.includes(member.id)).map(member => member.name).join(', ')
      : ''
    return [performer.name + (performer.day ? ' (day ' + performer.day + ')' : '') + ' — ' + memberLineupSummary(lineup) + detail,
      ...(lineup.note?.trim() ? [lineup.note.trim()] : [])]
  })
}
