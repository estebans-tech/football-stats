import type { LayoutLoad } from './$types'
import '$lib/i18n'
import { browser } from '$app/environment'
import { locale as $locale, waitLocale } from 'svelte-i18n'
import { isSupportedLocale } from '$lib/i18n/types'
import { startI18n } from '$lib/i18n';
import { FALLBACK_LOCALE } from '$lib/i18n/types';

export const ssr = true
export const prerender = false

export const load: LayoutLoad = async ({ data }) => {
  startI18n(data.locale, FALLBACK_LOCALE);
  
  await waitLocale()

  return {...data} // <-- IMPORTANT: return nothing else here
}
