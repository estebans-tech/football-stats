import { writable } from 'svelte/store'
import type { Role } from './types'

export const role = writable<Role>('anon')