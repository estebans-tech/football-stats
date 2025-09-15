import { page } from '$app/state';
import { afterNavigate } from '$app/navigation';
import type { Action } from 'svelte/action';
import type { Profile } from '$lib/auth/types';

export const PROFILE_LS_KEY = 'fs.profile';


export function writeProfileToLS(p: Profile | null) {
  if (typeof localStorage === 'undefined') return;
  if (!p) return localStorage.removeItem(PROFILE_LS_KEY);
  const lean = {
    user_id: p.user_id,
    display_name: p.display_name ?? null,
    role: p.role,
    club_id: p.club_id ?? null
  };
  localStorage.setItem(PROFILE_LS_KEY, JSON.stringify(lean));
}

export function readProfileFromLS(): Profile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem('fs.profile') || 'null') as Profile;
    return raw ? raw : null;
    // return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export const profileSync: Action = () => {
  const sync = () =>
    writeProfileToLS((page.data?.profile ?? null) as Profile | null);

  sync();               // initialt (efter hydration)
  afterNavigate(sync);  // vid framtida navigeringar

  return { destroy: () => {} }; // inget att städa upp
}
