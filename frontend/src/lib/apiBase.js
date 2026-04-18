/**
 * API origin (no trailing slash), in order:
 * 1. `VITE_API_BASE_URL` at build time (preferred).
 * 2. `window.__PDFPILOT_API_BASE__` from `pdfpilot-api-config.js` (CI writes this from the same secret).
 *
 * Local dev: leave both unset; Vite proxies `/upload`, `/edit`, etc. to port 3001.
 */
function resolveApiBase() {
  const env = String(import.meta.env.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/$/, '')
  if (env) return env
  if (typeof window !== 'undefined') {
    const rt = String(window.__PDFPILOT_API_BASE__ ?? '')
      .trim()
      .replace(/\/$/, '')
    if (rt) return rt
  }
  return ''
}

/** Absolute API origin, or empty string if requests stay on the current site (dev proxy / misconfigured prod). */
export function getResolvedApiBase() {
  return resolveApiBase()
}

/** False when no API base — local dev uses the Vite proxy. */
export function isApiBaseConfigured() {
  return Boolean(resolveApiBase())
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const b = resolveApiBase()
  if (!b) return p
  return `${b}${p}`
}
