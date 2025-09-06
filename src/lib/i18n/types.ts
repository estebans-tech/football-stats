export const SUPPORTED_LOCALES = ['en', 'de', 'sv'] as const
export type LocaleCode = typeof SUPPORTED_LOCALES[number]
export type LocaleCodeMaybe = LocaleCode | null

export const FALLBACK_LOCALE: LocaleCode = 'de'

export const isSupportedLocale = (val: unknown): val is LocaleCode =>
  typeof val === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(val)