import { PDFDocument } from 'pdf-lib'

function defaultCrop() {
  return { l: 0.05, t: 0.05, w: 0.9, h: 0.9 }
}

/**
 * Apply crop box in PDF user space. `rect` uses top-left origin as fractions of page width/height (same as UI).
 *
 * @param {{ l: number, t: number, w: number, h: number }} rect
 * @param {import('pdf-lib').PDFPage} page
 */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

const MIN_FRAC = 0.02

function setPageCropFromNormRect(rect, page) {
  const { width: W, height: H } = page.getSize()
  let l = clamp(Number(rect.l) || 0, 0, 1 - MIN_FRAC)
  let t = clamp(Number(rect.t) || 0, 0, 1 - MIN_FRAC)
  let w = clamp(Number(rect.w) || 0.1, MIN_FRAC, 1 - l)
  let h = clamp(Number(rect.h) || 0.1, MIN_FRAC, 1 - t)
  const x = l * W
  const yPdf = H - (t + h) * H
  const cw = w * W
  const ch = h * H
  if (cw <= 2 || ch <= 2) throw new Error('Crop area is too small.')
  page.setCropBox(x, yPdf, cw, ch)
}

/**
 * @param {File} file
 * @param {{
 *   scope: 'all' | 'current',
 *   sharedCrop: { l: number, t: number, w: number, h: number },
 *   cropsByPage: Record<number, { l: number, t: number, w: number, h: number }>,
 * }} opts
 */
export async function applyCropPdf(file, opts) {
  const { scope, sharedCrop, cropsByPage } = opts
  const srcBytes = new Uint8Array(await file.arrayBuffer())
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  if (n < 1) throw new Error('This PDF has no pages.')

  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, [...Array(n).keys()])
  for (const page of copied) out.addPage(page)
  const pages = out.getPages()

  for (let i = 0; i < pages.length; i++) {
    if (scope === 'all') {
      setPageCropFromNormRect(sharedCrop, pages[i])
      continue
    }
    const rect = cropsByPage[i]
    if (!rect) continue
    setPageCropFromNormRect(rect, pages[i])
  }

  return out.save()
}
