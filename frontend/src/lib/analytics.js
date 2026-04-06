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

  /* index.html may already include the official gtag snippet (build-time inject) for GA setup verification */
  const gtagScript = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}"]`
  )
  if (typeof window.gtag === 'function' && gtagScript) {
    initialized = true
    return
  }

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

function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    if (typeof v === 'string' && v.length > 500) out[k] = `${v.slice(0, 497)}...`
    else out[k] = v
  }
  return out
}

/**
 * Low-level GA4 event (non-blocking).
 */
export function analyticsEvent(name, params) {
  if (!gtagAvailable()) return
  try {
    window.gtag('event', name, sanitizeParams(params))
  } catch {
    /* ignore */
  }
}

/** Queue on microtask so clicks / saves are never blocked. */
export function trackEvent(name, params = {}) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => analyticsEvent(name, params))
  } else {
    setTimeout(() => analyticsEvent(name, params), 0)
  }
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

// --- Funnel (session) — upload → download ---

const SK_TOOL = 'ga4_funnel_tool'
const SK_UPLOAD_TS = 'ga4_funnel_upload_ts'

export function markFunnelUpload(tool) {
  try {
    if (tool) sessionStorage.setItem(SK_TOOL, tool)
    sessionStorage.setItem(SK_UPLOAD_TS, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function markFunnelDownloadComplete(tool) {
  try {
    sessionStorage.removeItem(SK_UPLOAD_TS)
    if (tool) sessionStorage.removeItem(SK_TOOL)
  } catch {
    /* ignore */
  }
}

// --- Named events (spec) ---

export function trackFeatureUsed(featureName) {
  trackEvent('feature_used', { feature_name: featureName })
}

/** `file_size` is kilobytes (spec). */
export function trackFileUploaded(p) {
  const kb = p.file_size != null ? Math.round(Number(p.file_size)) : undefined
  trackEvent('file_uploaded', {
    file_type: p.file_type ?? 'pdf',
    file_size: kb,
    tool: p.tool,
  })
}

export function trackToolCompleted(tool, success = true) {
  trackEvent('tool_completed', { tool, success })
}

/** `file_size` is kilobytes when provided. */
export function trackFileDownloaded(p) {
  markFunnelDownloadComplete(p.tool)
  const kb = p.file_size != null ? Math.round(Number(p.file_size)) : undefined
  trackEvent('file_downloaded', {
    tool: p.tool,
    file_size: kb,
    total_pages:
      p.total_pages != null ? Math.max(0, Math.round(Number(p.total_pages))) : undefined,
  })
}

export function trackSignatureAdded(method) {
  trackEvent('signature_added', { method })
}

export function trackSignaturePlaced(pageNumber) {
  trackEvent('signature_placed', {
    page_number: Math.max(1, Math.round(Number(pageNumber))),
  })
}

export function trackErrorOccurred(feature, errorMessage) {
  const msg = String(errorMessage || 'unknown').slice(0, 200)
  trackEvent('error_occurred', { feature, error_message: msg })
}

export function trackToolEngagement(tool, durationSeconds) {
  const s = Math.max(0, Math.round(Number(durationSeconds)))
  if (s < 1) return
  trackEvent('tool_engagement', { tool, duration_seconds: s })
}

export function trackUploadCtaClick(tool) {
  trackEvent('upload_cta_click', { tool })
}

/** Optional: processing duration for save/convert pipelines (ms → seconds). */
export function trackProcessingTime(tool, durationMs) {
  const sec = Math.max(0, Math.round(Number(durationMs) / 1000))
  if (sec < 1) return
  trackEvent('processing_time', { tool, duration_seconds: sec })
}
