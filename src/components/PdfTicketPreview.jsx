import { useEffect, useRef, useState } from 'react'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const pageButton = { color: '#a78bfa', background: '#211b33', border: '1px solid #2e2e50', borderRadius: 8, minHeight: 44, padding: '0 9px' }

export default function PdfTicketPreview({ file, url }) {
  const canvas = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [number, setNumber] = useState(1)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let task
    async function load() {
      try {
        const [{ getDocument, GlobalWorkerOptions }, bytes] = await Promise.all([import('pdfjs-dist'), file.arrayBuffer()])
        if (!active) return
        GlobalWorkerOptions.workerSrc = workerUrl
        task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useWasm: false })
        const document = await task.promise
        if (active) setPdf(document)
      } catch {
        if (active) setFailed(true)
      }
    }
    load()
    return () => {
      active = false
      task?.destroy().catch(() => {})
    }
  }, [file])

  useEffect(() => {
    if (!pdf) return
    let active = true
    let rendering
    async function draw() {
      setReady(false)
      setFailed(false)
      try {
        const page = await pdf.getPage(number)
        if (!active) return
        const target = canvas.current
        const base = page.getViewport({ scale: 1 })
        const width = target.parentElement.clientWidth || 360
        const scale = Math.min(width / base.width, 510 / base.height)
        const pixels = Math.min(window.devicePixelRatio || 1, 3)
        const viewport = page.getViewport({ scale: scale * pixels })
        target.width = Math.ceil(viewport.width)
        target.height = Math.ceil(viewport.height)
        target.style.width = Math.ceil(viewport.width / pixels) + 'px'
        rendering = page.render({ canvas: target, viewport })
        await rendering.promise
        if (active) setReady(true)
      } catch {
        if (active) setFailed(true)
      }
    }
    draw()
    return () => {
      active = false
      rendering?.cancel()
    }
  }, [pdf, number])

  return <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, color: '#9491b8', fontSize: 12 }}>
      {pdf?.numPages > 1 && <button type="button" aria-label="Previous PDF page" disabled={number === 1} onClick={() => setNumber(n => n - 1)} style={pageButton}>‹ Page</button>}
      <span>{pdf ? `PDF · Page ${number} of ${pdf.numPages}` : 'PDF'}</span>
      {pdf?.numPages > 1 && <button type="button" aria-label="Next PDF page" disabled={number === pdf.numPages} onClick={() => setNumber(n => n + 1)} style={pageButton}>Page ›</button>}
    </div>
    <div style={{ display: 'grid', justifyItems: 'center', minHeight: ready ? 0 : 80, alignItems: 'center' }}>
      <canvas ref={canvas} data-ticket-preview aria-label={`Ticket PDF page ${number}`} style={{ display: ready ? 'block' : 'none', maxWidth: '100%', maxHeight: '45dvh', height: 'auto', objectFit: 'contain', background: '#fff' }} />
      {failed ? <p role="status" style={{ color: '#c4c2f0', fontSize: 13 }}>Preview unavailable. {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>Open PDF ↗</a>}</p>
        : !ready && <p role="status" style={{ color: '#9491b8', fontSize: 13 }}>Loading PDF…</p>}
    </div>
  </div>
}
