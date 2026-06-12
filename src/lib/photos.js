import { supabase } from './supabase'

const MAX_DIM = 1280
const QUALITY = 0.82

// Downscale an image file to max 1280px (long edge) JPEG ~82% quality.
export async function resizeImage(file) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('Could not read image')
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('Could not process image')
  return blob
}

// Upload (or replace) the single photo for a concert. Returns the storage path.
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

// Signed URL with in-memory cache (50 min, URLs valid 60 min)
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
