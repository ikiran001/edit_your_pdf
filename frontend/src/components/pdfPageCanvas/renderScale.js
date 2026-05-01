import { PDF_RENDER_MAX_BITMAP_SIDE, RENDER_SCALE_BASE } from './constants.js'

/**
 * pdf.js render scale: use `RENDER_SCALE_BASE` when the bitmap fits under `maxBitmapSide`,
 * otherwise scale down proportionally so max(width, height) ≤ maxBitmapSide.
 *
 * @param {number} pageWidthPt
 * @param {number} pageHeightPt
 * @param {number} [baseScale]
 * @param {number} [maxBitmapSide]
 */
export function computePdfRenderScale(
  pageWidthPt,
  pageHeightPt,
  baseScale = RENDER_SCALE_BASE,
  maxBitmapSide = PDF_RENDER_MAX_BITMAP_SIDE
) {
  const w = Number(pageWidthPt)
  const h = Number(pageHeightPt)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return baseScale
  const sw = w * baseScale
  const sh = h * baseScale
  const maxDim = Math.max(sw, sh)
  if (!Number.isFinite(maxDim) || maxDim < 1) return baseScale
  if (maxDim <= maxBitmapSide) return baseScale
  return baseScale * (maxBitmapSide / maxDim)
}
