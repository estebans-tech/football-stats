// import type { LayoutServerLoad } from './$types'
// import { redirect } from '@sveltejs/kit'

// export const load: LayoutServerLoad = async ({ locals, url }) => {

//   console.log(locals)
//   if (!locals.user) throw redirect(302, `/invite?next=${encodeURIComponent(url.pathname)}`)
//   if (locals.role !== 'admin') throw redirect(302, '/')
//   return { user: locals.user, role: 'admin', canEdit: true }
// }

import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (locals.role !== 'admin') {
    throw redirect(302, '/');
  }
  return {
    user: locals.user,
    profile: locals.profile,
    role: locals.role,
    canEdit: !!locals.canEdit,
    isAdmin: locals.role === 'admin'
  };
};