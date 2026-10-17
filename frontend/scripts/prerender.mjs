/**
 * Post-build prerenderer.
 *
 * Renders each PUBLIC route with a real browser (Playwright), waits for the
 * route-head effect + main content, then writes a static HTML snapshot to
 * dist/<route>/index.html. This gives crawlers and non-JS social scrapers
 * (WhatsApp, Facebook, LinkedIn) fully-formed pages with correct per-route
 * <title>, meta description, canonical, Open Graph, and JSON-LD — without
 * changing how the app runs (React still takes over on load).
 *
 * Usage:
 *   npm run build:static          # vite build + this script
 *   node scripts/prerender.mjs    # against an existing dist/ (spawns preview)
 *
 * Hosting note: your host must serve dist/<route>/index.html for that exact
 * path (directory-index behaviour) and only fall back to the SPA index.html for
 * unknown paths. Static hosts (Netlify, Caddy file_server, nginx try_files)
 * handle this; a catch-all rewrite to /index.html would bypass the snapshots.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { chromium } from 'playwright'
import { TOOL_REGISTRY } from '../src/shared/constants/toolRegistry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, '../dist')
const PORT = Number(process.env.PRERENDER_PORT || 4188)
const ORIGIN = `http://127.0.0.1:${PORT}`

/** Only public, crawlable routes — never auth/editor/admin pages. */
const ROUTES = [
  '/',
  '/terms',
  ...TOOL_REGISTRY.filter((t) => t.implemented !== false).map((t) => t.path),
]

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now()
  return new Promise((res, rej) => {
    const tick = async () => {
      try {
        const r = await fetch(url)
        if (r.ok) return res()
      } catch {
        /* not up yet */
      }
      if (Date.now() - started > timeoutMs) return rej(new Error('preview server did not start'))
      setTimeout(tick, 300)
    }
    tick()
  })
}

async function main() {
  // Serve the built app.
  const server = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: resolve(__dirname, '..'), stdio: 'ignore' }
  )
  const cleanup = () => {
    try {
      server.kill()
    } catch {
      /* ignore */
    }
  }
  process.on('exit', cleanup)

  try {
    await waitForServer(ORIGIN + '/')
    const browser = await chromium.launch()
    const page = await browser.newPage()

    let ok = 0
    for (const route of ROUTES) {
      await page.goto(ORIGIN + route, { waitUntil: 'networkidle' })
      // Wait for the app shell + our route-head effect to run.
      await page.waitForSelector('#root *', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(500)

      const html = await page.content()
      const dir = route === '/' ? DIST : join(DIST, route)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'index.html'), html, 'utf8')
      ok += 1
      console.log(`[prerender] ${route} -> ${route === '/' ? 'index.html' : route + '/index.html'}`)
    }

    await browser.close()
    console.log(`[prerender] done — ${ok}/${ROUTES.length} routes written`)
  } finally {
    cleanup()
  }
}

main().catch((e) => {
  console.error('[prerender] failed:', e?.message || e)
  process.exit(1)
})
