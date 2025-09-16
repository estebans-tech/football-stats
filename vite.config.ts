import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite' // om du använder Tailwind v4
import { sveltekit } from '@sveltejs/kit/vite'
import { SvelteKitPWA } from '@vite-pwa/sveltekit' // vänta med denna tills dev funkar

export default defineConfig({
  plugins: [
    sveltekit(),        // MÅSTE ligga först
    tailwindcss(),
	SvelteKitPWA({
		registerType: 'autoUpdate',
		includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
		manifest: {
			name: 'Käfigkicker – Stats',
			short_name: 'Kicker Stats',
			start_url: '/',
			scope: '/',
			display: 'standalone',
			theme_color: '#0ea5e9',
			background_color: '#000000',
			icons: [
			{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
			]
		},
		workbox: {
			navigateFallback: '/index.html',
			globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
			navigateFallbackDenylist: [/^\/(supabase|api)\//],
			runtimeCaching: [
			{
				urlPattern: ({ request }) => request.destination === 'document',
				handler: 'NetworkFirst',
				options: { cacheName: 'pages', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } }
			},
			{
				urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
				handler: 'StaleWhileRevalidate',
				options: { cacheName: 'assets' }
			},
			{
				urlPattern: ({ request }) => request.destination === 'image',
				handler: 'CacheFirst',
				options: {
				cacheName: 'images',
				expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
				}
			}
			]
		},
		devOptions: { enabled: true }
	})
  ],
  server: { host: true, port: 4321, strictPort: true },
  preview: { host: true, port: 4321, strictPort: true }
})