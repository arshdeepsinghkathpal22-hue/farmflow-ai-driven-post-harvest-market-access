import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base + HashRouter keeps the build portable: it works from a
// GitHub Pages project subpath, a user page, or a local file server
// without any repo-name configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
