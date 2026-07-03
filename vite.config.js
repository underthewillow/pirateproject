import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The repo is served from https://underthewillow.github.io/pirateproject/
// so assets must be requested from the /pirateproject/ base path.
// Override with VITE_BASE (e.g. "/" for a custom domain or Vercel).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/pirateproject/',
  plugins: [react()],
})
