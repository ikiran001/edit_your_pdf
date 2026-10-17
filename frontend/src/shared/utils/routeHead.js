/**
 * Per-route <head> management for SEO on this client-rendered SPA.
 *
 * Sets a unique title, meta description, canonical URL, Open Graph / Twitter
 * tags, and a per-tool SoftwareApplication JSON-LD block on every navigation.
 *
 * Why this matters: before this, every tool page shipped the same meta
 * description and a canonical pointing at the site root — which tells Google the
 * tool pages are duplicates of the homepage and can keep them out of results.
 *
 * Note: Googlebot renders JS and picks these up, but non-JS social scrapers
 * (WhatsApp, Facebook, LinkedIn) read only the static index.html tags. Full
 * social-preview-per-page needs build-time prerendering (a later step).
 */
import {
  BRAND_NAME,
  docTitleForPath,
  metaDescriptionForPath,
} from '../constants/branding.js'

const SITE_URL = String(import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

function siteOrigin() {
  if (SITE_URL) return SITE_URL
  if (typeof window !== 'undefined' && window.location) return window.location.origin
  return ''
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id)
  if (data == null) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Apply all per-route head tags for the given React Router pathname.
 * @param {string} pathname
 */
export function applyRouteHead(pathname) {
  if (typeof document === 'undefined') return
  const p = (pathname || '/').replace(/\/$/, '') || '/'
  const title = docTitleForPath(p)
  const description = metaDescriptionForPath(p)
  const origin = siteOrigin()
  const canonical = origin ? origin + (p === '/' ? '/' : p) : ''

  document.title = title
  upsertMeta('name', 'description', description)
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  if (canonical) {
    upsertCanonical(canonical)
    upsertMeta('property', 'og:url', canonical)
  }

  // Per-tool SoftwareApplication schema → eligible for rich results on tool pages.
  const isTool = p.startsWith('/tools/')
  upsertJsonLd(
    'route-jsonld',
    isTool
      ? {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: `${title.replace(/^pdfpilot\s*[-–]\s*/, '')} — ${BRAND_NAME}`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web browser',
          ...(canonical ? { url: canonical } : {}),
          description,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
          publisher: { '@type': 'Organization', name: BRAND_NAME },
        }
      : null
  )
}
