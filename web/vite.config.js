import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base + HashRouter keeps the build portable: it works from a
// GitHub Pages project subpath, a user page, or a local file server
// without any repo-name configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  // `open` is what makes `npm run dev` (and the start scripts) put the app in
  // front of you instead of printing a URL to click.
  server: { port: 5173, strictPort: true, open: true },
})
