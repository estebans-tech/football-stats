import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { redeemInviteAction } from '$lib/auth/index';

export const load: PageServerLoad = async ({ locals }) => {
  console.log('locals', locals)
  if (locals.user) throw redirect(302, '/');
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const fd = await event.request.formData();
    const code = String(fd.get('code') ?? '').trim();
    const next = fd.get('next') ? String(fd.get('next')) : undefined;

    const res = await redeemInviteAction(event, { code, next });

    if (res.kind === 'redirect') {
      // normal browser redirect (full nav)
      throw redirect(303, res.to);
    }

    // re-render page with error
    return fail(400, { message: res.message, code: res.code });
  }
};