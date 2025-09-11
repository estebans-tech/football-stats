// Server-only locale helpers
import type { RequestEvent } from '@sveltejs/kit';
import { FALLBACK_LOCALE, isSupportedLocale, type LocaleCode } from '$lib/i18n/types';
import { COOKIE_LOCALE, defaultCookieOpts } from './cookies';

/** Parse Accept-Language and pick the best supported locale. */
export function negotiateLocale(header: string | null): LocaleCode {
  if (!header) return FALLBACK_LOCALE;
  const tags = header
    .split(',')
    .map((s) => s.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean) as string[];
  for (const t of tags) {
    const base = t.split('-')[0]!;
    if (isSupportedLocale(t as LocaleCode)) return t as LocaleCode;
    if (isSupportedLocale(base as LocaleCode)) return base as LocaleCode;
  }
  return FALLBACK_LOCALE;
}

/** Read locale from cookie → Accept-Language → fallback. Also refresh cookie. */
export function chooseLocale(event: RequestEvent): LocaleCode {
  let lc = event.cookies.get(COOKIE_LOCALE) as LocaleCode | undefined;
  if (!isSupportedLocale(lc)) lc = negotiateLocale(event.request.headers.get('accept-language'));
  if (!isSupportedLocale(lc)) lc = FALLBACK_LOCALE;

  // keep cookie fresh (readable by client; httpOnly not required)
  event.cookies.set(COOKIE_LOCALE, lc, { ...defaultCookieOpts, httpOnly: false });
  return lc;
}