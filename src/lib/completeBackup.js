// Portable account data. Authentication credentials never belong in an export.
export const BACKUP_FORMAT = 'settracker-complete'
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024
const privateKeys = new Set(['spotifyAccessToken', 'spotifyRefreshToken', 'spotifyTokenExpiry'])
const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype'])
export function portableSettings(settings) {
  return Object.fromEntries(Object.entries(settings).filter(([key]) => !privateKeys.has(key) && !unsafeKeys.has(key)))
}
export function remapPhotoPaths(value, paths) {
  if (typeof value === 'string') return paths.get(value) || value
  if (Array.isArray(value)) return value.map(v => remapPhotoPaths(v, paths))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !unsafeKeys.has(k)).map(([k,v]) => [k,remapPhotoPaths(v,paths)]))
  return value
}
export function validateBackup(data) {
  if (!data || data.format !== BACKUP_FORMAT || data.version !== 1) throw new Error('Choose a SetTracker complete backup (version 1).')
  if (!Array.isArray(data.concerts) || !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings) || !Array.isArray(data.photos)) throw new Error('Backup is missing concerts, settings or photos.')
  const ids = new Set()
  for (const c of data.concerts) {
    if (!c || typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.artist !== 'string' || typeof c.date !== 'string') throw new Error('Backup contains an invalid or duplicate concert.')
    ids.add(c.id)
  }
  const paths = new Set()
  let bytes = 0
  for (const p of data.photos) {
    if (!p || typeof p.path !== 'string' || !p.path || paths.has(p.path) || typeof p.data !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.data)) throw new Error('Backup contains an invalid or duplicate photo.')
    try { atob(p.data.split(',')[1]) } catch { throw new Error('Backup contains invalid photo bytes.') }
    paths.add(p.path); bytes += p.data.length
  }
  if (bytes > MAX_BACKUP_BYTES) throw new Error('Backup photos exceed the 200 MB limit.')
  const references = [...data.concerts.map(c=>c.photo), ...Object.values(data.settings.artistPhotos || {})].filter(Boolean)
  for (const path of references) {
    if (typeof path === 'string' && !/^(https?:|data:)/i.test(path) && !paths.has(path)) throw new Error(`Photo file is missing from the backup: ${path}. Restore the missing file or remove its broken link first.`)
  }
  return { ...data, settings: portableSettings(data.settings) }
}

export async function createCompleteBackup({concerts, settings, listPhotos, readPhoto, onProgress = () => {}}) {
  const snapshot = JSON.parse(JSON.stringify({concerts,settings:portableSettings(settings)}))
  const files = await listPhotos()
  const photos = []
  let size = 0
  for (const file of files) {
    onProgress(`Packing photo ${photos.length + 1} of ${files.length}…`)
    const data = await readPhoto(file.path)
    size += data.length
    if (size > MAX_BACKUP_BYTES) throw new Error('Photos exceed the 200 MB backup limit. No incomplete backup was downloaded.')
    photos.push({path:file.path,data})
  }
  const backup = validateBackup({format:BACKUP_FORMAT,version:1,createdAt:new Date().toISOString(),...snapshot,photos})
  if (new Blob([JSON.stringify(backup)]).size > MAX_BACKUP_BYTES) throw new Error('Complete backup exceeds the 200 MB limit. No incomplete backup was downloaded.')
  return backup
}

export async function restoreCompleteBackup({backup, currentSettings, uploadPhoto, saveConcert, saveSettings, onProgress = () => {}}) {
  const data = validateBackup(backup)
  const paths = new Map()
  let saved = 0
  try {
    for (const photo of data.photos) {
      onProgress(`Restoring photo ${paths.size + 1} of ${data.photos.length}…`)
      paths.set(photo.path, await uploadPhoto(photo.data))
    }
    for (const c of data.concerts) {
      onProgress(`Restoring concert ${saved + 1} of ${data.concerts.length}…`)
      const result = await saveConcert(remapPhotoPaths(c, paths))
      if (result?.error) throw result.error
      saved++
    }
    const result = await saveSettings({...currentSettings,...remapPhotoPaths(data.settings,paths)})
    if (result?.error) throw result.error
    return {saved,photos:paths.size}
  } catch (error) {
    throw new Error(`Restore stopped after ${saved} concerts and ${paths.size} photos. Some changes may already be saved. ${error.message || 'Try again.'}`)
  }
}
