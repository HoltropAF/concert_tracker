// * Supabase Storage wrapper for the two kinds of user photo: one per concert and one
// * per artist. Both live in a single private `photos` bucket, namespaced by user id.
// *
// * Paths are deterministic, not random, and are the only thing persisted (on the
// * concert as `photo`, or in settings for an artist):
// *   {userId}/{concertId}.jpg
// *   {userId}/artist-{slug}.jpg
// * That makes re-uploading an implicit replace, but also means renaming an artist
// * orphans their photo — the slug no longer matches.
// !
// ! The bucket is private, so a stored path is not directly usable as an <img src>.
// ! Always resolve it through getPhotoUrl().
import { supabase } from './supabase'

const MAX_DIM = 1280
const QUALITY = 0.82

// * Resize before upload: caps the long edge at 1280px at ~82% JPEG quality.
// * Uses Display P3 color space where available so wide-gamut iPhone photos
// * keep their saturation instead of being crushed into sRGB on the canvas.
export async function resizeImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('Could not read image')
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  let ctx = null
  try { ctx = canvas.getContext('2d', { colorSpace: 'display-p3' }) } catch (e) { /* fall through */ }
  if (!ctx) ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('Could not process image')
  return blob
}

// * Photos are stored at userId/concertId.jpg — each user owns their own folder.
// * Re-uploading the same concertId replaces the previous photo (upsert: true).
export async function uploadConcertPhoto(concertId, file) {
  if (!supabase) throw new Error('Not connected')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to add photos')
  const blob = await resizeImage(file)
  const path = `${user.id}/${concertId}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error
  urlCache.delete(path) // bust cache after replace
  return path
}

export async function deleteConcertPhoto(path) {
  if (!supabase || !path) return
  await supabase.storage.from('photos').remove([path])
  urlCache.delete(path)
}

// * Same idea as concert photos, but keyed by a slugified artist name so it's
// * one personal photo per artist rather than per show.
function slugifyArtist(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
export async function uploadArtistPhoto(artistName, file) {
  if (!supabase) throw new Error('Not connected')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to add photos')
  const blob = await resizeImage(file)
  const path = `${user.id}/artist-${slugifyArtist(artistName)}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error
  urlCache.delete(path)
  return path
}

export async function deleteArtistPhoto(path) {
  if (!supabase || !path) return
  await supabase.storage.from('photos').remove([path])
  urlCache.delete(path)
}

// * Signed URLs are valid for 60 min but cached for only 50 min to avoid
// * serving an expired URL in the last window before the signature expires.
// ! The cache is module-level and never cleared on sign-out. Entries are per-path and
// ! paths are namespaced by user id, so this can't leak one account's photo to
// ! another within a session, but the map does grow for the life of the page.
const urlCache = new Map()
export async function getPhotoUrl(path) {
  if (!supabase || !path) return null
  const hit = urlCache.get(path)
  if (hit && hit.expires > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return null
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}
