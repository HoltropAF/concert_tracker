import { useState } from 'react'
import { artistTypes, memberBirthdays, normalizeMembers } from '../lib/artistMembers'

const field = { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 40, background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 7, color: '#c4c2f0', padding: '7px 9px', fontSize: 16 }
const button = { minHeight: 40, background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: '6px 0' }

export default function ArtistMembers({ artist, profile = {}, dates = [], onSave }) {
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const members = normalizeMembers(profile.members)
  const type = artistTypes.find(([key]) => key === profile.actType)?.[1] || 'Not set'
  const grouped = profile.actType && profile.actType !== 'solo'
  const birthdays = memberBirthdays(members, dates)
  const open = () => { setDraft({ actType: profile.actType || '', members }); setError('') }
  const save = async () => {
    const normalized = normalizeMembers(draft.members)
    if (draft.actType && draft.actType !== 'solo' && (draft.members.some(member => !member.name.trim()) || normalized.length !== draft.members.length)) {
      setError('Give each member a different name, or remove the empty row.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await onSave({ actType: draft.actType, members: normalized })
      if (result?.error) throw result.error
      setDraft(null)
    } catch {
      setError('Could not save the artist details. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return <section aria-label={'Artist type and members of ' + artist} style={{ background: '#13131f', border: '1px solid #1f1f35', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <h3 style={{ fontSize: 9, color: '#6b6a8f', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 400, margin: 0 }}>About the artist</h3>
      {!draft && <button type="button" style={button} onClick={open}>{profile.actType ? 'Edit' : 'Add details'}</button>}
    </div>
    {draft ? <>
      <label style={{ display: 'block', color: '#9491b8', fontSize: 12, marginBottom: 10 }}>Artist type
        <select aria-label="Artist type" style={{ ...field, marginTop: 5 }} value={draft.actType} disabled={busy} onChange={event => setDraft({ ...draft, actType: event.target.value })}>
          {artistTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      {draft.actType && draft.actType !== 'solo' && <>
        {draft.members.map((member, index) => <div key={member.id} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <input aria-label={'Member ' + (index + 1)} value={member.name} disabled={busy} placeholder="Member name" style={field}
            onChange={event => setDraft({ ...draft, members: draft.members.map(item => item.id === member.id ? { ...item, name: event.target.value } : item) })} />
          <button type="button" aria-label={'Remove member ' + (member.name || index + 1)} disabled={busy} style={button}
            onClick={() => setDraft({ ...draft, members: draft.members.filter(item => item.id !== member.id) })}>×</button>
        </div>)}
        <button type="button" style={button} disabled={busy} onClick={() => setDraft({ ...draft, members: [...draft.members, { id: crypto.randomUUID(), name: '' }] })}>+ Add member</button>
      </>}
      {error && <p role="alert" style={{ color: '#fda4af', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 20 }}>
        <button type="button" style={button} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save artist details'}</button>
        <button type="button" style={button} disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </> : <>
      <div style={{ fontSize: 13, color: '#c4c2f0', paddingBottom: grouped && members.length ? 10 : 2 }}>{type}{grouped && members.length > 0 ? ' · ' + members.length + ' members' : ''}</div>
      {grouped && members.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 16, borderTop: '1px solid #1f1f35', paddingTop: 4 }}>
        {members.map(member => <div key={member.id} style={{ minWidth: 0, padding: '7px 0' }}>
          <div style={{ fontSize: 13, color: '#e2e0ff', overflowWrap: 'anywhere' }}>{member.name}</div>
          {/^\d{4}-\d{2}-\d{2}$/.test(birthdays[member.id]?.date || '') && <div style={{ fontSize: 10, color: '#7691a2', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>Birthday · {new Date(birthdays[member.id].date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>}
        </div>)}
      </div>}
    </>}
  </section>
}
