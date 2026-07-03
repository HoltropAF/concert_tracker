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

// * Signed URLs are valid for 60 min but cached for only 50 min to avoid
// * serving an expired URL in the last window before the signature expires.
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
