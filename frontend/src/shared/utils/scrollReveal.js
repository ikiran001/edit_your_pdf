/**
 * Scroll-reveal: fades/slides elements with the `fx-reveal` class into view.
 *
 * Safety:
 * - The hidden initial state lives under `html.fx-js` (added here), so if JS
 *   never runs (crawlers, prerendered snapshots) content stays fully visible.
 * - Under prefers-reduced-motion we simply mark everything visible and skip the
 *   observer entirely.
 * - If IntersectionObserver is unavailable, we reveal everything immediately.
 *
 * Call initScrollReveal() once at startup; call rescanReveal() after navigation
 * or any content swap to pick up newly-rendered `.fx-reveal` elements.
 */
let observer = null
let ready = false

function revealAll() {
  document.querySelectorAll('.fx-reveal:not(.is-visible)').forEach((el) => {
    el.classList.add('is-visible')
  })
}

export function initScrollReveal() {
  if (ready || typeof document === 'undefined') return
  ready = true

  // Enables the hidden-until-revealed CSS. Only set once JS is confirmed running.
  document.documentElement.classList.add('fx-js')

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReduced || typeof IntersectionObserver === 'undefined') {
    revealAll()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )

  rescanReveal()
}

export function rescanReveal() {
  if (!ready) return
  if (!observer) {
    // Reduced-motion / no-IO path: just make sure everything is shown.
    revealAll()
    return
  }
  document.querySelectorAll('.fx-reveal:not(.is-visible)').forEach((el) => {
    observer.observe(el)
  })
}
