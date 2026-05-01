import { defaultTextFormat } from '../../lib/textFormatDefaults.js'
import {
  ADD_TEXT_DRAFT_DEFAULT_FONT_CSS,
  DEFAULT_SNAP_PDF_H,
  MAX_ANNOT_TEXT_LENGTH,
} from './constants.js'

/** Raw or data-URL base64 → PNG bytes for placement sizing. */
export function rawBase64ToUint8(b64) {
  const s = String(b64 || '')
    .replace(/^data:image\/png;base64,/i, '')
    .trim()
  if (!s) return null
  try {
    const bin = atob(s)
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    return u8
  } catch {
    return null
  }
}

export function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

/**
 * Snap placed markup to native PDF text grid (line tops + baselines in normalized viewport space).
 * `item.x` / `item.y` follow the editor convention: top-left of the box in page-normalized coords.
 */
export function snapPlacedAnnotToNativeGrid(textBlocks, item, nx, ny, pdfH) {
  const blocks = textBlocks || []
  const ph = Number.isFinite(pdfH) && pdfH > 72 ? pdfH : DEFAULT_SNAP_PDF_H
  if (item?.type === 'signature') {
    const epsY = 0.012
    const epsX = 0.01
    let xo = nx
    let yo = ny
    let bestY = epsY
    let bestX = epsX
    for (const b of blocks) {
      const tn = b.norm?.ny
      if (Number.isFinite(tn)) {
        const d = Math.abs(ny - tn)
        if (d < bestY) {
          bestY = d
          yo = tn
        }
      }
      const tx = b.norm?.nx
      if (Number.isFinite(tx)) {
        const d = Math.abs(nx - tx)
        if (d < bestX) {
          bestX = d
          xo = tx
        }
      }
    }
    return { x: clamp01(xo), y: clamp01(yo) }
  }
  if (item?.type !== 'text') return { x: clamp01(nx), y: clamp01(ny) }
  const fs = Math.max(4, Number(item.fontSize) || 12)
  const deltaN = Math.min(0.09, Math.max(0.002, (fs / ph) * 0.76))
  const curBl = ny + deltaN
  const eps = 0.014
  let yOut = ny
  let best = eps
  for (const b of blocks) {
    const bn = b.norm?.baselineN
    if (!Number.isFinite(bn)) continue
    const d = Math.abs(curBl - bn)
    if (d < best) {
      best = d
      yOut = bn - deltaN
    }
  }
  for (const b of blocks) {
    const tn = b.norm?.ny
    if (!Number.isFinite(tn)) continue
    const d = Math.abs(ny - tn)
    if (d < best) {
      best = d
      yOut = tn
    }
  }
  let xOut = nx
  best = 0.012
  for (const b of blocks) {
    const tx = b.norm?.nx
    if (!Number.isFinite(tx)) continue
    const d = Math.abs(nx - tx)
    if (d < best) {
      best = d
      xOut = tx
    }
  }
  return { x: clamp01(xOut), y: clamp01(yOut) }
}

export function normalizePlacedAnnotDraftText(raw) {
  const s = String(raw ?? '').replace(/\r\n/g, '\n')
  return s.replace(/^\s+|\s+$/g, '').slice(0, MAX_ANNOT_TEXT_LENGTH)
}

/**
 * Native PDF text inline editor: map bitmap/viewport metrics to CSS px using the same scale as
 * `left`/`top` (`sx`/`sy`), then scale when the user changes the toolbar font size relative to open.
 * `toolbarFontAtOpen` must be the toolbar `fontSizeCss` captured when the editor opened (bitmap-based).
 */
export function nativeInlineEditorMetrics(block, fmt, toolbarFontAtOpen, sx, sy) {
  const s = sx > 0 && sy > 0 ? Math.min(sx, sy) : sx || sy || 1
  const syEff = sy > 0 ? sy : s
  const bmpFs = Math.max(6, Math.min(200, Number(block.fontSizePx) || 12))
  const geomFontCss = bmpFs * s
  const denom = Math.max(1, Number(toolbarFontAtOpen) || bmpFs)
  const cur = Math.max(1, Number(fmt?.fontSizeCss) || denom)
  const rel = denom > 0 ? cur / denom : 1
  const editorFontCssPx = Math.max(6, Math.min(240, geomFontCss * rel))
  const bmpH = Math.max(bmpFs * 0.92, Number(block.height) || bmpFs)
  const geomLineCss = bmpH * syEff
  const lineHeightPx = Math.max(
    Math.round(editorFontCssPx * 1.06),
    Math.round(geomLineCss * rel)
  )
  return { editorFontCssPx, lineHeightPx, rel }
}

export function normalizeHexForColorInput(c) {
  const s = String(c || '#000000').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const a = s.slice(1)
    return `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`
  }
  return '#000000'
}

export function seedFormatFromAnnotTextItem(it) {
  const base = defaultTextFormat()
  if (!it || it.type !== 'text') return base
  const cssN = Math.max(6, Math.min(144, Number(it.fontSizeCss) || ADD_TEXT_DRAFT_DEFAULT_FONT_CSS))
  return {
    ...base,
    fontSizeCss: cssN,
    color: normalizeHexForColorInput(it.color),
    bold: !!it.bold,
    italic: !!it.italic,
    underline: !!it.underline,
    fontFamily:
      typeof it.fontFamily === 'string' && it.fontFamily.trim() ? it.fontFamily.trim() : base.fontFamily,
    align: typeof it.align === 'string' && it.align ? it.align : base.align,
  }
}

/** Hex #RGB / #RRGGBB → rgba() for translucent highlights (no solid blocks). */
export function hexToRgba(hex, opacity) {
  const h = String(hex || '#facc15').replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  if (!Number.isFinite(n)) return `rgba(250, 204, 21, ${opacity})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  let a = Number(opacity)
  if (!Number.isFinite(a)) a = 0.35
  a = Math.min(1, Math.max(0.05, a))
  return `rgba(${r},${g},${b},${a})`
}

/** Inline editor “paper” fill — slightly translucent unless the user picked a manual mask colour. */
export function nativeEditorFillCss(maskHex, fmt) {
  const manual =
    fmt?.maskColorMode === 'manual' && /^#[0-9a-fA-F]{6}$/.test(fmt?.maskColorHex || '')
  const hex = manual ? fmt.maskColorHex : maskHex || '#ffffff'
  /* Slightly translucent auto-mask so 1px vector rules can show through the overlay. */
  return hexToRgba(hex, manual ? 1 : 0.92)
}

/** Normalize for comparing contenteditable value vs baseline (opening string). */
export function normalizeNativeCompare(s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim()
}

export function snapshotNativeFormat(f) {
  const fmt = f ?? defaultTextFormat()
  return {
    bold: !!fmt.bold,
    italic: !!fmt.italic,
    underline: !!fmt.underline,
    align: String(fmt.align || 'left'),
    color: String(fmt.color || '#000000')
      .trim()
      .toLowerCase(),
    opacity: Number(fmt.opacity ?? 1),
    rotationDeg: Number(fmt.rotationDeg ?? 0),
    fontFamily: String(fmt.fontFamily || 'Helvetica'),
    fontSizeCss: Number(fmt.fontSizeCss) || ADD_TEXT_DRAFT_DEFAULT_FONT_CSS,
  }
}

export function nativeFormatSnapshotsEqual(a, b) {
  if (!a || !b) return false
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.align === b.align &&
    a.color === b.color &&
    a.opacity === b.opacity &&
    a.rotationDeg === b.rotationDeg &&
    a.fontFamily === b.fontFamily &&
    a.fontSizeCss === b.fontSizeCss
  )
}
