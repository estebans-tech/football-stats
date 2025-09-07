import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter(),
    prerender: {
      entries: ['/', '/invite'], // only these routes
      crawl: false               // don’t follow links to other pages
    },      
    alias: {
      $lib: 'src/lib'
    }
  },
  preprocess: vitePreprocess()
}