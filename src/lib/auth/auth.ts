import { role } from './store'
import type { Role } from './types'
import { browser } from '$app/environment'

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
