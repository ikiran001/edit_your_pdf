/**
 * Add Text geometry in PDF user space (points, bottom-left origin) using pdf.js viewport transforms.
 * Preview and export share the same anchor: pdf-lib `drawText` baseline = `pdfBaselineY`.
 */

import { PLACED_TEXT_BASELINE_FRAC } from './placedTextConstants.js'

/**
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {number} vx — viewport/canvas pixel X (top-left of content box)
 * @param {number} vy — viewport/canvas pixel Y
 * @param {number} fontSizePt — pdf-lib text size (PDF points)
 */
export function placedTextPdfFromViewportTopLeft(viewport, vx, vy, fontSizePt) {
  const fs = Math.max(4, Math.min(144, Number(fontSizePt) || 12))
  const [pdfX, pdfYTop] = viewport.convertToPdfPoint(vx, vy)
  const pdfBaselineY = pdfYTop - fs * PLACED_TEXT_BASELINE_FRAC
  return { pdfX, pdfBaselineY }
}

/**
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {number} pdfX
 * @param {number} pdfBaselineY
 * @param {number} fontSizePt
 * @returns {{ vx: number, vy: number }} viewport pixels for the content top-left (matches legacy normalized top)
 */
export function placedTextViewportTopLeftFromPdf(viewport, pdfX, pdfBaselineY, fontSizePt) {
  const fs = Math.max(4, Math.min(144, Number(fontSizePt) || 12))
  const pdfYTop = pdfBaselineY + fs * PLACED_TEXT_BASELINE_FRAC
  const [vx, vy] = viewport.convertToViewportPoint(pdfX, pdfYTop)
  return { vx, vy }
}

/**
 * CSS overlay box uses uniform scale bmp/css; map viewport px → CSS px.
 */
export function viewportPxToCssOverlay(vx, vy, cw, ch, bmpW, bmpH) {
  const sx = cw / Math.max(bmpW, 1)
  const sy = ch / Math.max(bmpH, 1)
  return { cssX: vx * sx, cssY: vy * sy }
}

/**
 * Pointer delta in CSS px → viewport pixel delta.
 */
export function cssDeltaToViewportDelta(dCssX, dCssY, cw, ch, bmpW, bmpH) {
  const sx = bmpW / Math.max(cw, 1)
  const sy = bmpH / Math.max(ch, 1)
  return { dvx: dCssX * sx, dvy: dCssY * sy }
}
