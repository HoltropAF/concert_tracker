import { useEffect, useRef, useState } from 'react'
import { listTicketFiles, updateTicketFiles, validateTicketFile } from '../lib/ticketFiles'
import ShowControlSheet from './ShowControlSheet'
import PdfTicketPreview from './PdfTicketPreview'
import './TicketFiles.css'

const buttonStyle = { background: 'none', border: 0, color: '#a78bfa', cursor: 'pointer', minHeight: 44, padding: 0, fontSize: 12 }
const small = { color: '#9491b8', fontSize: 12, lineHeight: 1.5 }
const row = { display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #25243a' }
const arrow = { ...buttonStyle, width: 44, border: '1px solid #2e2e50', background: '#211b33', borderRadius: 8, fontSize: 20 }
const isPdf = ({ file, name }) => file.type === 'application/pdf' || /\.pdf$/i.test(name)

function TicketFileViewer({ item, index, total, onStep, onList }) {
  const [url, setUrl] = useState('')
  const [imageError, setImageError] = useState(false)
  const swipeStart = useRef(null)
  const pdf = isPdf(item)
  useEffect(() => {
    const type = pdf ? 'application/pdf' : /\.svg$/i.test(item.name) ? 'image/svg+xml' : item.file.type
    const blob = type === item.file.type ? item.file : new Blob([item.file], { type })
    const source = URL.createObjectURL(blob)
    setUrl(source)
    return () => URL.revokeObjectURL(source)
  }, [item, pdf])

  return <div onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    onStep(event.key === 'ArrowLeft' ? -1 : 1)
  }}>
    <div style={{ ...small, overflowWrap: 'anywhere' }}>{item.name}</div>
    <div style={{ touchAction: 'pan-y pinch-zoom' }} onPointerDown={event => {
      if (total < 2 || !event.isPrimary || event.target.closest('button, a')) return
      swipeStart.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerCancel={() => { swipeStart.current = null }} onPointerUp={event => {
      const start = swipeStart.current
      swipeStart.current = null
      if (!start) return
      const dx = event.clientX - start.x, dy = event.clientY - start.y
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onStep(dx < 0 ? 1 : -1)
    }}>
      {pdf ? <PdfTicketPreview file={item.file} url={url} /> : <>
        <div style={{ ...small, padding: '8px 0' }}>Photo</div>
        {imageError ? <p role="status" style={small}>This image format can be opened after downloading it.</p>
          : url && <img src={url} alt={item.name} draggable={false} onError={() => setImageError(true)} style={{ display: 'block', width: '100%', maxHeight: '45dvh', objectFit: 'contain' }} />}
      </>}
    </div>
    {total > 1 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
      <button type="button" aria-label="Previous ticket" disabled={index === 0} onClick={() => onStep(-1)} style={{ ...arrow, opacity: index === 0 ? .4 : 1 }}>‹</button>
      <div style={{ ...small, textAlign: 'center' }}><strong aria-live="polite" style={{ color: '#e2e0ff' }}>{index + 1} of {total}</strong><br />Swipe or use arrows</div>
      <button type="button" aria-label="Next ticket" disabled={index === total - 1} onClick={() => onStep(1)} style={{ ...arrow, opacity: index === total - 1 ? .4 : 1 }}>›</button>
    </div>}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: total > 1 ? 'space-between' : 'flex-end', gap: 10, marginTop: 8 }}>
      {total > 1 && <button type="button" onClick={onList} style={buttonStyle}>All tickets</button>}
      {url && <a href={url} download={item.name} style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontWeight: 700 }}>Download {pdf ? 'PDF' : 'photo'} ↓</a>}
    </div>
  </div>
}

export default function TicketFiles({ account, concert, ticketDate, ticketLabel, price, shopUrl, accessUrl, onEdit, view, onChangeView }) {
  const picker = useRef(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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

  const selected = typeof view === 'number' ? files[view] : null
  const hasDetails = !!(accessUrl || concert.ticketAccessNote)
  const countLabel = files.length === 1 ? (isPdf(files[0]) ? 'Saved PDF' : 'Saved photo') : `${files.length} saved tickets`
  const addButton = <button type="button" disabled={busy} onClick={() => picker.current?.click()}
    style={files.length ? buttonStyle : { ...buttonStyle, border: '1px solid #2e2e50', borderRadius: 8, paddingInline: 12 }}>
    {busy ? 'Saving…' : files.length ? '+ Add another' : '+ Add ticket file'}
  </button>
  const accessDetails = <>
    {accessUrl && <a href={accessUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center' }}>Open my ticket ↗</a>}
    {concert.ticketAccessNote && <div style={{ ...small, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{concert.ticketAccessNote}</div>}
  </>

  return <section aria-label="Tickets">
    <div style={{ fontSize: 10, color: '#9491b8', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', marginBottom: 10 }}>Tickets</div>
    <input ref={picker} type="file" accept="application/pdf,.pdf,image/*,.svg" multiple disabled={busy} onChange={add} hidden />
    {loading ? <p style={small}>Loading saved tickets…</p> : files.length ? (
      <button type="button" className="saved-ticket-stub" onClick={() => onChangeView(files.length === 1 ? 0 : 'list')}>
        <span className="saved-ticket-stub-body">
          <span className="saved-ticket-stub-top"><span>{ticketLabel || 'Admission'}</span><span className="saved-ticket-stub-stamp">You’re in!</span></span>
          <strong>{files.length === 1 ? 'My ticket' : 'My tickets'}</strong>
          <span>{[ticketDate, concert.venue].filter(Boolean).join(' · ') || concert.artist}</span>
        </span>
        <span className="saved-ticket-stub-foot"><span>{countLabel}</span><b>{files.length === 1 ? 'Open ticket' : 'Open tickets'} ›</b></span>
      </button>
    ) : <>
      {(ticketLabel || price) && <p style={small}>{[ticketLabel, price].filter(Boolean).join(' · ')}</p>}
      {accessDetails}
      {!hasDetails && shopUrl && <a href={shopUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center' }}>Ticket website ↗</a>}
      <p style={small}>Add a PDF or image up to 20 MB.</p>
      {addButton}
    </>}
    {!loading && (
      <details style={{ ...small, borderTop: '1px solid #25243a', marginTop: 4 }}>
        <summary style={{ padding: '12px 0', cursor: 'pointer' }}>Ticket details</summary>
        {files.length > 0 && <>
          <div style={small}>Saved on this device until the show has passed.</div>
          {price && <div style={small}>{price}</div>}
          {accessDetails}
        </>}
        {files.map(item => <div key={item.id} style={row}>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{item.name}</span>
          <button type="button" aria-label={'Remove ' + item.name} disabled={busy} onClick={() => save(current => current.filter(file => file.id !== item.id))} style={buttonStyle}>Remove</button>
        </div>)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button type="button" onClick={onEdit} style={buttonStyle}>Edit tickets</button>
          {files.length > 0 && addButton}
        </div>
      </details>
    )}
    {error && <p role="alert" style={{ color: '#fda4af', fontSize: 12 }}>{error}</p>}
    {(view === 'list' || selected) && <ShowControlSheet title={view === 'list' ? 'Choose a ticket' : 'Saved ticket'} onClose={() => onChangeView(null)} maxHeight="92dvh" showDone={false}>
      {view === 'list' ? files.map((item, index) => (
        <button key={item.id} type="button" onClick={() => onChangeView(index)} style={{ ...buttonStyle, ...row, width: '100%', minHeight: 48, textAlign: 'left' }}>
          <span aria-hidden="true" style={{ background: '#211b33', color: '#a78bfa', borderRadius: 5, padding: '4px 6px', flexShrink: 0 }}>{isPdf(item) ? 'PDF' : 'IMG'}</span>
          <span style={{ color: '#e2e0ff', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{item.name}</span><span aria-hidden="true">›</span>
        </button>
      )) : <TicketFileViewer key={selected.id} item={selected} index={view} total={files.length}
        onStep={step => onChangeView(Math.min(files.length - 1, Math.max(0, view + step)))} onList={() => onChangeView('list')} />}
    </ShowControlSheet>}
  </section>
}
