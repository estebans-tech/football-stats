import { role } from '$lib/auth/store'
import { browser } from '$app/environment'
import { writable, derived } from 'svelte/store'
import { supabase } from '$lib/supabase/client'
import type { Role, Profile } from '$lib/auth/types'


export async function redeemInvite(code: string) {
  const c = code?.trim().toUpperCase()
  if (!c) throw new Error('INVITE_EMPTY')

  // 1) ensure we have a session (anon ok)
  let s = (await supabase.auth.getSession()).data.session
  if (!s) {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    s = data.session
  }

  // 2) call RPC (preferred) -> expects { role, club_id }
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: c })
  if (error) throw error

  // 3) refresh local profile cache
  await refreshProfile()
  return data as { role: 'admin' | 'editor'; club_id: string | null }
}


const readCache = () => {
  try { return JSON.parse(localStorage.getItem('fs.profile') || 'null') as Profile }
  catch { return null }
}
const writeCache = (p: Profile) => {
  try { localStorage.setItem('fs.profile', JSON.stringify(p)) } catch {}
}

export const session = writable<import('@supabase/supabase-js').Session | null>(null)
export const profile = writable<Profile>(null)

export const canEdit = derived([profile, role], ([$profile, $role]) => {
  const r = $profile?.role ?? $role
  return r === 'admin' || r === 'editor'
})
export const isAdmin = derived(profile, p => p?.role === 'admin')

let initialized = false

export const initAuth = async () => {
  if (initialized) return
  initialized = true

  // ladda ev. cache direkt (bra offline)
  profile.set(readCache())

  const { data } = await supabase.auth.getSession()
  session.set(data.session ?? null)
  if (data.session) await refreshProfile()

  supabase.auth.onAuthStateChange(async (_event, s) => {
    session.set(s ?? null)
    if (s) await refreshProfile()
    else {
      profile.set(null)
      writeCache(null)
    }
  })
}

export const refreshProfile = async () => {
  try {
    const uid = (await supabase.auth.getUser()).data.user?.id
    if (!uid) { profile.set(null); writeCache(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, role, club_id')
      .eq('user_id', uid)
      .maybeSingle()
    if (error) throw error
    const p = data as Profile
    profile.set(p)
    writeCache(p)
    return p
  } catch {
    // behåll ev. cachead profil när offline
    return readCache()
  }
}

export const signInAnon = async () => {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  session.set(data.session ?? null)
  return data.session
}

export const signOut = async () => {
  await supabase.auth.signOut()
  profile.set(null)
  writeCache(null)
}


// Replace this map with a real check (Supabase/Dexie) later.
// While local/dev, define a few codes:
const CODE_TO_ROLE: Record<string, Role> = {
  'ADMIN-2024': 'admin',
  'EDITOR-2024': 'editor'
}

export async function acceptInvite(code: string): Promise<Role> {
  const c = code?.trim().toUpperCase()
  const matched = CODE_TO_ROLE[c]
  if (!matched) throw new Error('INVALID_INVITE')
  role.set(matched)
  if (browser) localStorage.setItem('auth.role', matched)
  return matched
}

export function restoreRoleFromStorage() {
  if (!browser) return
  const saved = localStorage.getItem('auth.role') as Role | null
  if (saved === 'admin' || saved === 'editor' || saved === 'anon') {
    role.set(saved)
  }
}

export function logout() {
  role.set('anon')
  if (browser) localStorage.removeItem('auth.role')
}
