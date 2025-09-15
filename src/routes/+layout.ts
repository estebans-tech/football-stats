import { browser } from '$app/environment'
import { waitLocale } from 'svelte-i18n'
import '$lib/i18n'
import { startI18n } from '$lib/i18n';
import { getSupabase } from '$lib/supabase/client'
import { applyAuthFromLoad } from '$lib/auth/client'


// Types
import type { LayoutLoad } from './$types'
import { FALLBACK_LOCALE } from '$lib/i18n/types';

export const ssr = true
export const prerender = false

export const load: LayoutLoad = async ({ data }) => {
  startI18n(data.locale, FALLBACK_LOCALE);
  
  await waitLocale()

  // Hydrera browser-klienten med serverns session (om någon)
  if (browser && data.session) {
    const sb = getSupabase()
    if (sb) {
      const { data: { session: current } } = await sb.auth.getSession()
      if (!current || current.user?.id !== data.session.user.id) {
        await sb.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }
    }
  }

  applyAuthFromLoad({ session: data.session, profile: (data as any).profile }) // If Browser -> Apply to Stores

  return {...data} // <-- IMPORTANT: return nothing else here
}
