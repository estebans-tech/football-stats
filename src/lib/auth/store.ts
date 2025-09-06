import { writable } from 'svelte/store'
import type { Role } from '$lib/auth/types'

export const role = writable<Role>('anon')