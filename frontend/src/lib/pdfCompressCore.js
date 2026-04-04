import { PDFDocument } from 'pdf-lib'

/** @typedef {'low'|'medium'|'high'} CompressionLevel */

export const COMPRESSION_LEVELS = /** @type {const} */ (['low', 'medium', 'high'])

/**
 * @param {string} level
 * @returns {CompressionLevel}
 */
export function normalizeCompressionLevel(level) {
  return COMPRESSION_LEVELS.includes(level) ? level : 'medium'
}

/**
 * Client-side PDF rewrite using pdf-lib. Stronger “compression” rewrites the file structure;
 * results depend on how the PDF was built (some files shrink a lot, others barely change).
 * @param {Uint8Array} bytes
 * @param {CompressionLevel} level
 * @returns {Promise<Uint8Array>}
 */
export async function compressPdfBytes(bytes, level) {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const n = src.getPageCount()
  if (n < 1) {
    return src.save({ useObjectStreams: true, updateFieldAppearances: false })
  }

  const saveOpts = { updateFieldAppearances: false }

  if (level === 'high') {
    const dst = await PDFDocument.create()
    const copied = await dst.copyPages(src, src.getPageIndices())
    copied.forEach((page) => dst.addPage(page))
    return dst.save({ ...saveOpts, useObjectStreams: true })
  }

  if (level === 'medium') {
    return src.save({ ...saveOpts, useObjectStreams: true })
  }

  return src.save({ ...saveOpts, useObjectStreams: false })
}
