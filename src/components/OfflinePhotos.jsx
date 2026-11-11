import { useMemo, useState } from 'react'
import { keepOfflinePhoto, removeOfflinePhotos } from '../lib/photos'

const buttonStyle = { minHeight: 44, border: '1px solid #2e2e50', borderRadius: 8, background: '#1a1a30', color: '#a78bfa', padding: '0 10px', fontSize: 12 }
const photoCount = count => `${count} photo${count === 1 ? '' : 's'}`

export default function OfflinePhotos({ concerts, settings, online }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const paths = useMemo(() => [...new Set([
    ...concerts.map(concert => concert.photo),
    ...Object.values(settings.artistPhotos || {}),
  ].filter(path => typeof path === 'string' && path.includes('/') && !path.includes('://')))], [concerts, settings.artistPhotos])

  if (!paths.length) return null
  const download = async () => {
    setBusy(true)
    setMessage('')
    let failed = 0
    navigator.storage?.persist?.().catch(() => {})
    for (let index = 0; index < paths.length; index += 3) {
      const batch = await Promise.allSettled(paths.slice(index, index + 3).map(keepOfflinePhoto))
      failed += batch.filter(result => result.status === 'rejected').length
      setMessage(`Downloaded ${Math.min(index + 3, paths.length) - failed} of ${paths.length} photos`)
    }
    setMessage(failed ? `${photoCount(paths.length - failed)} kept offline. ${failed} couldn’t download.` : `${photoCount(paths.length)} kept offline.`)
    setBusy(false)
  }
  const remove = async () => {
    setBusy(true)
    try {
      await removeOfflinePhotos(paths)
      setMessage('Offline copies removed.')
    } catch {
      setMessage('Could not remove offline copies.')
    } finally {
      setBusy(false)
    }
  }

  return <div style={{ borderTop: '1px solid #25243a', padding: '10px 0', color: '#9491b8', fontSize: 12 }}>
    <strong style={{ color: '#e2e0ff' }}>Photos on this device</strong>
    <p>Download your saved artist and show photos so they’re available in the app offline.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <button type="button" style={buttonStyle} disabled={busy || !online} onClick={download}>Download {photoCount(paths.length)}</button>
      <button type="button" style={buttonStyle} disabled={busy} onClick={remove}>Remove offline copies</button>
    </div>
    {message && <p role="status">{message}</p>}
  </div>
}
