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
      injectRegister: false,
      devOptions: {
        enabled: true,       // så du kan testa “Add to Home Screen” lokalt
        type: 'module',
      },
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'robots.txt',
        'apple-touch-icon.png'
      ],
      manifest: {
        name: 'Käfigkicker – Stats',
        short_name: 'Kicker Stats',
        description: 'Schneller Überblick über Spiele, Tore und Aufstellungen – offline verfügbar.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: "#000000",
        background_color: "#f3efe8",
        icons: [
          // Standard
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          // Maskable (för snyggare utsnitt på mobiler)
          { src: '/icon-192x192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: undefined,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Sidor/navigering: försök nät först, cacha som fallback (bra offline-upplevelse)
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          },
          // Bilder: cache-first (snabb rendering)
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      },
    })
  ],
  server: { host: true, port: 4321, strictPort: true },
  preview: { host: true, port: 4321, strictPort: true }
})