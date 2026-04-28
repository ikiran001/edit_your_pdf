/**
 * Shared layout math for page-number stamping (pdf-lib coords + browser preview overlay).
 * Origin: bottom-left; y is baseline distance from bottom (matches pdf-lib drawText).
 */

export function clampGrid01(v) {
  const n = Number(v)
  if (n === 1) return 1
  if (n === 2) return 2
  return 0
}

/**
 * @param {'plain'|'page-n'|'page-n-of-m'} format
 */
export function formatPageNumberText(format, n, totalPagesInDoc) {
  if (format === 'plain') return String(n)
  if (format === 'page-n') return `Page ${n}`
  return `Page ${n} of ${totalPagesInDoc}`
}

/**
 * @param {0|1|2} gridRow
 * @param {0|1|2} gridCol
 */
export function xySingle(gridRow, gridCol, pageW, pageH, margin, fontSize, textW) {
  const halfH = fontSize * 0.4
  let y
  if (gridRow === 0) y = pageH - margin - fontSize
  else if (gridRow === 2) y = margin + halfH
  else y = pageH / 2 - halfH

  let x
  if (gridCol === 0) x = margin
  else if (gridCol === 2) x = pageW - margin - textW
  else x = (pageW - textW) / 2

  return { x, y }
}

/**
 * @param {number} physicalOneBased
 */
export function xyFacing(gridRow, pageW, pageH, margin, fontSize, textW, physicalOneBased) {
  const halfH = fontSize * 0.4
  let y
  if (gridRow === 0) y = pageH - margin - fontSize
  else if (gridRow === 2) y = margin + halfH
  else y = pageH / 2 - halfH

  const odd = physicalOneBased % 2 === 1
  const x = odd ? pageW - margin - textW : margin
  return { x, y }
}

/**
 * Approximate text width in CSS px ~ pdf points for overlay (Helvetica-like sans-serif).
 * @param {string} text
 * @param {number} fontSizePt
 * @param {boolean} bold
 */
export function estimateTextWidthPx(text, fontSizePt, bold) {
  if (typeof document === 'undefined') return Math.max(8, text.length * fontSizePt * 0.52)
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) return Math.max(8, text.length * fontSizePt * 0.52)
  ctx.font = `${bold ? 'bold ' : ''}${fontSizePt}px sans-serif`
  return Math.max(4, ctx.measureText(text).width)
}
