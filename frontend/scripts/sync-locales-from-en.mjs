#!/usr/bin/env node
/**
 * Merges missing keys from `en.json` into each locale file so new strings propagate
 * without wiping manual translations.
 *
 * Usage: node scripts/sync-locales-from-en.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localesDir = path.join(__dirname, '../src/i18n/locales')
const enPath = path.join(localesDir, 'en.json')

const CODES = [
  'es',
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
  'hi',
  'id',
  'ms',
  'pl',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
]

function deepMergeFromEn(enNode, targetNode) {
  if (typeof enNode === 'string') {
    return typeof targetNode === 'string' && targetNode.length > 0 ? targetNode : enNode
  }
  if (enNode && typeof enNode === 'object' && !Array.isArray(enNode)) {
    const existing = targetNode && typeof targetNode === 'object' && !Array.isArray(targetNode) ? targetNode : {}
    /** @type {Record<string, unknown>} */
    const out = { ...existing }
    for (const key of Object.keys(enNode)) {
      out[key] = deepMergeFromEn(enNode[key], existing[key])
    }
    return out
  }
  return targetNode !== undefined ? targetNode : enNode
}

const enRaw = fs.readFileSync(enPath, 'utf8')
const en = JSON.parse(enRaw)

for (const code of CODES) {
  const targetPath = path.join(localesDir, `${code}.json`)
  let existing = {}
  if (fs.existsSync(targetPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
    } catch {
      existing = {}
    }
  }
  const merged = deepMergeFromEn(en, existing)
  fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`)
}
console.log(`Merged ${CODES.length} locale files from en.json (preserved existing translations)`)
