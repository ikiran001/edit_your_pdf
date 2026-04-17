import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// GitHub Pages project site: base must be /repo-name/ (CI sets VITE_BASE_PATH).
// Custom domain at root (pdfpilot.pro): set Actions secret VITE_BASE_PATH=/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const base =
    process.env.VITE_BASE_PATH !== undefined && process.env.VITE_BASE_PATH !== ''
      ? process.env.VITE_BASE_PATH
      : fileEnv.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/upload': { target: 'http://localhost:3001', changeOrigin: true },
        '/edit': { target: 'http://localhost:3001', changeOrigin: true },
        '/editor-state': { target: 'http://localhost:3001', changeOrigin: true },
        '/download': { target: 'http://localhost:3001', changeOrigin: true },
        '/pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/unlock-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/document-flow': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
    preview: {
      proxy: {
        '/upload': { target: 'http://localhost:3001', changeOrigin: true },
        '/edit': { target: 'http://localhost:3001', changeOrigin: true },
        '/editor-state': { target: 'http://localhost:3001', changeOrigin: true },
        '/download': { target: 'http://localhost:3001', changeOrigin: true },
        '/pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/unlock-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/document-flow': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  }
})
