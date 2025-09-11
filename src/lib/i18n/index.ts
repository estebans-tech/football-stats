import { register, init, locale } from 'svelte-i18n'
import type { LocaleCode } from './types';

// lazy-load JSON dictionaries
register('en', () => import('./en.json'));
register('de', () => import('./de.json'));
register('sv', () => import('./sv.json'));

/** Call once on the client with the server-chosen locale */
export function startI18n(initial: LocaleCode, fallback: LocaleCode) {
  init({
    fallbackLocale: fallback,
    initialLocale: initial
  });
  // if a server render set a different locale later, this setter keeps them in sync
  locale.set(initial);
}