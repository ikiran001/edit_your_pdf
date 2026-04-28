import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Directory containing this config file (= `frontend/`). Used so `.env*` load correctly even when
// the shell cwd is the monorepo root (e.g. some IDE tasks). Do not rely on `process.cwd()` alone.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
// GitHub Pages project site: base must be /repo-name/ (CI sets VITE_BASE_PATH).
// Custom domain at root (pdfpilot.pro): set Actions secret VITE_BASE_PATH=/
//
// Env: Vite loads `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local` from `envDir` below
// (always this `frontend/` folder). For local dev use `.env.development` next to this file.
// Restart the dev server after changing env files.
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, __dirname, '')
  const base =
    process.env.VITE_BASE_PATH !== undefined && process.env.VITE_BASE_PATH !== ''
      ? process.env.VITE_BASE_PATH
      : fileEnv.VITE_BASE_PATH || '/'

  return {
    /** Pin env files to `frontend/` so `VITE_*` from `.env.development` are never skipped. */
    envDir: __dirname,
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
        '/ocr-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/encrypt-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/compress-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/document-flow': { target: 'http://localhost:3001', changeOrigin: true },
        '/user-sessions': { target: 'http://localhost:3001', changeOrigin: true },
        '/subscription': { target: 'http://localhost:3001', changeOrigin: true },
        '/feedback': { target: 'http://localhost:3001', changeOrigin: true },
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
        '/ocr-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/encrypt-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/compress-pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/document-flow': { target: 'http://localhost:3001', changeOrigin: true },
        '/user-sessions': { target: 'http://localhost:3001', changeOrigin: true },
        '/subscription': { target: 'http://localhost:3001', changeOrigin: true },
        '/feedback': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
  }
})
