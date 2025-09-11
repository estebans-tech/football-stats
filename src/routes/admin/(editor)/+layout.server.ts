// import type { LayoutServerLoad } from './$types'
// import { redirect } from '@sveltejs/kit'

// export const load: LayoutServerLoad = async ({ locals, url }) => {
//   if (!locals.user) throw redirect(302, `/invite?next=${encodeURIComponent(url.pathname)}`)
//   if (!locals.canEdit) throw redirect(302, '/')
//   return { user: locals.user, role: locals.role, canEdit: true }
// }
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, `/invites?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return {
    user: locals.user,
    profile: locals.profile,
    role: locals.role,
    canEdit: !!locals.canEdit
  };
};