import { useEffect, useState } from 'react'
import { listTicketFiles, updateTicketFiles, validateTicketFile } from '../lib/ticketFiles'

const buttonStyle = { background: 'none', border: 0, color: '#a78bfa', cursor: 'pointer', minHeight: 44, padding: 0, fontSize: 12 }

export default function TicketFiles({ account, concert }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url)
  }, [preview])
  useEffect(() => {
    let active = true
    listTicketFiles(account, concert.id).then(items => {
      if (active) setFiles(items)
    }).catch(() => {
      if (active) setError('Could not open saved tickets on this device.')
    })
    return () => { active = false }
  }, [account, concert.id])

  const save = async update => {
    setBusy(true)
    setError('')
    try {
      setFiles(await updateTicketFiles(account, concert, update))
    } catch {
      setError('Could not save the change. Check available device storage and try again.')
    } finally {
      setBusy(false)
    }
  }

  const add = event => {
    const selected = [...event.target.files]
    event.target.value = ''
    const invalid = selected.map(validateTicketFile).find(Boolean)
    if (invalid) { setError(invalid); return }
    if (!selected.length) return
    const added = selected.map(file => ({ id: window.crypto.randomUUID(), name: file.name, file }))
    save(current => [...current, ...added])
  }

  const open = ({ id, file, name }) => {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) {
      const url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }))
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      return
    }
    setPreview({ id, name, url: URL.createObjectURL(file) })
  }

  return <div style={{ borderTop: '1px solid #25243a', marginTop: 12, paddingTop: 12 }}>
    <label style={{ display: 'grid', gap: 6, color: '#c4c2f0', fontSize: 13 }}>
      Ticket files
      <input type="file" accept="application/pdf,.pdf,image/*,.svg" multiple disabled={busy} onChange={add} style={{ maxWidth: '100%', color: '#c4c2f0' }} />
    </label>
    <p style={{ color: '#9491b8', fontSize: 11, lineHeight: 1.5 }}>PDFs and images up to 20 MB each. Saved on this device until the show has passed.</p>
    {files.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #25243a' }}>
      <button type="button" onClick={() => open(item)} style={{ ...buttonStyle, flex: 1, minWidth: 0, textAlign: 'left', overflowWrap: 'anywhere' }}>{item.name} ↗</button>
      <button type="button" aria-label={'Remove ' + item.name} disabled={busy} onClick={() => {
        if (preview?.id === item.id) setPreview(null)
        save(current => current.filter(file => file.id !== item.id))
      }} style={{ ...buttonStyle, color: '#9491b8' }}>Remove</button>
    </div>)}
    {preview && <figure style={{ margin: 0, textAlign: 'right' }}>
      <button type="button" onClick={() => setPreview(null)} style={buttonStyle}>Close preview</button>
      <img src={preview.url} alt={preview.name} style={{ display: 'block', width: '100%', objectFit: 'contain' }} />
      <a href={preview.url} download={preview.name} style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center' }}>Download image</a>
    </figure>}
    {error && <p role="alert" style={{ color: '#fda4af', fontSize: 12 }}>{error}</p>}
  </div>
}
