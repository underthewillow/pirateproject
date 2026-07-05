import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The repo is served from https://underthewillow.github.io/pirateproject/
// so assets must be requested from the /pirateproject/ base path.
// Override with VITE_BASE (e.g. "/" for a custom domain or Vercel).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/pirateproject/',
  plugins: [react()],
  server: {
    // Vite's dev server blocks unrecognized Host headers by default
    // (DNS-rebinding protection) — dev-server only, has no effect on
    // `vite build`/production. Needed so the tunnel domain used to test this
    // locally (with friends, or as the Authentik OIDC redirect_uri) works.
    allowedHosts: ['dev.pirate.jakee.me'],
  },
})
