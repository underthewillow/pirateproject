// Public Supabase connection details.
// The publishable ("anon") key is designed to be shipped in client code —
// row-level security controls what it can do, not secrecy of the key.
// Values can be overridden at build time with VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://jhgovaukkxdgoqqhqufs.supabase.co'

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_dGUaEMxjZ8c_pvxE6Y6KYQ_F794ChSt'
