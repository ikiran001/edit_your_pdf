/** @typedef {{ nx: number, ny: number, nw: number, nh: number }} NormRect */

import { Util } from 'pdfjs-dist/legacy/build/pdf.mjs'

const PAD_PATTERN = 0.003
const PAD_SEARCH = 0.001

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Axis-aligned box in PDF user space for one text item (handles rotation via transform).
 * @param {import('pdfjs-dist').TextItem} item
 * @returns {[number, number, number, number] | null} [minX, minY, maxX, maxY] in PDF space
 */
function textItemToPdfBBox(item) {
  const m = item.transform
  const w = item.width ?? 0
  const fh = Math.hypot(m[2], m[3]) || 12
  const descent = fh * 0.22
  const ascent = fh - descent
  const o = [Infinity, Infinity, -Infinity, -Infinity]
  Util.axialAlignedBoundingBox([0, -ascent, w, descent], m, o)
  if (!Number.isFinite(o[0]) || !Number.isFinite(o[1])) return null
  return [o[0], o[1], o[2], o[3]]
}

/**
 * @param {import('pdfjs-dist').TextItem} item
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {{ pdfMinX: number, pdfMinY: number, pdfMaxX: number, pdfMaxY: number }} [clipPdf] optional clip in PDF user space (horizontal slice for substring)
 */
export function textItemToViewportBox(item, viewport, clipPdf) {
  let pdf = textItemToPdfBBox(item)
  if (!pdf) return { left: 0, top: 0, width: 0, height: 0 }
  let [minX, minY, maxX, maxY] = pdf
  if (clipPdf) {
    minX = Math.max(minX, clipPdf.pdfMinX)
    maxX = Math.min(maxX, clipPdf.pdfMaxX)
    minY = Math.max(minY, clipPdf.pdfMinY)
    maxY = Math.min(maxY, clipPdf.pdfMaxY)
  }
  if (maxX <= minX || maxY <= minY) return { left: 0, top: 0, width: 0, height: 0 }
  const quad = viewport.convertToViewportRectangle([minX, minY, maxX, maxY])
  const left = Math.min(quad[0], quad[2])
  const top = Math.min(quad[1], quad[3])
  const right = Math.max(quad[0], quad[2])
  const bottom = Math.max(quad[1], quad[3])
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} box
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @returns {NormRect}
 */
export function viewportBoxToNorm(box, viewport) {
  const vw = viewport.width
  const vh = viewport.height
  return {
    nx: clamp(box.left / vw, 0, 1),
    ny: clamp(box.top / vh, 0, 1),
    nw: clamp(box.width / vw, 0.002, 1),
    nh: clamp(box.height / vh, 0.002, 1),
  }
}

function padNorm(r, pad) {
  const nx = clamp(r.nx - pad, 0, 1)
  const ny = clamp(r.ny - pad, 0, 1)
  const nw = clamp(r.nw + 2 * pad, 0.006, 1 - nx)
  const nh = clamp(r.nh + 2 * pad, 0.006, 1 - ny)
  return { nx, ny, nw, nh }
}

const RE = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  phone: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/,
  cc: /\b(?:\d[ -]*?){13,19}\b/,
}

let _measureCtx = null
function getMeasureCtx() {
  if (typeof document === 'undefined') return null
  if (!_measureCtx) {
    const c = document.createElement('canvas')
    _measureCtx = c.getContext('2d')
  }
  return _measureCtx
}

/**
 * Shrink a full text-run viewport box to the substring [idx, idx+matchLen) using canvas
 * measureText (variable-width fonts). Falls back to uniform PDF slice for rotated runs.
 *
 * @param {import('pdfjs-dist').TextItem} item
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {string} str full item string
 * @param {number} idx start index in str
 * @param {number} matchLen length of match
 */
function viewportBoxForSubstring(item, viewport, str, idx, matchLen) {
  const full = textItemToViewportBox(item, viewport)
  if (full.width < 1 || full.height < 1) return full
  if (idx < 0 || matchLen < 1 || idx + matchLen > str.length) return full

  const m = item.transform
  const angle = Math.atan2(m[1], m[0])
  if (Math.abs(angle) > 0.12) {
    const slice = pdfXSliceForSubstring(item, idx, matchLen)
    if (!slice) return full
    return textItemToViewportBox(item, viewport, {
      pdfMinX: slice[0],
      pdfMinY: slice[1],
      pdfMaxX: slice[2],
      pdfMaxY: slice[3],
    })
  }

  const ctx = getMeasureCtx()
  if (!ctx) {
    const slice = pdfXSliceForSubstring(item, idx, matchLen)
    if (!slice) return full
    return textItemToViewportBox(item, viewport, {
      pdfMinX: slice[0],
      pdfMinY: slice[1],
      pdfMaxX: slice[2],
      pdfMaxY: slice[3],
    })
  }

  const fontPx = clamp(Math.min(full.height * 0.95, 144), 6, 200)
  ctx.font = `${fontPx}px sans-serif, Arial, "Helvetica Neue", "Noto Sans"`
  const total = ctx.measureText(str).width
  if (!(total > 0.5)) {
    const slice = pdfXSliceForSubstring(item, idx, matchLen)
    if (!slice) return full
    return textItemToViewportBox(item, viewport, {
      pdfMinX: slice[0],
      pdfMinY: slice[1],
      pdfMaxX: slice[2],
      pdfMaxY: slice[3],
    })
  }

  const wBefore = ctx.measureText(str.slice(0, idx)).width
  const wMatch = ctx.measureText(str.slice(idx, idx + matchLen)).width
  const scale = full.width / total
  const left = full.left + wBefore * scale
  const width = Math.max(1.5, wMatch * scale)

  return {
    left,
    top: full.top,
    width: Math.min(width, full.left + full.width - left),
    height: full.height,
  }
}

/**
 * Narrow PDF-space X range for a substring (uniform spacing fallback).
 * @param {import('pdfjs-dist').TextItem} item
 * @param {number} startIdx
 * @param {number} matchLen
 * @returns {[number, number, number, number] | null}
 */
function pdfXSliceForSubstring(item, startIdx, matchLen) {
  const full = String(item.str || '')
  if (startIdx < 0 || matchLen < 1 || startIdx + matchLen > full.length) return null
  const pdf = textItemToPdfBBox(item)
  if (!pdf) return null
  const [minX, minY, maxX, maxY] = pdf
  const wPdf = maxX - minX
  if (wPdf < 0.01) return pdf
  const t = full.length
  const x0 = minX + (wPdf * startIdx) / t
  const x1 = minX + (wPdf * (startIdx + matchLen)) / t
  return [Math.min(x0, x1), minY, Math.max(x0, x1), maxY]
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {'email' | 'phone' | 'cc'} kind
 * @returns {Promise<NormRect[]>}
 */
export async function findPatternNormRects(page, viewport, kind) {
  const regex = RE[kind]
  if (!regex) return []
  const tc = await page.getTextContent({ disableNormalization: true })
  /** @type {NormRect[]} */
  const out = []
  for (const item of tc.items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue
    const str = String(/** @type {{ str?: string }} */ (item).str || '')
    if (!str.trim()) continue
    regex.lastIndex = 0
    if (!regex.test(str)) continue
    try {
      const ti = /** @type {import('pdfjs-dist').TextItem} */ (item)
      const box = textItemToViewportBox(ti, viewport)
      if (box.width < 0.5 || box.height < 0.5) continue
      out.push(padNorm(viewportBoxToNorm(box, viewport), PAD_PATTERN))
    } catch {
      /* ignore bad transforms */
    }
  }
  return out
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {string} query
 * @returns {Promise<NormRect[]>}
 */
export async function findSearchNormRects(page, viewport, query) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 1) return []
  const tc = await page.getTextContent({ disableNormalization: true })
  /** @type {NormRect[]} */
  const out = []
  for (const item of tc.items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue
    const str = String(/** @type {{ str?: string }} */ (item).str || '')
    const lo = str.toLowerCase()
    const ti = /** @type {import('pdfjs-dist').TextItem} */ (item)

    let from = 0
    while (from <= str.length - q.length) {
      const idx = lo.indexOf(q, from)
      if (idx < 0) break
      try {
        const box = viewportBoxForSubstring(ti, viewport, str, idx, q.length)
        if (box.width >= 0.5 && box.height >= 0.5) {
          out.push(padNorm(viewportBoxToNorm(box, viewport), PAD_SEARCH))
        }
      } catch {
        /* ignore */
      }
      from = idx + Math.max(1, q.length)
    }
  }
  return out
}
