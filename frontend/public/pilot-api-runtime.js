/* Default API origin; CI may overwrite this file from the VITE_API_BASE_URL Actions secret before build.
 * Path must NOT start with `/pdf` — Vite dev proxies `/pdf` to the API and would swallow `pdfpilot-*.js`. */
window.__PDFPILOT_API_BASE__ =
  window.__PDFPILOT_API_BASE__ || 'https://edit-your-pdf-1.onrender.com'
