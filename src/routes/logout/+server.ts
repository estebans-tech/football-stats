
import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { getServerSupabase } from '$lib/auth';

export const POST: RequestHandler = async (event) => {
  const supa = getServerSupabase(event);

  // Clears the Supabase auth cookies for this browser
  await supa.auth.signOut();

  // Just in case there’s a leftover invite cookie
  event.cookies.delete('inv_id', { path: '/' });

  // const ref = event.request.headers.get('referer');
  // let to = '/';
  // if (ref) {
  //   try {
  //     const u = new URL(ref);
  //     to = u.pathname + u.search;
  //   } catch {
  //     /* ignore bad referer */
  //   }
  // }

  // throw redirect(303, to)
  throw redirect(303, '/')
}