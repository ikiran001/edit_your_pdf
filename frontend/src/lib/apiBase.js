/**
 * In production, set VITE_API_BASE_URL to your public API origin (no trailing slash), e.g.
 * https://edit-pdf-api.onrender.com — then build: `VITE_API_BASE_URL=... npm run build`
 * Leave unset for local dev (Vite proxy) or same-origin hosting.
 */
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base}${p}`
}
