import {useState} from 'react'
import {createCompleteBackup, restoreCompleteBackup, validateBackup, MAX_BACKUP_BYTES} from '../lib/completeBackup'
import {listUserPhotos, downloadBackupPhoto, uploadBackupPhoto} from '../lib/photos'

export default function CompleteBackup({concerts,settings,onSaveConcert,onUpdateAll,userEmail}) {
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [error,setError] = useState('')
  const [pending,setPending] = useState(null)
  const guest = userEmail === 'guest'
  const run = async action => {
    setBusy(true); setError('')
    try { await action() } catch(e) { setError(e.message); setMessage('') }
    finally { setBusy(false) }
  }
  const download = () => run(async () => {
    setMessage('Preparing complete backup…')
    const backup = await createCompleteBackup({concerts,settings,listPhotos:guest ? async()=>[] : listUserPhotos,readPhoto:downloadBackupPhoto,onProgress:setMessage})
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}))
    const a = document.createElement('a'); a.href = url; a.download = `settracker-complete-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000)
    setMessage(`Backup download started: ${backup.concerts.length} concerts, settings and ${backup.photos.length} ${backup.photos.length === 1 ? 'photo' : 'photos'}. Keep this private file somewhere safe.`)
  })
  const choose = event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setPending(null)
    run(async()=>{
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 200 MB.')
      const data = validateBackup(JSON.parse(await file.text()))
      if (guest && data.photos.length) throw new Error('Sign in to restore a backup with photos.')
      setPending(data); setMessage('Review the backup before restoring.')
    })
  }
  const restore = () => run(async()=>{
    const result = await restoreCompleteBackup({backup:pending,currentSettings:settings,uploadPhoto:uploadBackupPhoto,saveConcert:onSaveConcert,saveSettings:onUpdateAll,onProgress:setMessage})
    setPending(null); setMessage(`Restored ${result.saved} concerts, settings and ${result.photos} ${result.photos === 1 ? 'photo' : 'photos'}.`)
  })
  // Styled like the Export and Import blocks below it in Settings → Offline & data.
  const mono = "'DM Mono', monospace"
  const primary = { flex: 1, padding: '9px', borderRadius: 8, fontSize: 12, cursor: busy ? 'default' : 'pointer', background: '#1a1a30', border: '1px solid #a78bfa', color: '#a78bfa', fontFamily: mono, fontWeight: 700, textAlign: 'center', opacity: busy ? 0.6 : 1 }
  const secondary = { ...primary, background: 'none', border: '1px solid #2e2e50', color: '#c4c2f0', fontWeight: 400, position: 'relative', display: 'block' }
  const note = { fontSize: 10, color: '#6b6a8f', fontFamily: mono, marginTop: 8, lineHeight: 1.5 }
  return <section aria-label="Complete backup" style={{ padding: '14px 16px', borderBottom: '1px solid #1f1f35' }}>
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#c4c2f0', fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Complete backup</div>
      <div style={{ fontSize: 10, color: '#4a4870', fontFamily: mono, marginTop: 2, lineHeight: 1.5 }}>Concerts, preferences, friend and venue details, and uploaded photos in one file. Spotify login tokens are excluded; external image links remain links. Up to 200 MB.</div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" disabled={busy} onClick={download} style={primary}>↓ Download complete backup</button>
      <label style={secondary}>↑ Restore complete backup<input aria-label="Restore complete backup" type="file" accept=".json,application/json" disabled={busy} onChange={choose} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}/></label>
    </div>
    {pending && <div style={{ marginTop: 12 }}>
      <div style={note}>{pending.concerts.length} concerts · {pending.photos.length} {pending.photos.length === 1 ? 'photo' : 'photos'}. Matching concert IDs will be updated and backed-up settings applied. Other concerts and existing photo files will be kept. Download your current backup first if needed.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" disabled={busy} onClick={restore} style={primary}>Restore this backup</button>
        <button type="button" disabled={busy} onClick={()=>{setPending(null);setMessage('Restore cancelled.')}} style={secondary}>Cancel restore</button>
      </div>
    </div>}
    {message && <div role="status" style={note}>{message}</div>}
    {error && <div role="alert" style={{ ...note, color: '#f472b6' }}>{error}</div>}
  </section>
}
