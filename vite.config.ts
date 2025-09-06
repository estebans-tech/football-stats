import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite' // om du använder Tailwind v4
import { SvelteKitPWA } from '@vite-pwa/sveltekit' // vänta med denna tills dev funkar

export default defineConfig({
  plugins: [
    sveltekit(),        // MÅSTE ligga först
    tailwindcss(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'robots.txt'],
			manifest: {
			  name: 'Käfigkicker – Stats',
			  short_name: 'Kicker Stats',
			  start_url: '/',
			  scope: '/',
			  display: 'standalone',
			  theme_color: '#000000',
			  background_color: '#ffffff',
			  icons: [
				{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
				{ src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
				{ src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
			  ]
			},
			workbox: {
			  globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
			  navigateFallbackDenylist: [/^\/(supabase|api)\//]
			},
			devOptions: { enabled: true }
		  })
  ],
  server: { host: true, port: 4321, strictPort: true },
  preview: { host: true, port: 4321, strictPort: true }
})