import { register, init, getLocaleFromNavigator } from 'svelte-i18n'

// registrera språkfiler
register('sv', () => import('./sv.json'))
register('en', () => import('./en.json'))
register('de', () => import('./de.json'))

// hämta systemets språk
// const systemLocale = getLocaleFromNavigator()
const systemLocale = 'de'

init({
  fallbackLocale: 'de',        // alltid fallback på tyska
  initialLocale: systemLocale, // försök använda systeminställningar
})
// sedan när appen körs:
// locale.set('en')

// exportera locale om du vill växla språk manuellt
// export { locale }

// // Initiera med fallback och standardval
// init({
//   fallbackLocale: 'de',
//   initialLocale: getLocaleFromNavigator() || 'sv'
// })

