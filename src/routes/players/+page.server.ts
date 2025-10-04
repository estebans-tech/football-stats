import { redirect, error } from '@sveltejs/kit'
import { safeRedirect } from '$lib/server/safe-redirect'

export const load = async ({ locals, url }) => {
  // 1) Inte inloggad -> redirect till login
  if (!locals.user) {
    // inte inloggad -> redirect till login, med sanerad redirectTo
    const next = safeRedirect(url, '/')
    // const back = encodeURIComponent(url.pathname + url.search);
    throw redirect(303, next) // eller använd safeRedirect när du läser den på login-sidan
    // throw redirect(303, `/login?redirectTo=/${'' + back}`); // eller använd safeRedirect när du läser den på login-sidan
  }
}