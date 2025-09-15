import type { Role } from '$lib/auth/types';

export const isAdmin = (role: Role | null | undefined): boolean =>
  role === 'admin';

export const canEditFromRole = (role: Role | null | undefined): boolean =>
  role === 'editor' || role === 'admin';

export const menuKeyFor = (role: Role | null | undefined): 'A' | 'B' | 'C' =>
  isAdmin(role) ? 'C' : canEditFromRole(role) ? 'B' : 'A';