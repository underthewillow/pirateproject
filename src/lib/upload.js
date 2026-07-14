import { supabase } from './supabase'

// Direct image upload to Supabase Storage, so users can share a picture
// straight from their device instead of hosting it somewhere first. The
// 'uploads' bucket is public (see migration 0005_uploads_bucket.sql); we return
// the public URL to store on whatever record needs it (e.g. a Scuttlebutt post).
const BUCKET = 'uploads'

export async function uploadImage(file, folder = 'scuttlebutt') {
  if (!file) throw new Error('No file provided')
  const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`
  const path = `${folder}/${id}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
