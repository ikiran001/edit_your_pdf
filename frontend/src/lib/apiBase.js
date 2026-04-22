/**
 * API origin (no trailing slash), in order:
 * 1. `VITE_API_BASE_URL` at build time (preferred).
 * 2. `window.__PDFPILOT_API_BASE__` from `/pilot-api-runtime.js` (public/; CI may overwrite before build).
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

/**
 * Whether the browser can reach `/feedback` (and other proxied API routes).
 * In **development**, Vite proxies same-origin `/feedback` to the backend without `VITE_API_BASE_URL`.
 * In **production** builds, requests go to the deployed site host — set `VITE_API_BASE_URL` or
 * `pilot-api-runtime.js` so feedback hits your API, not static hosting.
 */
export function isFeedbackApiReachable() {
  if (isApiBaseConfigured()) return true
  return Boolean(import.meta.env.DEV)
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const b = resolveApiBase()
  if (!b) return p
  return `${b}${p}`
}
