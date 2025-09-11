// import type { LayoutLoad } from './$types'
// import '$lib/i18n' // side-effect: registers + init
// import { browser } from '$app/environment'
// import { locale as $locale, waitLocale } from 'svelte-i18n'
// import { isSupportedLocale, type LocaleCodeMaybe } from '$lib/i18n/types'
// import { initAuth } from '$lib/auth/auth'

// // Ensure client picks up persisted choice early in navigation
// export const load: LayoutLoad = async () => {

//   // console.log('before initAuth')
//   // start auth
//   // if (browser) await initAuth()
//     // console.log('after initAuth')
    
//   // 1) On client: apply saved locale early (if any)
//   if (browser) {
//     const saved = localStorage.getItem('locale') as LocaleCodeMaybe
//     if (isSupportedLocale(saved)) {
//       $locale.set(saved)
//     }
//   }

//   // 2) Now wait until the (possibly updated) locale is loaded
//   await waitLocale()

//   return {}
// }
// // export const ssr = false
import type { LayoutLoad } from './$types'
import '$lib/i18n'
import { browser } from '$app/environment'
import { locale as $locale, waitLocale } from 'svelte-i18n'
import { isSupportedLocale } from '$lib/i18n/types'

export const ssr = true
export const prerender = false

export const load: LayoutLoad = async ({ data }) => {
  if (browser) {
    const saved = localStorage.getItem('locale')
    if (isSupportedLocale(saved)) $locale.set(saved)
  }

  await waitLocale()

  return {...data} // <-- IMPORTANT: return nothing else here
}
