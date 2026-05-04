/**
 * Microsoft Clarity — heatmaps & session replay (optional).
 * Set `VITE_CLARITY_PROJECT_ID` at build time (Clarity dashboard → Settings → Project ID).
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup
 */
let initialized = false

export function initClarity() {
  if (typeof window === 'undefined' || initialized) return
  /* index.html may already inject the official tag (recommended for Clarity setup detection). */
  if (document.querySelector('script[src*="clarity.ms/tag/"]')) {
    initialized = true
    return
  }
  const raw = import.meta.env.VITE_CLARITY_PROJECT_ID
  const projectId = typeof raw === 'string' ? raw.trim() : ''
  if (!projectId || !/^[a-z0-9]+$/i.test(projectId)) return

  initialized = true
  try {
    ;(function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          ;(c[a].q = c[a].q || []).push(arguments)
        }
      t = l.createElement(r)
      t.async = 1
      t.src = `https://www.clarity.ms/tag/${i}`
      y = l.getElementsByTagName(r)[0]
      y.parentNode.insertBefore(t, y)
    })(window, document, 'clarity', 'script', projectId)
  } catch {
    initialized = false
  }
}
