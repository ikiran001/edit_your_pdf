import { PDFDocument } from 'pdf-lib'
import { pdfToPngBlobs } from '../../lib/pdfRenderPng.js'

/**
 * Flatten AcroForm fields into static content when supported by pdf-lib.
 * @param {Uint8Array} bytes
 * @returns {Promise<{ bytes: Uint8Array, fieldCount: number }>}
 */
export async function flattenPdfForms(bytes) {
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  let fieldCount = 0
  try {
    const form = pdfDoc.getForm()
    fieldCount = form.getFields().length
    if (fieldCount > 0) {
      form.flatten()
    }
  } catch {
    /* No AcroForm in this PDF — `fieldCount` stays 0; we still re-save for a clean output. */
  }
  const out = await pdfDoc.save({ useObjectStreams: true })
  return { bytes: out, fieldCount }
}

/**
 * Replace every page with a full-page PNG rasterization (true “flat” image PDF).
 * @param {ArrayBuffer} arrayBuffer
 * @param {{ scale?: number }} opts
 * @returns {Promise<Uint8Array>}
 */
export async function flattenPdfRasterize(arrayBuffer, { scale = 2 } = {}) {
  const pngBlobs = await pdfToPngBlobs(arrayBuffer, { scale })
  const out = await PDFDocument.create()
  for (const blob of pngBlobs) {
    const ab = await blob.arrayBuffer()
    const png = await out.embedPng(new Uint8Array(ab))
    const w = png.width
    const h = png.height
    const page = out.addPage([w, h])
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: w,
      height: h,
    })
  }
  return out.save({ useObjectStreams: true })
}
