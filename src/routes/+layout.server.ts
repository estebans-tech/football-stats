import { getServerSupabase } from '$lib/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const supa = getServerSupabase(event)
  const { data: { user } } = await supa.auth.getUser()

  const data = {
    user: event.locals.user ?? null,
    role: (event.locals.role ?? 'anon') as 'anon' | 'viewer' | 'editor' | 'admin',
    canEdit: !!event.locals.canEdit,
    profile: event.locals.profile ?? null,
    locale: event.locals.locale,    // <- add this line
    user 
  }

  return data
}

