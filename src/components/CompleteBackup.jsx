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
    setMessage(`Backup download started: ${backup.concerts.length} concerts, settings and ${backup.photos.length} photos. Keep this private file somewhere safe.`)
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
    setPending(null); setMessage(`Restored ${result.saved} concerts, settings and ${result.photos} photos.`)
  })
  return <section aria-label="Complete backup" style={{padding:16,borderBottom:'1px solid #2e2e50'}}>
    <h3 style={{margin:'0 0 8px'}}>Complete backup</h3>
    <p style={{fontSize:12}}>Concerts, preferences, friend and venue details, and uploaded photos in one file. Spotify login tokens are excluded; external image links remain links. Up to 200 MB.</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button disabled={busy} onClick={download}>Download complete backup</button>
      <label>Restore complete backup <input aria-label="Restore complete backup" type="file" accept=".json,application/json" disabled={busy} onChange={choose}/></label>
    </div>
    {pending && <div style={{marginTop:12}}>
      <p>{pending.concerts.length} concerts · {pending.photos.length} photos. Matching concert IDs will be updated and backed-up settings applied. Other concerts and existing photo files will be kept. Download your current backup first if needed.</p>
      <button disabled={busy} onClick={restore}>Restore this backup</button>{' '}
      <button disabled={busy} onClick={()=>{setPending(null);setMessage('Restore cancelled.')}}>Cancel restore</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" style={{color:'#f472b6'}}>{error}</p>}
  </section>
}
