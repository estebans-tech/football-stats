import { writable } from 'svelte/store'
import type { Role, Profile } from '$lib/auth/types'

export const role = writable<Role>('anon')
export const session = writable<import('@supabase/supabase-js').Session | null>(null)
export const profile = writable<Profile>(null)