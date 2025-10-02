
import { get } from 'svelte/store';
import { role, session, profile } from '$lib/auth/store'
import { canEditFromRole, isAdmin as isAdminFromRole } from '$lib/auth/helpers';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Role } from '$lib/auth/types';
import { browser } from '$app/environment';

/** Sätter auth-stores (session, profile, role) från load-data. Safe att kalla i SSR – gör inget då. */
export function applyAuthFromLoad(data: {
  session?: Session | null;
  profile?: Profile | null;
  role?: Role | null; // valfritt om du skickar role separat
} = {}): void {
  if (!browser) return;

  const s = data.session ?? null;
  const p = data.profile ?? null;
  const r = (data.role ?? p?.role ?? 'anon') as Role;

  session.set(s);
  profile.set(p);
  role.set(r);
}

/** 1) är användaren inloggad? */
export function isAuthenticated(): boolean {
  return !!get(session);
}

/** 2) kan användaren editera? ('editor' | 'admin') */
export function canEdit(): boolean {
  return canEditFromRole(get(role));
}

/** 3) är användaren admin? */
export function isAdmin(): boolean {
  return isAdminFromRole(get(role));
}