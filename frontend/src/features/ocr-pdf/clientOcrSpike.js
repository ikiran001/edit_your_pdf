/**
 * UNWIRED SPIKE — not imported by production OCR UI.
 *
 * Shipping full PDF OCR in the browser would still require:
 * - Per-page rasterization (pdf.js → canvas/image bitmap)
 * - Hard caps on page count and pixel dimensions (memory / tab freezes)
 * - Optional WASM language packs (bundle size + load time)
 * - Clear UX for progress, cancel, and failures on low-end devices
 *
 * Until those are defined, keep production OCR on the API (ocrmypdf).
 */

import Tesseract from 'tesseract.js'

/**
 * Spike: OCR a single raster image in the browser. Not wired to PDF pipeline yet.
 * @param {Blob} imageBlob — image/png or image/jpeg
 * @returns {Promise<{ text: string }>}
 */
export async function ocrImageBlobOnce(imageBlob) {
  const r = await Tesseract.recognize(imageBlob, 'eng', {
    logger: () => {},
  })
  return { text: String(r?.data?.text || '').trim() }
}
