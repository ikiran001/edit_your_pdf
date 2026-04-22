/* Default: empty so `npm run dev` uses same-origin URLs and the Vite proxy to localhost:3001.
 * GitHub Actions overwrites this file before build (see deploy-github-pages.yml) with VITE_API_BASE_URL.
 * To point local dev at a remote API instead, set VITE_API_BASE_URL in frontend/.env.development.
 * Path must NOT start with `/pdf…` — Vite proxies `/pdf` to the API. */
window.__PDFPILOT_API_BASE__ = window.__PDFPILOT_API_BASE__ || ''
