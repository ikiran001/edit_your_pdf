#!/usr/bin/env node
/**
 * Fills locale JSON by translating each unique English string (Google translate_gtx).
 * Skips: en, es, hi (maintain those by hand).
 *
 *   node scripts/translate-locales-gtx.mjs
 *   node scripts/translate-locales-gtx.mjs ko vi
 *
 * Uses small concurrent batches + per-request timeout. Needs network.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, '../src/i18n/locales')
const enPath = path.join(localesDir, 'en.json')

const ALL_TARGETS = [
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ru',
  'ko',
  'zh-CN',
  'zh-TW',
  'ar',
  'bg',
  'ca',
  'nl',
  'el',
  'id',
  'ms',
  'pl',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
]

const SKIP_TRANSLATE = new Set(['en', 'es', 'hi'])

const CONCURRENCY = 8
const BETWEEN_BATCH_MS = 120
const FETCH_TIMEOUT_MS = 22000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** @type {Map<string, string>} */
const cache = new Map()

async function translateText(text, tl) {
  const key = `${tl}\0${text}`
  if (cache.has(key)) return cache.get(key)
  if (!text || text.trim() === '') {
    cache.set(key, text)
    return text
  }
  const q = encodeURIComponent(text.slice(0, 4500))
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tl)}&dt=t&q=${q}`

  let attempt = 0
  let lastErr
  while (attempt < 5) {
    try {
      const ac = new AbortController()
      const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
      const res = await fetch(url, { signal: ac.signal })
      clearTimeout(to)
      if (res.status === 429) {
        await sleep(2500 * (attempt + 1))
        attempt++
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const out = data[0].map((/** @type {unknown[]} */ seg) => seg[0]).join('')
      cache.set(key, out)
      return out
    } catch (e) {
      lastErr = e
      attempt++
      await sleep(800 * attempt)
    }
  }
  throw lastErr
}

/**
 * @param {string[]} texts
 * @param {string} tl
 */
async function translateMany(texts, tl) {
  /** @type {string[]} */
  const out = new Array(texts.length)
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY)
    const part = await Promise.all(slice.map((t) => translateText(t, tl)))
    for (let j = 0; j < part.length; j++) out[i + j] = part[j]
    await sleep(BETWEEN_BATCH_MS)
  }
  return out
}

/** @param {unknown} node @param {string[]} bucket */
function collectStrings(node, bucket) {
  if (typeof node === 'string') {
    bucket.push(node)
    return
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const k of Object.keys(node)) collectStrings(node[k], bucket)
  }
}

/**
 * @param {unknown} node
 * @param {Map<string, string>} map en -> translated
 */
function applyMap(node, map) {
  if (typeof node === 'string') return map.get(node) ?? node
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const k of Object.keys(node)) out[k] = applyMap(node[k], map)
    return out
  }
  return node
}

async function translateTree(enObj, tl) {
  const bucket = []
  collectStrings(enObj, bucket)
  const unique = [...new Set(bucket)]
  const translated = await translateMany(unique, tl)
  const map = new Map()
  for (let i = 0; i < unique.length; i++) map.set(unique[i], translated[i])
  return applyMap(enObj, map)
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const targets =
    argv.length > 0 ? argv.filter((t) => ALL_TARGETS.includes(t) && !SKIP_TRANSLATE.has(t)) : ALL_TARGETS

  if (targets.length === 0) {
    console.error('No valid target codes. Use:', ALL_TARGETS.join(', '))
    process.exit(1)
  }

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  for (const tl of targets) {
    console.log('Translating →', tl, '…')
    const translated = await translateTree(en, tl)
    const outPath = path.join(localesDir, `${tl}.json`)
    fs.writeFileSync(outPath, `${JSON.stringify(translated, null, 2)}\n`)
    console.log('  wrote', path.relative(path.join(__dirname, '..'), outPath))
  }
  console.log('Done. Hand-maintained locales:', [...SKIP_TRANSLATE].join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
