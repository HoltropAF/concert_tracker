import { useState } from 'react'
import { artistMemberProfile, memberLineup, memberLineupSummary, normalizeMembers, showMemberPerformers } from '../lib/artistMembers'

const muted = { color: '#9491b8', fontSize: 12, lineHeight: 1.5 }
const field = { width: '100%', minWidth: 0, boxSizing: 'border-box', background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 7, color: '#c4c2f0', padding: 8, fontSize: 16 }
const button = { background: 'none', border: 0, color: 'var(--accent)', minHeight: 40, cursor: 'pointer', fontSize: 12, padding: '6px 0' }

function MemberLineupEntry({ performer, members, value, editing, onChange }) {
  const [extraName, setExtraName] = useState('')
  const [error, setError] = useState('')
  const roster = normalizeMembers(value?.roster ?? members)
  const presentIds = Array.isArray(value?.presentIds) ? value.presentIds : []
  const mode = value?.mode || 'unrecorded'
  const summary = roster.length && value
    ? mode === 'full' ? 'Full group' : presentIds.length + ' of ' + roster.length + ' members'
    : 'Not recorded'
  const changeMode = event => {
    setError('')
    onChange(memberLineup(event.target.value, members, value))
  }
  const choose = (member, checked) => {
    const present = mode === 'missing' ? !checked : checked
    const selected = new Set(presentIds)
    if (present) selected.add(member.id)
    else selected.delete(member.id)
    onChange({ ...value, presentIds: roster.filter(item => selected.has(item.id)).map(item => item.id) })
  }
  const add = () => {
    const name = extraName.trim()
    if (!name) return
    const next = normalizeMembers([...roster, { id: crypto.randomUUID(), name }])
    if (next.length === roster.length) {
      setError('This member is already listed.')
      return
    }
    const added = next.at(-1)
    onChange({ ...value, roster: next, presentIds: [...presentIds, added.id] })
    setExtraName('')
    setError('')
  }
  return <details style={{ borderBottom: '1px solid #25243a' }}>
    <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44, cursor: 'pointer', fontSize: 13, color: '#c4c2f0' }}>
      <span>{performer.name}{performer.day ? ' · day ' + performer.day : ''}</span>
      <span title={memberLineupSummary(value)} style={{ ...muted, textAlign: 'right' }}>{summary} ›</span>
    </summary>
    {editing ? <>
      <label style={muted}>Who performed?
        <select aria-label={'Lineup for ' + performer.name + (performer.day ? ' day ' + performer.day : '')} value={mode} onChange={changeMode} style={{ ...field, marginTop: 5, marginBottom: 8 }}>
          <option value="unrecorded">Not recorded</option>
          <option value="full" disabled={!roster.length}>Full group</option>
          <option value="missing" disabled={!roster.length}>Someone missing</option>
          <option value="custom">Custom lineup</option>
        </select>
      </label>
      {value && members.length > 0 && JSON.stringify(roster) !== JSON.stringify(members) &&
        <button type="button" style={button} onClick={() => onChange({ ...memberLineup('custom', members), note: value.note || '' })}>Choose from the current artist member list</button>}
      {mode !== 'unrecorded' && <>
        {mode === 'full' ? <p style={muted}>{roster.map(member => member.name).join(' · ')}</p> : <>
          <p style={{ ...muted, margin: '4px 0' }}>{mode === 'missing' ? 'Select the members who were absent.' : 'Select the members who performed.'}</p>
          {roster.map(member => <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, color: '#c4c2f0', fontSize: 13 }}>
            <input type="checkbox" checked={mode === 'missing' ? !presentIds.includes(member.id) : presentIds.includes(member.id)}
              onChange={event => choose(member, event.target.checked)} />
            {member.name}
          </label>)}
        </>}
        {mode === 'custom' && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <input aria-label={'Additional member for ' + performer.name} value={extraName} onChange={event => setExtraName(event.target.value)}
            placeholder="Add someone for this show" style={field} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} />
          <button type="button" disabled={!extraName.trim()} style={button} onClick={add}>Add</button>
        </div>}
        {error && <p role="alert" style={{ ...muted, color: '#fda4af' }}>{error}</p>}
        <label style={{ ...muted, display: 'block', margin: '8px 0 12px' }}>Lineup note (optional)
          <input aria-label={'Lineup note for ' + performer.name} value={value.note || ''} onChange={event => onChange({ ...value, note: event.target.value })} style={{ ...field, marginTop: 4 }} placeholder="Anything you want to remember" />
        </label>
      </>}
      {!roster.length && <p style={muted}>Add the group’s members on the artist Info page, or use Custom lineup for this show.</p>}
    </> : value?.roster?.length ? <>
      <p style={muted}>{mode === 'missing' && roster.some(member => !presentIds.includes(member.id)) ? 'Missing ' + roster.filter(member => !presentIds.includes(member.id)).map(member => member.name).join(', ')
        : 'Present ' + roster.filter(member => presentIds.includes(member.id)).map(member => member.name).join(', ')}</p>
      {value.note && <p style={{ ...muted, whiteSpace: 'pre-wrap' }}>{value.note}</p>}
    </> : <p style={muted}>Edit the show to record who performed.</p>}
  </details>
}

export default function ShowMemberLineups({ concert, settings, editing = false, onChange }) {
  const entries = showMemberPerformers(concert).map(performer => ({
    performer, profile: artistMemberProfile(settings, performer.name), value: concert.memberLineups?.[performer.key],
  })).filter(({ profile, value }) => value || (profile.actType && profile.actType !== 'solo'))
  if (!entries.length) return null
  return <section aria-label="Members at this performance">
    <h3 style={{ fontSize: 13, color: '#e2e0ff', margin: '0 0 4px' }}>Members</h3>
    {entries.map(({ performer, profile, value }) => <MemberLineupEntry key={performer.key} performer={performer} members={profile.members} value={value} editing={editing}
      onChange={lineup => {
        const next = { ...concert.memberLineups }
        if (lineup) next[performer.key] = lineup
        else delete next[performer.key]
        onChange(next)
      }} />)}
  </section>
}
