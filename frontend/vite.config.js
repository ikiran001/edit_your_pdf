import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// GitHub Pages project site: VITE_BASE_PATH=/repo-name/  (e.g. /edit_your_pdf/)
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/upload': { target: 'http://localhost:3001', changeOrigin: true },
      '/edit': { target: 'http://localhost:3001', changeOrigin: true },
      '/download': { target: 'http://localhost:3001', changeOrigin: true },
      '/pdf': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/upload': { target: 'http://localhost:3001', changeOrigin: true },
      '/edit': { target: 'http://localhost:3001', changeOrigin: true },
      '/download': { target: 'http://localhost:3001', changeOrigin: true },
      '/pdf': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
