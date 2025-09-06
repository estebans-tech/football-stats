import { register, init, getLocaleFromNavigator, locale } from 'svelte-i18n'
import { browser } from '$app/environment'
import {
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
  isSupportedLocale,
  type LocaleCode,
  type LocaleCodeMaybe
} from './types'

// Explicit lazy registration (statiska imports för Vite treeshaking)
register('sv', () => import('./sv.json'))
register('en', () => import('./en.json'))
register('de', () => import('./de.json'))

// Resolve initial locale: saved -> system base -> fallback
const saved = (browser ? localStorage.getItem('locale') : null) as LocaleCodeMaybe
const systemBase = (browser ? getLocaleFromNavigator()?.split('-')[0] : null) as LocaleCodeMaybe

const initial: LocaleCode =
  (isSupportedLocale(saved) && saved) ||
  (isSupportedLocale(systemBase) && systemBase) ||
  FALLBACK_LOCALE

init({
  fallbackLocale: FALLBACK_LOCALE,
  initialLocale: initial
})

// Persist future changes (client only)
if (browser) {
  locale.subscribe((val) => {
    if (isSupportedLocale(val)) localStorage.setItem('locale', val)
  })
}

export * from './types'