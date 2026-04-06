import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Injects official gtag snippet into <head> so GA "Test your website" sees the tag in raw HTML. */
function injectGtagSnippetForVerification() {
  return {
    name: 'inject-gtag-snippet',
    transformIndexHtml(html, ctx) {
      const mode = ctx.server?.config?.mode ?? 'production'
      const fileEnv = loadEnv(mode, process.cwd(), '')
      const id = String(
        process.env.VITE_GA_MEASUREMENT_ID ?? fileEnv.VITE_GA_MEASUREMENT_ID ?? ''
      ).trim()
      if (!id || !id.startsWith('G-')) return html
      const esc = id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const snippet = `    <!-- Google tag (gtag.js) — in HTML for setup verification; events still use src/lib/analytics.js -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${esc}', { send_page_view: false });
    </script>
`
      return html.replace(/<\/head>/i, `${snippet}</head>`)
    },
  }
}

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
    plugins: [react(), tailwindcss(), injectGtagSnippetForVerification()],
    server: {
      proxy: {
        '/upload': { target: 'http://localhost:3001', changeOrigin: true },
        '/edit': { target: 'http://localhost:3001', changeOrigin: true },
        '/editor-state': { target: 'http://localhost:3001', changeOrigin: true },
        '/download': { target: 'http://localhost:3001', changeOrigin: true },
        '/pdf': { target: 'http://localhost:3001', changeOrigin: true },
        '/unlock-pdf': { target: 'http://localhost:3001', changeOrigin: true },
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
      },
    },
  }
})
