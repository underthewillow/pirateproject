import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabaseConfig'

// Ask our Edge Function to fetch + normalize a D&D Beyond character.
// Accepts a full share URL or a bare id; returns the normalized sheet object.
export async function fetchDdbSheet(idOrUrl) {
  const id = String(idOrUrl || '').match(/\d{6,}/)?.[0]
  if (!id) throw new Error('No D&D Beyond character id found on this sheet.')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ddb-sheet?id=${id}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  let data
  try { data = await res.json() } catch { throw new Error('Sync service did not respond.') }
  if (!data.ok) throw new Error(data.error || 'Sync failed.')
  return data.sheet
}
