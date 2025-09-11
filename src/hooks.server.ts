// import type { Handle } from '@sveltejs/kit'
// import { readSession, roleFromUser, userCanEdit } from '$lib/auth/auth' // ← or inline below

// export const handle: Handle = async ({ event, resolve }) => {
//   // Read session (cookie/header) and derive role
//   const session = await readSession(event)           // { user: {...} } | null
//   const user = session?.user ?? null
//   const role = roleFromUser?.(user) ?? user?.role ?? 'anon'

//   event.locals.user = user
//   event.locals.role = role
//   event.locals.canEdit = userCanEdit?.(user) ?? (role === 'editor' || role === 'admin')

//   return resolve(event)
// }
import type { Handle } from '@sveltejs/kit';
import { initRequestAuth } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const { user, role, canEdit, profile } = await initRequestAuth(event);

  event.locals.user = user ?? null;
  event.locals.profile = profile ?? null;
  event.locals.role = role ?? 'anon';
  event.locals.canEdit = !!canEdit;
  event.locals.isAdmin = role === 'admin';

  return resolve(event);
};