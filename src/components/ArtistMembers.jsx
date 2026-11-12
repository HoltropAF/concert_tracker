import { useState } from 'react'
import { artistTypes, normalizeMembers } from '../lib/artistMembers'

const field = { width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 40, background: '#0c0c14', border: '1px solid #2e2e50', borderRadius: 7, color: '#c4c2f0', padding: '7px 9px', fontSize: 16 }
const button = { minHeight: 40, background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: '6px 0' }

export default function ArtistMembers({ artist, profile = {}, onSave }) {
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const members = normalizeMembers(profile.members)
  const type = artistTypes.find(([key]) => key === profile.actType)?.[1] || 'Not set'
  const grouped = profile.actType && profile.actType !== 'solo'
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
  return <section aria-label={'Artist type and members of ' + artist} style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <h3 style={{ fontSize: 13, color: '#e2e0ff', margin: 0 }}>Artist type & members</h3>
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
      <div style={{ fontSize: 12, color: '#9491b8', marginTop: 5 }}>{type}</div>
      {grouped && members.length > 0 && <div style={{ fontSize: 13, color: '#c4c2f0', lineHeight: 1.6, marginTop: 4 }}>{members.map(member => member.name).join(' · ')}</div>}
    </>}
  </section>
}
