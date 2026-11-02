/**
 * Unit tests for per-route SEO metadata (titles, feature labels, descriptions).
 *
 * Run: node --test src/shared/constants/branding.test.mjs
 *
 * The most important guard here is "every implemented tool route has its own
 * title/description": a tool present in TOOL_REGISTRY but missing from the title
 * map silently falls back to the homepage title + description, which reads as
 * duplicate content to search engines. That exact bug shipped for /tools/compare-pdf
 * and /tools/chat-with-pdf; these tests fail loudly if it ever regresses.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOC_TITLE_HOME,
  DEFAULT_SITE_DESCRIPTION,
  docTitleForPath,
  featureLabelForPath,
  metaDescriptionForPath,
} from './branding.js'
import { TOOL_REGISTRY } from './toolRegistry.js'

const implementedTools = TOOL_REGISTRY.filter((t) => t.implemented !== false)

test('every implemented tool route has a dedicated title (not the homepage fallback)', () => {
  const missing = implementedTools
    .filter((t) => docTitleForPath(t.path) === DOC_TITLE_HOME)
    .map((t) => t.path)
  assert.deepEqual(missing, [], `tool routes missing a dedicated <title>: ${missing.join(', ')}`)
})

test('every implemented tool route has a dedicated meta description (not the site default)', () => {
  const missing = implementedTools
    .filter((t) => metaDescriptionForPath(t.path) === DEFAULT_SITE_DESCRIPTION)
    .map((t) => t.path)
  assert.deepEqual(missing, [], `tool routes missing a dedicated description: ${missing.join(', ')}`)
})

test('every implemented tool route has a short feature label', () => {
  const missing = implementedTools.filter((t) => !featureLabelForPath(t.path)).map((t) => t.path)
  assert.deepEqual(missing, [], `tool routes missing a feature label: ${missing.join(', ')}`)
})

test('tool titles are keyword-first and brand-suffixed (not "pdfpilot - X")', () => {
  for (const t of implementedTools) {
    const title = docTitleForPath(t.path)
    assert.ok(
      !/^pdfpilot\s*[-–]/i.test(title),
      `${t.path} title should lead with the keyword, not the brand: "${title}"`
    )
    assert.ok(title.endsWith('| pdfpilot'), `${t.path} title should end with "| pdfpilot": "${title}"`)
  }
})

test('tool titles are unique across routes (no two pages compete for the same title)', () => {
  // Alias routes that intentionally render the same tool share a title; dedupe by title→paths.
  const byTitle = new Map()
  for (const t of implementedTools) {
    const title = docTitleForPath(t.path)
    byTitle.set(title, [...(byTitle.get(title) || []), t.path])
  }
  // Each distinct tool id should map to a distinct title; collisions across *different* tools are the smell.
  const titles = implementedTools.map((t) => docTitleForPath(t.path))
  assert.equal(new Set(titles).size, titles.length, 'duplicate tool titles detected')
})

test('feature labels do not leak brand or benefit copy', () => {
  for (const t of implementedTools) {
    const label = featureLabelForPath(t.path)
    assert.ok(!/pdfpilot|online free|\|/i.test(label), `${t.path} label should be a bare tool name: "${label}"`)
  }
})

test('known routes resolve to their expected copy', () => {
  assert.equal(docTitleForPath('/tools/merge-pdf'), 'Merge PDF Online Free — Combine PDFs Fast | pdfpilot')
  assert.equal(featureLabelForPath('/tools/merge-pdf'), 'Merge PDF')
  // The two routes that previously inherited the homepage title:
  assert.notEqual(docTitleForPath('/tools/compare-pdf'), DOC_TITLE_HOME)
  assert.notEqual(docTitleForPath('/tools/chat-with-pdf'), DOC_TITLE_HOME)
  // Trailing slash is normalized.
  assert.equal(docTitleForPath('/tools/merge-pdf/'), docTitleForPath('/tools/merge-pdf'))
  // Unknown routes fall back to the homepage title / site default.
  assert.equal(docTitleForPath('/nope'), DOC_TITLE_HOME)
  assert.equal(metaDescriptionForPath('/nope'), DEFAULT_SITE_DESCRIPTION)
})
