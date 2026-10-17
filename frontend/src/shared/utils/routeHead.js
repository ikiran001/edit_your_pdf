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
import { TOOL_SEO_BY_ID } from '../constants/toolSeoContent.js'
import { getBlogPost } from '../../content/blogPosts.js'

const BLOG_INDEX_DESCRIPTION =
  'Practical PDF how-to guides and India-specific tips from pdfpilot — compress for government uploads, create GST invoices, convert PDF to Word, run OCR, and more.'

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
  const blogSlug = p.startsWith('/blog/') ? p.slice('/blog/'.length) : null
  const post = blogSlug ? getBlogPost(blogSlug) : null

  let title
  let description
  if (post) {
    title = `${post.title} | pdfpilot Blog`
    description = post.description
  } else if (p === '/blog') {
    title = 'PDF Tips & Guides | pdfpilot Blog'
    description = BLOG_INDEX_DESCRIPTION
  } else {
    title = docTitleForPath(p)
    description = metaDescriptionForPath(p)
  }

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

  // Primary structured data: SoftwareApplication for tools, BlogPosting for posts.
  const isTool = p.startsWith('/tools/')
  let primaryLd = null
  if (isTool) {
    primaryLd = {
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
  } else if (post) {
    primaryLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      ...(canonical ? { url: canonical, mainEntityOfPage: canonical } : {}),
      author: { '@type': 'Organization', name: BRAND_NAME },
      publisher: { '@type': 'Organization', name: BRAND_NAME },
      ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
    }
  }
  upsertJsonLd('route-jsonld', primaryLd)

  // FAQPage schema → eligible for FAQ rich snippets, for tools that define FAQs.
  const toolId = isTool ? p.slice('/tools/'.length) : null
  const faqs = toolId ? TOOL_SEO_BY_ID[toolId]?.faqs : null
  upsertJsonLd(
    'route-faq-jsonld',
    faqs?.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null
  )
}
