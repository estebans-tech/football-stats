import type { RequestHandler } from './$types';
import { isSupportedLocale } from '$lib/i18n/types';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, cookies, request, url }) => {
  const lc = params.locale;
  if (!isSupportedLocale(lc)) throw redirect(302, '/'); // or 400

  cookies.set('locale', lc, { path: '/', sameSite: 'lax', maxAge: 60*60*24*365 });

  // redirect to the page the user came from (or home)
  const ref = request.headers.get('referer');
  try {
    const to = ref ? new URL(ref) : url;
    throw redirect(303, to.pathname + to.search + to.hash);
  } catch {
    throw redirect(303, '/');
  }
};