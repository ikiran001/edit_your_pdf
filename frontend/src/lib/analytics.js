const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

let initialized = false

/**
 * Loads gtag.js and configures GA4 when VITE_GA_MEASUREMENT_ID is set at build time.
 * Safe to call once from main.jsx; no-ops in dev unless you set the env var.
 */
export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return
  const id = typeof MEASUREMENT_ID === 'string' ? MEASUREMENT_ID.trim() : ''
  if (!id || !id.startsWith('G-')) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)

  initialized = true
}

function gtagAvailable() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function'
}

/**
 * SPA-friendly page view (use after initAnalytics).
 * @param {string} path - virtual path, e.g. '/' or '/edit'
 * @param {string} [title]
 */
export function pageView(path, title) {
  const id = typeof MEASUREMENT_ID === 'string' ? MEASUREMENT_ID.trim() : ''
  if (!id || !gtagAvailable()) return
  window.gtag('config', id, {
    page_path: path,
    page_title: title || document.title,
    page_location: typeof window !== 'undefined' ? window.location.href : undefined,
  })
}

/**
 * Custom event for GA4 (optional).
 * @param {string} name
 * @param {Record<string, unknown>} [params]
 */
export function analyticsEvent(name, params) {
  if (!gtagAvailable()) return
  window.gtag('event', name, params || {})
}
