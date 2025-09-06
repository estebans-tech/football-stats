import { createBrowserClient } from '@supabase/ssr'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'
import { browser } from '$app/environment'

let _sb: ReturnType<typeof createBrowserClient> | null = null

export const getSupabase = () => {
  if (!browser) return null
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) return null
  if (!_sb) {
    _sb = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storageKey: 'fs.supabase.auth' }
    })
  }
  return _sb
}

export const supabase = createBrowserClient(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storageKey: 'fs.supabase.auth'
    }
  }
)