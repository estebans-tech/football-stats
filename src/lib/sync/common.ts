import { getSupabase } from '$lib/supabase/client'

export const ensureSession = async () => {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase saknas')
  let { data: { session } } = await sb.auth.getSession()
  if (!session) {
    const { error } = await sb.auth.signInAnonymously()
    if (error) throw error
  }
  return sb
}

export const readClubId = async (): Promise<string> => {
  try {
    const p = JSON.parse(localStorage.getItem('fs.profile') || 'null')
    if (p?.club_id) return p.club_id
  } catch {}
  const sb = await ensureSession()
  const { data: u } = await sb.auth.getUser()
  const uid = u?.user?.id
  if (!uid) throw new Error('Ingen uid i sessionen')
  const { data, error } = await sb.from('profiles').select('club_id').eq('user_id', uid).maybeSingle()
  if (error) throw error
  if (!data?.club_id) throw new Error('club_id saknas')
  return data.club_id
}
