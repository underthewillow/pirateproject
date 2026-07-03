import { supabase } from './supabase'

// Generic data-access helpers. Every table in the app flows through these,
// so adding a new feature usually means adding a table name + a tab — no new
// data plumbing required.

export async function fetchAll(table, orderBy = 'sort_order') {
  let query = supabase.from(table).select('*')
  // Not every table has a sort_order column; fall back gracefully.
  const { data, error } = await query.order(orderBy, { ascending: true }).then(
    (r) => r,
    () => ({ data: null, error: 'order-failed' })
  )
  if (error) {
    const res = await supabase.from(table).select('*')
    if (res.error) throw res.error
    return res.data
  }
  return data
}

export async function insertRow(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select().single()
  if (error) throw error
  return data
}

export async function updateRow(table, id, patch, idField = 'id') {
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq(idField, id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRow(table, id, idField = 'id') {
  const { error } = await supabase.from(table).delete().eq(idField, id)
  if (error) throw error
}

export async function upsertRow(table, values, onConflict = 'id') {
  const { data, error } = await supabase
    .from(table)
    .upsert(values, { onConflict })
    .select()
    .single()
  if (error) throw error
  return data
}
