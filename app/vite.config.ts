import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy estático custo-0 (Cloudflare Pages / Vercel / GitHub Pages).
// base relativa para funcionar em subpaths sem reconfigurar.
export default defineConfig({
  plugins: [react()],
  base: './',
})
