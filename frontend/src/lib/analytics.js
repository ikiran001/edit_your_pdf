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

// --- Visit id (sessionStorage) — used on every GA hit ---

const SK_VID = 'pdfpilot_session_visit_id'
const SK_V0 = 'pdfpilot_session_visit_ts'
const SK_ROUTES = 'pdfpilot_session_routes'
const SK_STARTED = 'pdfpilot_session_visit_started_sent'

let sessionRecordingInit = false
let pagehideListenerAttached = false

export function tryGetVisitId() {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = sessionStorage.getItem(SK_VID)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
      sessionStorage.setItem(SK_VID, id)
    }
    return id
  } catch {
    return 'no_storage'
  }
}

function mergeSessionParams(params) {
  return { ...params, visit_id: tryGetVisitId() }
}

/**
 * Low-level GA4 event (non-blocking).
 */
export function analyticsEvent(name, params) {
  if (!gtagAvailable()) return
  try {
    window.gtag('event', name, sanitizeParams(mergeSessionParams(params || {})))
  } catch {
    /* ignore */
  }
}

/** Queue on microtask so clicks / saves are never blocked.
 *
 * **Session / journey** (register as GA4 custom events; every event also gets `visit_id`):
 * - `visit_started` — once per tab session: `landing_path`, `referrer_host`, `utm_params_present`
 * - `spa_route` — each in-app navigation: `path`, `route_index`
 * - `session_summary` — on tab close / navigate away (`pagehide`): `duration_seconds`, `route_hops`, `unique_paths`, `journey_tail`
 *
 * **Conversion-path events** (register as GA4 custom events / explorations):
 * - `pdf_to_word_path` — `{ path: 'client' }` (PDF→Word conversion is client-only)
 * - `pdf_to_word_failed` — `{ reason: 'insufficient_text' | 'size_limit' | 'page_limit' | 'client_error' }`
 * - `word_to_pdf_path` — `{ path: 'client' }` (Word→PDF draft is client-only)
 * - `word_to_pdf_failed` — `{ reason: 'empty_text' | 'size_limit' | 'parse_error' | 'client_error' }`
 * - `compress_pdf_path` — `{ mode: 'api_only' | 'fallback_only' | 'mixed' }`
 */
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
    visit_id: tryGetVisitId(),
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

// --- Session journey (GA4 + explorations) — call `initSessionRecording()` once from main.jsx ---

function ensureVisitStartTs() {
  try {
    let t = sessionStorage.getItem(SK_V0)
    if (!t) {
      t = String(Date.now())
      sessionStorage.setItem(SK_V0, t)
    }
    return Number(t)
  } catch {
    return Date.now()
  }
}

function referrerHost() {
  const r = typeof document !== 'undefined' ? document.referrer : ''
  if (!r) return '(direct)'
  try {
    return new URL(r).hostname.slice(0, 120)
  } catch {
    return '(unparseable)'
  }
}

function hasUtmInUrl() {
  try {
    const s = new URLSearchParams(window.location.search)
    return ['utm_source', 'utm_medium', 'utm_campaign'].some((k) => s.has(k))
  } catch {
    return false
  }
}

function readRouteList() {
  try {
    const raw = sessionStorage.getItem(SK_ROUTES)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function sendSessionSummary() {
  const routes = readRouteList()
  const t0 = ensureVisitStartTs()
  const durationSeconds = Math.max(0, Math.round((Date.now() - t0) / 1000))
  const unique = new Set(routes).size
  const journey = routes.slice(-20).join(' » ')
  trackEvent('session_summary', {
    duration_seconds: durationSeconds,
    route_hops: routes.length,
    unique_paths: unique,
    journey_tail: journey,
  })
}

/**
 * Call once at app bootstrap (after `initAnalytics()`). Session keys are always written when
 * `sessionStorage` is available; GA events only send when `gtag` is loaded (same as `trackEvent`).
 * - Assigns a per-tab `visit_id` (sessionStorage)
 * - Fires `visit_started` once (when gtag is available, same as other events)
 * - Records route list for `session_summary` on `pagehide`
 */
export function initSessionRecording() {
  if (typeof window === 'undefined' || sessionRecordingInit) return
  sessionRecordingInit = true

  tryGetVisitId()
  ensureVisitStartTs()
  try {
    if (!sessionStorage.getItem(SK_ROUTES)) sessionStorage.setItem(SK_ROUTES, '[]')
  } catch {
    /* ignore */
  }

  try {
    if (!sessionStorage.getItem(SK_STARTED)) {
      sessionStorage.setItem(SK_STARTED, '1')
      const landing = String(window.location.pathname || '/').slice(0, 200)
      queueMicrotask(() => {
        trackEvent('visit_started', {
          landing_path: landing,
          referrer_host: referrerHost(),
          utm_params_present: hasUtmInUrl(),
        })
      })
    }
  } catch {
    /* ignore */
  }

  if (!pagehideListenerAttached) {
    pagehideListenerAttached = true
    window.addEventListener('pagehide', (ev) => {
      if (ev.persisted) return
      sendSessionSummary()
    })
  }
}

/**
 * Record SPA pathname for journey analytics; emits `spa_route` (dedupes consecutive duplicates).
 * @param {string} pathname - e.g. `/tools/merge-pdf`
 */
export function recordSessionRoute(pathname) {
  const raw = typeof pathname === 'string' ? pathname.trim() : '/'
  const p = (raw.startsWith('/') ? raw : `/${raw}`).slice(0, 220) || '/'

  let routeIndex = 0
  try {
    const routes = readRouteList()
    if (routes.length > 0 && routes[routes.length - 1] === p) {
      return
    }
    routes.push(p)
    routeIndex = routes.length
    sessionStorage.setItem(SK_ROUTES, JSON.stringify(routes.slice(-80)))
  } catch {
    /* ignore */
  }

  if (routeIndex < 1) return
  queueMicrotask(() => {
    trackEvent('spa_route', { path: p, route_index: routeIndex })
  })
}
