import { useEffect, useRef, useState } from 'react'
import { listTicketFiles, updateTicketFiles, validateTicketFile } from '../lib/ticketFiles'

const buttonStyle = { background: 'none', border: 0, color: '#a78bfa', cursor: 'pointer', minHeight: 44, padding: 0, fontSize: 12 }
const isPdf = ({ file, name }) => file.type === 'application/pdf' || /\.pdf$/i.test(name)

export default function TicketFiles({ account, concert }) {
  const picker = useRef(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
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
    }).finally(() => {
      if (active) setLoading(false)
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

  const open = item => {
    const { id, file, name } = item
    if (isPdf(item)) {
      const url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }))
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      return
    }
    setPreview({ id, name, url: URL.createObjectURL(file) })
  }

  return <section aria-label="Ticket files" style={{ borderTop: '1px solid #25243a', marginTop: 12, paddingTop: 12 }}>
    <div style={{ fontSize: 10, color: '#9491b8', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', marginBottom: 6 }}>Ticket files</div>
    <input ref={picker} type="file" accept="application/pdf,.pdf,image/*,.svg" multiple disabled={busy} onChange={add} hidden />
    <p style={{ color: '#9491b8', fontSize: 11, lineHeight: 1.5, margin: '0 0 8px' }}>
      {loading ? 'Loading saved tickets…' : files.length ? 'Saved on this device until the show has passed.' : 'Add a PDF or image up to 20 MB.'}
    </p>
    {files.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #25243a' }}>
      <button type="button" onClick={() => open(item)} style={{ ...buttonStyle, display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, textAlign: 'left', paddingBlock: 7 }}>
        <span aria-hidden="true" style={{ flexShrink: 0, color: '#c4b5fd', background: '#211b33', borderRadius: 5, padding: '4px 6px', fontSize: 9, fontFamily: "'DM Mono', monospace" }}>{isPdf(item) ? 'PDF' : 'IMG'}</span>
        <span style={{ color: '#e2e0ff', overflowWrap: 'anywhere', minWidth: 0 }}>{item.name}</span>
        <span aria-hidden="true">›</span>
      </button>
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
    {!loading && <button type="button" disabled={busy} onClick={() => picker.current?.click()}
      style={files.length ? buttonStyle : { ...buttonStyle, border: '1px solid #2e2e50', borderRadius: 8, paddingInline: 12 }}>
      {busy ? 'Saving…' : files.length ? '+ Add another' : '+ Add ticket file'}
    </button>}
    {error && <p role="alert" style={{ color: '#fda4af', fontSize: 12 }}>{error}</p>}
  </section>
}
