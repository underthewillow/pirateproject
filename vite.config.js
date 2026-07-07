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
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: "The Captain's Log",
        short_name: "Captain's Log",
        description: 'A shared ledger and log for our pirate crew.',
        start_url: '.',
        display: 'standalone',
        background_color: '#1f1206',
        theme_color: '#29170c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Never cache Supabase API/realtime traffic — only the built app shell.
        navigateFallbackDenylist: [/^\/rest\//, /^\/realtime\//],
      },
    }),
  ],
  server: {
    // Vite's dev server blocks unrecognized Host headers by default
    // (DNS-rebinding protection) — dev-server only, has no effect on
    // `vite build`/production. Needed so the tunnel domain used to test this
    // locally (with friends, or as the Authentik OIDC redirect_uri) works.
    allowedHosts: ['dev.pirate.jakee.me'],
  },
})
