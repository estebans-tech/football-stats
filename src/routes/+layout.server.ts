import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  const data = {
    user: locals.user ?? null,
    role: (locals.role ?? 'anon') as 'anon' | 'viewer' | 'editor' | 'admin',
    canEdit: !!locals.canEdit,
    locale: locals.locale    // <- add this line
  }

  return data
}

