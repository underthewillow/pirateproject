import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The repo is served from https://underthewillow.github.io/pirateproject/
// so assets must be requested from the /pirateproject/ base path.
// Override with VITE_BASE (e.g. "/" for a custom domain or Vercel).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/pirateproject/',
  plugins: [
    react(),
    VitePWA({
      // Never leave a stale worker in charge: a new build takes over the page
      // as soon as it's fetched, no "click to refresh" prompt and no window
      // where an old precache keeps serving a dead app shell. This is what
      // makes the worker safe to ship — the previous attempt could strand a
      // device on an old build with no way back short of clearing site data.
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: "The Captain's Log",
        short_name: "Captain's Log",
        description: 'A shared ledger and log for our pirate crew.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#120a03',
        theme_color: '#29170c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Precache the built shell only. Supabase REST/realtime is a different
        // origin so it never enters the precache, and no runtime caching rule
        // is declared — every data request goes straight to the network.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // The map is ~megabytes and is fetched fine on demand; precaching it
        // would make first load (and every update) crawl.
        globIgnores: ['**/map.jpg', '**/crew/**', '**/desk/**'],
      },
      devOptions: {
        // vite-plugin-pwa normally only emits a worker for `vite build`. Turn
        // it on for `npm run dev` so the tunnel can be used to test install,
        // standalone chrome, and icons without deploying anything.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    // Vite's dev server blocks unrecognized Host headers by default
    // (DNS-rebinding protection) — dev-server only, has no effect on
    // `vite build`/production. Needed so the tunnel domain used to test this
    // locally (with friends, or as the Authentik OIDC redirect_uri) works.
    allowedHosts: ['devpirate.jakee.me', 'dev.pirate.jakee.me'],
  },
})
