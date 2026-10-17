/**
 * Build-time sitemap generator.
 *
 * Reads TOOL_REGISTRY (single source of truth for tool routes) and writes
 * public/sitemap.xml so the sitemap can never drift out of sync with the app.
 * Runs automatically before `vite build` via the "prebuild" npm script.
 *
 * Site origin comes from VITE_SITE_URL (same env the HTML uses); falls back to
 * the production domain.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { TOOL_REGISTRY } from '../src/shared/constants/toolRegistry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_URL = String(process.env.VITE_SITE_URL || 'https://pdfpilot.pro').replace(/\/$/, '')
const LASTMOD = new Date().toISOString().slice(0, 10)

/** Higher-intent tools get a higher priority; everything else defaults to 0.8. */
const PRIORITY = {
  '/tools/edit-pdf': 0.95,
  '/tools/merge-pdf': 0.9,
  '/tools/split-pdf': 0.9,
  '/tools/compress-pdf': 0.9,
  '/tools/pdf-to-word': 0.9,
  '/tools/word-to-pdf': 0.9,
  '/tools/sign-pdf': 0.9,
  '/tools/jpg-to-pdf': 0.9,
  '/tools/pdf-to-jpg': 0.9,
  '/tools/gst-invoice': 0.9,
  '/tools/ocr-pdf': 0.85,
}

/** Static, crawlable, non-auth routes to always include. */
const STATIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/terms', priority: 0.3, changefreq: 'monthly' },
]

function urlEntry({ path, priority, changefreq }) {
  const loc = `${SITE_URL}${path === '/' ? '/' : path}`
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${LASTMOD}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(2)}</priority>`,
    '  </url>',
  ].join('\n')
}

const toolEntries = TOOL_REGISTRY.filter((t) => t.implemented !== false).map((t) => ({
  path: t.path,
  priority: PRIORITY[t.path] ?? 0.8,
  changefreq: 'weekly',
}))

const entries = [...STATIC_ROUTES, ...toolEntries]

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map(urlEntry),
  '</urlset>',
  '',
].join('\n')

const out = resolve(__dirname, '../public/sitemap.xml')
writeFileSync(out, xml, 'utf8')
console.log(`[sitemap] wrote ${entries.length} URLs → public/sitemap.xml (origin: ${SITE_URL})`)
