import type { Handle } from '@sveltejs/kit';
import { initRequestAuth } from '$lib/auth';
import { chooseLocale } from '$lib/server/locale';

export const handle: Handle = async ({ event, resolve }) => {
  // Locale (SSR)
  event.locals.locale = chooseLocale(event);

  // Auth (SSR)
  const { user, role, canEdit, profile } = await initRequestAuth(event);
  event.locals.user = user ?? null;
  event.locals.profile = profile ?? null;
  event.locals.role = role ?? 'anon';
  event.locals.canEdit = !!canEdit;

  return resolve(event);
};